import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getConfiguredProvider, parseJsonResponse } from "@/lib/ai/configured-provider";
import { lessonContentSchema } from "@/lib/handout/content-schema";
import { patternPrompt } from "@/lib/handout/grade-handout-patterns";
import { normalizeLessonSubtitle } from "@/lib/handout/subtitle";

const systemPrompt = `你是小学语文教研编辑。主讲文件是课堂证据，不是要逐段照抄的讲义模板。只输出一个JSON对象，不要Markdown。

硬规则：阅读文段必须从提供的主讲文件中逐字复制，禁止改写、删减、补写；除阅读文段外，必须根据课堂故事、方法、练习与年级认知主动完成讲义的全部板块，即使主讲文件没有逐项写出这些板块，也不得留空或照抄零散课件文字。交流话题至少4道，每道必须包含具体的referenceAnswer。课程对标需要使用联网检索能力，引用当前项目年份最新的官方课标或教材信息，提供真实sourceUrl和sourceTitle；confirmed一律为false，等待人工确认。练习题若没有原图，不得虚构图片。`;

type SourceForGeneration = { id: string; originalName: string; pages: Array<{ id: string; pageNumber: number; extractedText: string }> };

/** A teacher may upload one five-lesson course anthology instead of five files. Split it before drafting. */
export function sourcesForLessons(sources: SourceForGeneration[], lessonCount: number): SourceForGeneration[] {
  if (sources.length >= lessonCount || sources.length !== 1 || lessonCount < 2) return sources.slice(0, lessonCount);
  const source = sources[0];
  const wholeText = source.pages.map((page) => page.extractedText).join("\n");
  // Real course handouts use variants such as “第一讲”, “秋 01 讲” and “暑03讲”.
  // Restrict this to the beginning of a paragraph so questions mentioning “第X讲”
  // never split the lesson body by mistake.
  const lessonHeading = /(?:^|\n)\s*(?:(?:春季?|夏季?|秋季?|冬季?|暑期?)\s*)?(?:(?:第\s*)?(?:0?[1-9]|[一二三四五六七八九十])\s*讲|[一二三四五六七八九十]\s*[、.．]\s*(?:第\s*)?(?:0?[1-9]|[一二三四五六七八九十])\s*讲)(?=(?:\s+\S|[《“"【—－\-:：]|$))/gmu;
  const starts = [...wholeText.matchAll(lessonHeading)].map((match) => match.index ?? 0);
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

/** The model can identify an unlabeled reading passage, but every character still has to
 * be traceable to the source file. Whitespace does not alter the reading text itself. */
function isVerbatimSourceText(candidate: string, source: string) {
  const compactCandidate = candidate.replace(/\s/g, "");
  const compactSource = source.replace(/\s/g, "");
  const hanCount = (compactCandidate.match(/[\u3400-\u9fff]/gu) ?? []).length;
  return hanCount >= 12 && compactSource.includes(compactCandidate);
}

/** Providers occasionally return question objects such as { question: "…" } despite the JSON contract.
 * Keep the generation pipeline resilient, while retaining every human-readable question. */
function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      for (const key of ["question", "prompt", "text", "content", "title"]) {
        if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
      }
    }
    return "";
  }).filter(Boolean);
}

function normalizeLearningGoals(value: unknown) {
  return normalizeStringList(value)
    .map((goal) => goal
      .replace(/^\s*(?:我|我们)\s*(?:要|能|可以|学会)?\s*/u, "")
      .replace(/^能/u, "能够"))
    .filter(Boolean);
}

function textOf(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") return normalizeStringList([value])[0] ?? fallback;
  return fallback;
}

function normalizeConversationTopics(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      question: textOf(record.question ?? record.prompt),
      referenceAnswer: textOf(record.referenceAnswer ?? record.answer ?? record.reference)
    };
  }).filter((item) => item.question && item.referenceAnswer);
}

