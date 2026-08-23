import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getConfiguredProvider, parseJsonResponse } from "@/lib/ai/configured-provider";
import { lessonContentSchema } from "@/lib/handout/content-schema";
import { patternPrompt } from "@/lib/handout/grade-handout-patterns";

const systemPrompt = `你是小学语文教研编辑。只输出一个JSON对象，不要Markdown。阅读文段必须逐字复制提供的PDF文本，禁止改写、删减、补写。其余内容可按低年级认知水平编写。交流话题至少4道，每道必须包含referenceAnswer。课程对标需要使用联网检索能力，引用当前项目年份最新的官方课标或教材信息，提供真实sourceUrl和sourceTitle；confirmed一律为false，等待人工确认。练习题若没有原图，不得虚构图片。`;

type SourceForGeneration = { id: string; originalName: string; pages: Array<{ id: string; pageNumber: number; extractedText: string }> };

/** A teacher may upload one five-lesson course anthology instead of five files. Split it before drafting. */
export function sourcesForLessons(sources: SourceForGeneration[], lessonCount: number): SourceForGeneration[] {
  if (sources.length >= lessonCount || sources.length !== 1 || lessonCount < 2) return sources.slice(0, lessonCount);
  const source = sources[0];
  const wholeText = source.pages.map((page) => page.extractedText).join("\n");
  const starts = [...wholeText.matchAll(/(?:^|\n)\s*(?:第\s*[一二三四五12345]\s*讲|[一二三四五]\s*、\s*第?\s*[一二三四五12345]\s*讲)/gmu)].map((match) => match.index ?? 0);
  // Course maps sometimes mention all five lessons at the beginning. The last complete set is the actual five-lesson body.
  const bodyStarts = starts.length > lessonCount ? starts.slice(-lessonCount) : starts;
  if (bodyStarts.length !== lessonCount) return sources;
  return bodyStarts.map((start, index) => {
    const end = bodyStarts[index + 1] ?? wholeText.length;
    const chunk = wholeText.slice(start, end).trim();
    return { id: source.id, originalName: `${source.originalName}（第${index + 1}讲分段）`, pages: [{ id: source.pages[0]?.id ?? source.id, pageNumber: index + 1, extractedText: chunk }] };
  });
}

function extractExactReadingExcerpt(source: string) {
  const match = source.match(/原文摘抄\s*[：:]\s*([\s\S]{12,1800}?)(?=\n\s*(?:📖|✍️|💡|✨|第\s*0?\d+\s*讲)|$)/u);
  if (!match) return null;
  const normalized = match[1].replace(/\s+/g, " ").trim();
  // 课件常在摘抄后紧接人物梳理，如“不高兴：特点……”；这不是原文的一部分。
  const nextTeachingBlock = normalized.search(/\s+[\u3400-\u9fff]{1,12}[：:](?:特点|办法|名言|范例|词语|汉字)/u);
  const text = (nextTeachingBlock >= 0 ? normalized.slice(0, nextTeachingBlock) : normalized).trim();
  // 只有中文标点的“摘抄”通常是 OCR/版式噪声；阻断导出而不是把垃圾内容当原文。
  const hanCount = (text.match(/[\u3400-\u9fff]/gu) ?? []).length;
  return hanCount >= 12 ? text : null;
}

function promptForLesson(input: { lessonNumber: number; grade: string; year: number; sourceId: string; sourceName: string; pages: Array<{ id: string; pageNumber: number; extractedText: string }> }) {
  const source = input.pages.map((page) => `【PDF第${page.pageNumber}页，页面ID=${page.id}】\n${page.extractedText}`).join("\n\n").slice(0, 180_000);
  return `为${input.grade}、${input.year}年口径生成第${input.lessonNumber}讲讲义文字初稿。源文件ID=${input.sourceId}，文件名=${input.sourceName}。\n\n${patternPrompt(input.grade)}\n\n输出字段必须是：lessonNumber,title,subtitle,technique,learningGoals(至少3项),curriculumAlignment([{claim,sourceUrl,sourceTitle,confirmed:false}]),parentBusySteps,parentExtendedSteps,conversationTopics([{question,referenceAnswer}]至少4项),readingExcerpt({text,sourceFileId:"${input.sourceId}",sourcePages:[页码],sourceFingerprint:"temporary-fingerprint",corrections:[],approved:false}),closeReadingQuestions,methodSummary,practice([{prompt,answer,imageSourcePageId?}]),littleTeacherSteps,oralFramework。若练习依赖PDF中的题图，把对应页面ID写入imageSourcePageId；不得生成替代图片。\n\nPDF识别文本如下：\n${source}`;
}

