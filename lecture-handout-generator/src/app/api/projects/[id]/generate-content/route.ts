import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { getConfiguredProvider, parseJsonResponse } from "@/lib/ai/configured-provider";
import { lessonContentSchema } from "@/lib/handout/content-schema";

const systemPrompt = `你是小学语文教研编辑。只输出一个JSON对象，不要Markdown。阅读文段必须逐字复制提供的PDF文本，禁止改写、删减、补写。其余内容可按低年级认知水平编写。交流话题至少4道，每道必须包含referenceAnswer。课程对标需要使用联网检索能力，引用当前项目年份最新的官方课标或教材信息，提供真实sourceUrl和sourceTitle；confirmed一律为false，等待人工确认。练习题若没有原图，不得虚构图片。`;

function promptForLesson(input: { lessonNumber: number; grade: string; year: number; sourceId: string; sourceName: string; pages: Array<{ id: string; pageNumber: number; extractedText: string }> }) {
  const source = input.pages.map((page) => `【PDF第${page.pageNumber}页，页面ID=${page.id}】\n${page.extractedText}`).join("\n\n").slice(0, 180_000);
  return `为${input.grade}、${input.year}年口径生成第${input.lessonNumber}讲讲义文字初稿。源文件ID=${input.sourceId}，文件名=${input.sourceName}。\n输出字段必须是：lessonNumber,title,subtitle,technique,learningGoals(至少3项),curriculumAlignment([{claim,sourceUrl,sourceTitle,confirmed:false}]),parentBusySteps,parentExtendedSteps,conversationTopics([{question,referenceAnswer}]至少4项),readingExcerpt({text,sourceFileId:"${input.sourceId}",sourcePages:[页码],sourceFingerprint:"temporary-fingerprint",corrections:[],approved:false}),closeReadingQuestions,methodSummary,practice([{prompt,answer,imageSourcePageId?}]),littleTeacherSteps,oralFramework。若练习依赖PDF中的题图，把对应页面ID写入imageSourcePageId；不得生成替代图片。\n\nPDF识别文本如下：\n${source}`;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const project = await db.project.findFirst({
    where: { id, ownerId: session.userId },
    include: { sourceFiles: { where: { kind: "PDF" }, orderBy: { createdAt: "asc" }, include: { pages: { orderBy: { pageNumber: "asc" } } } } }
  });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (!project.teachingYearConfirmedAt) return NextResponse.json({ error: "请先确认教学年份" }, { status: 409 });
  if (project.sourceFiles.length === 0 || project.sourceFiles.some((file) => file.pages.length === 0)) return NextResponse.json({ error: "请先完成全部PDF解析" }, { status: 409 });
  try {
    const provider = await getConfiguredProvider(project.selectedProviderId);
    const lessons = [];
    for (const [index, source] of project.sourceFiles.slice(0, project.lessonCount).entries()) {
      const result = await provider.generateText({ systemPrompt, userPrompt: promptForLesson({ lessonNumber: index + 1, grade: project.grade, year: project.teachingYear, sourceId: source.id, sourceName: source.originalName, pages: source.pages }), temperature: 0.15 });
      const draft = parseJsonResponse(result.text) as Record<string, unknown>;
      const reading = draft.readingExcerpt as Record<string, unknown> | undefined;
      if (!reading || typeof reading.text !== "string") throw new Error(`第${index + 1}讲未生成阅读文段`);
      const pageNumbers = Array.isArray(reading.sourcePages) ? reading.sourcePages.filter((page): page is number => Number.isInteger(page)) : [];
      const sourceText = source.pages.filter((page) => pageNumbers.includes(page.pageNumber)).map((page) => page.extractedText).join("\n");
      const normalizedExcerpt = reading.text.replace(/\s/g, "");
      if (!sourceText.replace(/\s/g, "").includes(normalizedExcerpt)) throw new Error(`第${index + 1}讲阅读文段不是PDF原文，请重新生成或人工选取`);
      reading.sourceFileId = source.id;
      reading.sourceFingerprint = createHash("sha256").update(reading.text).digest("hex");
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
    return NextResponse.json({ lessonIds: lessons });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "内容生成失败" }, { status: 422 });
  }
}