function normalizePractice(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      prompt: textOf(record.prompt ?? record.question ?? record.text),
      answer: textOf(record.answer ?? record.referenceAnswer ?? record.reference),
      ...(typeof record.imageSourceFileId === "string" ? { imageSourceFileId: record.imageSourceFileId } : {}),
      ...(typeof record.imageSourcePageId === "string" ? { imageSourcePageId: record.imageSourcePageId } : {})
    };
  }).filter((item) => item.prompt && item.answer);
}

function lessonTitleFromSource(source: string, lessonNumber: number) {
  const match = source.match(/(?:(?:春季?|夏季?|秋季?|冬季?|暑期?)\s*)?(?:第\s*)?0?\d+\s*讲\s*([^\n]{2,80})/u);
  return match?.[1]?.trim() || `第${lessonNumber}讲阅读课`;
}

function promptForLesson(input: { lessonNumber: number; grade: string; year: number; season: string; sourceId: string; sourceName: string; pages: Array<{ id: string; pageNumber: number; extractedText: string }> }) {
  const source = input.pages.map((page) => `【PDF第${page.pageNumber}页，页面ID=${page.id}】\n${page.extractedText}`).join("\n\n").slice(0, 180_000);
  return `为${input.grade}、${input.year}年${input.season}生成第${input.lessonNumber}讲讲义文字初稿。源文件ID=${input.sourceId}，文件名=${input.sourceName}。\n\n${patternPrompt(input.grade)}\n\n先从源文件识别本讲的故事、知识方法、课堂活动和题目证据；再以教研编辑身份补全完整讲义。不要把“没有写到某板块”当作空白理由：学习目标、方法小结、精读问题、精读参考答案、家长交流、练习答案、小老师表达和家长指导均应根据课堂证据新写，语言具体、可教、可练。只有readingExcerpt.text必须逐字取自源文件，可从没有“原文摘抄”标签的正文中定位，但绝不可以自行改写或拼接。closeReadingQuestions与closeReadingAnswers必须一一对应，答案要回扣原文证据。\n\n本讲对标必须先使用你的联网检索能力核对${input.year}年仍在使用的官方教材目录、单元与课文/快乐读书吧书目：${input.season}对应${input.grade}上册；冬季/春季对应${input.grade}下册；暑期对应本年级下册加升年级上册。courseAlignment只写一段不超过90字的事实性结论，必须明确“几年级、上/下册、第几单元、第几课或快乐读书吧书目”及本讲能力对应；绝对禁止出现“请联网”“模型”“提示词”“课程标准口径”“讲义文字初稿”“根据要求”等元指令。curriculumAlignment同时给出实际检索到的官方来源链接，confirmed:false。learningGoals至少3条，每条只写一个可观察能力，不用第一人称、不用“我/我们”，并且每项独立成行。subtitle必须是一句概括本讲能力重点的短语，例如“读懂人物 · 讲清事情 · 说出道理”；严禁写年级、季节、年份、教材口径、讲义文字初稿或项目名称。oralFramework是学生填写的题干，必须保留足够的填空线，不得把示范答案写进此字段；如需答案写入oralReferenceAnswer。\n\n输出字段必须是：lessonNumber,title,subtitle,technique,courseAlignment,learningGoals(至少3项),curriculumAlignment([{claim,sourceUrl,sourceTitle,confirmed:false}]),parentBusySteps,parentExtendedSteps,conversationTopics([{question,referenceAnswer}]至少4项),readingExcerpt({text,sourceFileId:"${input.sourceId}",sourcePages:[页码],sourceFingerprint:"temporary-fingerprint",corrections:[],approved:false}),closeReadingQuestions,closeReadingAnswers,methodSummary,practice([{prompt,answer,imageSourcePageId?}]),littleTeacherSteps,oralFramework,oralReferenceAnswer?。若练习依赖PDF中的题图，把对应页面ID写入imageSourcePageId；不得生成替代图片。\n\nPDF识别文本如下：\n${source}`;
}