export async function generateProjectContent(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { sourceFiles: { where: { kind: { in: ["PDF", "DOCUMENT"] } }, orderBy: { createdAt: "asc" }, include: { pages: { orderBy: { pageNumber: "asc" } } } } }
  });
  if (!project) throw new Error("项目不存在");
  if (!project.teachingYearConfirmedAt) throw new Error("请先确认教学年份");
  if (project.sourceFiles.length === 0 || project.sourceFiles.some((file) => file.pages.length === 0)) throw new Error("请先完成全部主讲文件解析");

  const provider = await getConfiguredProvider(project.selectedProviderId);
  const lessons: string[] = [];
  const generationSources = sourcesForLessons(project.sourceFiles, project.lessonCount);
  if (generationSources.length < project.lessonCount) throw new Error(`当前只识别到${generationSources.length}讲主讲内容；请上传${project.lessonCount}份文件，或使用带清晰“第X讲”标题的合订DOCX/PDF`);
  for (const [index, source] of generationSources.entries()) {
    const result = await provider.generateText({ systemPrompt, userPrompt: promptForLesson({ lessonNumber: index + 1, grade: project.grade, year: project.teachingYear, sourceId: source.id, sourceName: source.originalName, pages: source.pages }), temperature: 0.15 });
    const draft = parseJsonResponse(result.text) as Record<string, unknown>;
    const reading = draft.readingExcerpt as Record<string, unknown> | undefined;
    if (!reading || typeof reading.text !== "string") throw new Error(`第${index + 1}讲未生成阅读文段`);
    const exactExcerpt = extractExactReadingExcerpt(source.pages.map((page) => page.extractedText).join("\n"));
    if (!exactExcerpt) throw new Error(`第${index + 1}讲未能从主讲文件定位“原文摘抄”；已停止生成，需人工在文字审核页选取阅读文段`);
    // 阅读文段不交给模型“复述”：从主讲文件中的原文摘抄直接回填，确保逐字可追溯。
    reading.text = exactExcerpt;
    const pageNumbers = source.pages.filter((page) => page.extractedText.includes(exactExcerpt.slice(0, 12))).map((page) => page.pageNumber);
    const sourceText = source.pages.filter((page) => pageNumbers.includes(page.pageNumber)).map((page) => page.extractedText).join("\n");
    if (!sourceText.replace(/\s/g, "").includes(exactExcerpt.replace(/\s/g, ""))) throw new Error(`第${index + 1}讲阅读文段无法验证来源`);
    reading.sourceFileId = source.id;
    reading.sourceFingerprint = createHash("sha256").update(exactExcerpt).digest("hex");
    reading.approved = false;
    const alignment = draft.curriculumAlignment as Array<Record<string, unknown>> | undefined;
    alignment?.forEach((item) => { item.confirmed = false; });
    const content = lessonContentSchema.parse({ ...draft, lessonNumber: index + 1, readingExcerpt: reading });
    const lesson = await db.lesson.upsert({
      where: { projectId_lessonNumber: { projectId: project.id, lessonNumber: index + 1 } },
      create: { projectId: project.id, lessonNumber: index + 1, title: content.title, subtitle: content.subtitle, technique: content.technique, structuredContent: content, readingExcerpt: content.readingExcerpt.text, readingExcerptSource: content.readingExcerpt },
      update: { title: content.title, subtitle: content.subtitle, technique: content.technique, structuredContent: content, readingExcerpt: content.readingExcerpt.text, readingExcerptSource: content.readingExcerpt, status: "TEXT_REVIEW", textApprovedAt: null }
    });
    lessons.push(lesson.id);
  }
  await db.project.update({ where: { id: project.id }, data: { status: "TEXT_REVIEW" } });
  return lessons;
}