export async function generateProjectContent(
  projectId: string,
  reportProgress?: (completed: number, total: number) => Promise<void>,
) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { sourceFiles: { where: { kind: { in: ["PDF", "DOCUMENT"] } }, orderBy: { createdAt: "asc" }, include: { pages: { orderBy: { pageNumber: "asc" } } } } }
  });
  if (!project) throw new Error("项目不存在");
  if (!project.teachingYearConfirmedAt) throw new Error("请先确认教学年份");
  if (project.sourceFiles.length === 0 || project.sourceFiles.some((file) => file.pages.length === 0)) throw new Error("请先完成全部主讲文件解析");
  if (project.sourceFiles.some((file) => file.pages.every((page) => page.extractedText.replace(/\s/g, "").length === 0))) {
    throw new Error("主讲文件仍在扫描件OCR中，当前没有可用文字；请等待解析进度完成后系统会自动生成初稿");
  }

  const provider = await getConfiguredProvider(project.selectedProviderId);
  const lessons: string[] = [];
  const generationSources = sourcesForLessons(project.sourceFiles, project.lessonCount);
  // 单讲 Word 是有效课堂证据：先完成它，不以项目默认的五讲数量强迫模型臆造其它课程。
  if (generationSources.length === 0) throw new Error("未识别到可生成讲义的主讲内容");
  for (const [index, source] of generationSources.entries()) {
    await reportProgress?.(index, generationSources.length);
    const result = await provider.generateText({ systemPrompt, userPrompt: promptForLesson({ lessonNumber: index + 1, grade: project.grade, year: project.teachingYear, season: project.season ?? "秋季", sourceId: source.id, sourceName: source.originalName, pages: source.pages }), temperature: 0.15 });
    const draft = parseJsonResponse(result.text) as Record<string, unknown>;
    const reading = draft.readingExcerpt as Record<string, unknown> | undefined;
    if (!reading || typeof reading.text !== "string") throw new Error(`第${index + 1}讲未生成阅读文段`);
    const wholeSourceText = source.pages.map((page) => page.extractedText).join("\n");
    const modelExcerpt = reading.text.trim();
    const labeledExcerpt = extractExactReadingExcerpt(wholeSourceText);
    // Prefer the labeled source passage when present; otherwise accept the model's quoted
    // passage only after exact character-level source verification.
    const exactExcerpt = labeledExcerpt ?? (isVerbatimSourceText(modelExcerpt, wholeSourceText) ? modelExcerpt : null);
    if (!exactExcerpt) throw new Error(`第${index + 1}讲未能从主讲文件逐字定位阅读文段；请补充含原文的主讲页后重试`);
    reading.text = exactExcerpt;
    const pageNumbers = source.pages.filter((page) => isVerbatimSourceText(exactExcerpt, page.extractedText)).map((page) => page.pageNumber);
    if (!isVerbatimSourceText(exactExcerpt, wholeSourceText)) throw new Error(`第${index + 1}讲阅读文段无法验证来源`);
    reading.sourceFileId = source.id;
    reading.sourcePages = pageNumbers.length ? pageNumbers : [source.pages[0]?.pageNumber ?? 1];
    reading.sourceFingerprint = createHash("sha256").update(exactExcerpt).digest("hex");
    reading.approved = false;
    reading.corrections = Array.isArray(reading.corrections) ? reading.corrections : [];
    const alignment = draft.curriculumAlignment as Array<Record<string, unknown>> | undefined;
    alignment?.forEach((item) => { item.confirmed = false; });
    const learningGoals = normalizeLearningGoals(draft.learningGoals);
    const parentBusySteps = normalizeStringList(draft.parentBusySteps);
    const parentExtendedSteps = normalizeStringList(draft.parentExtendedSteps);
    const content = lessonContentSchema.parse({
      ...draft,
      lessonNumber: index + 1,
      title: textOf(draft.title, lessonTitleFromSource(source.pages.map((page) => page.extractedText).join("\n"), index + 1)),
      technique: textOf(draft.technique, "阅读方法"),
      courseAlignment: textOf(draft.courseAlignment, "本讲教材对标待生成，请重新生成文字初稿后核对。"),
      learningGoals: learningGoals.length >= 3 ? learningGoals : ["读懂本讲人物和事情。", "能用课堂方法梳理关键信息。", "能结合文本说出自己的理解。"],
      // A missing parent path must not abort all five lessons. The editor can refine these
      // two visible scaffolds during the first human review.
      parentBusySteps: parentBusySteps.length ? parentBusySteps : ["和孩子一起回顾本讲方法，再请孩子用自己的话说一说。"],
      parentExtendedSteps: parentExtendedSteps.length ? parentExtendedSteps : ["结合阅读文段追问一个“为什么”，鼓励孩子举例说明。"],
      closeReadingQuestions: normalizeStringList(draft.closeReadingQuestions).length ? normalizeStringList(draft.closeReadingQuestions) : ["读完这段话，你知道了什么？", "你从哪些词句找到依据？", "这段话让你想到什么？"],
      closeReadingAnswers: normalizeStringList(draft.closeReadingAnswers),
      littleTeacherSteps: normalizeStringList(draft.littleTeacherSteps).length ? normalizeStringList(draft.littleTeacherSteps) : ["先说清故事中的人物。", "再按顺序说一说事情。", "最后说出自己的收获。"],
      subtitle: normalizeLessonSubtitle(draft.subtitle, String(draft.technique ?? ""), learningGoals),
      curriculumAlignment: Array.isArray(alignment) && alignment.length ? alignment.map((item) => ({
        claim: textOf(item.claim, "请人工核对本讲与课程标准的对应关系。"),
        sourceUrl: textOf(item.sourceUrl, "https://www.gov.cn/zhengce/zhengceku/2022-04/21/content_5686335.htm"),
        sourceTitle: textOf(item.sourceTitle, "义务教育语文课程标准（2022年版）"),
        confirmed: false
      })) : [{ claim: "请人工核对本讲与课程标准的对应关系。", sourceUrl: "https://www.gov.cn/zhengce/zhengceku/2022-04/21/content_5686335.htm", sourceTitle: "义务教育语文课程标准（2022年版）", confirmed: false }],
      conversationTopics: normalizeConversationTopics(draft.conversationTopics).length >= 4 ? normalizeConversationTopics(draft.conversationTopics) : [
        { question: "故事里主要写了谁？", referenceAnswer: "可以先说出主要人物，再用文中的事情说明。" },
        { question: "哪件事让你印象最深？", referenceAnswer: "可以选择一件事，并说出让你印象深刻的词句。" },
        { question: "你从中读出了人物怎样的特点？", referenceAnswer: "要结合人物说的话、做的事来回答。" },
        { question: "这件事给你什么提醒？", referenceAnswer: "可以联系自己的生活，说说以后会怎么做。" }
      ],
      practice: normalizePractice(draft.practice).length ? normalizePractice(draft.practice) : [{ prompt: "请用本讲方法梳理人物、事情和道理。", answer: "先写人物，再写事情，最后写出自己的理解。" }],
      methodSummary: textOf(draft.methodSummary, "请结合本讲主讲内容补充方法小结。"),
      oralFramework: textOf(draft.oralFramework, "我先说清人物和事情，再说一说道理。"),
      readingExcerpt: reading
    });
    const lesson = await db.lesson.upsert({
      where: { projectId_lessonNumber: { projectId: project.id, lessonNumber: index + 1 } },
      create: { projectId: project.id, lessonNumber: index + 1, title: content.title, subtitle: content.subtitle, technique: content.technique, structuredContent: content, readingExcerpt: content.readingExcerpt.text, readingExcerptSource: content.readingExcerpt, status: "TEXT_REVIEW" },
      update: { title: content.title, subtitle: content.subtitle, technique: content.technique, structuredContent: content, readingExcerpt: content.readingExcerpt.text, readingExcerptSource: content.readingExcerpt, status: "TEXT_REVIEW", textApprovedAt: null }
    });
    lessons.push(lesson.id);
    await reportProgress?.(index + 1, generationSources.length);
  }
  await db.project.update({ where: { id: project.id }, data: { status: "TEXT_REVIEW" } });
  return lessons;
}
