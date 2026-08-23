import {
  AlignmentType, Document, Footer, Header, HorizontalPositionRelativeFrom, ImageRun, PageNumber, Paragraph, Packer,
  SectionType, TextRun, VerticalPositionRelativeFrom, type ISectionOptions
} from "docx";
import JSZip from "jszip";
import type { LessonContent } from "@/lib/handout/content-schema";
import type { PinyinUnit } from "@/lib/handout/pinyin";

const FONT = "Microsoft YaHei";
const orange = "F07A42";
const gray = "6E655F";

export type HandoutDocumentInput = {
  projectName: string;
  grade: string;
  teachingYear: number;
  teacherFormalName?: string;
  teacherNickname?: string;
  lessons: LessonContent[];
  pinyinReviews?: Record<number, PinyinUnit[]>;
  backgrounds?: Partial<Record<"SIMPLE" | "COVER" | "PARENT_MANUAL" | "LESSON_HOME" | "CONVERSATION" | "READING" | "PRACTICE" | "LITTLE_TEACHER", ImageAsset>>;
  teacherImage?: ImageAsset;
  teacherPortrait?: ImageAsset;
  teacherPosition?: { x: number; y: number; width: number; height: number };
  fontSize?: number;
  fontFamily?: "Microsoft YaHei" | "SimSun" | "KaiTi" | "FangSong";
  practiceImages?: Record<string, ImageAsset>;
  includeFrontMatter?: boolean;
  mode: "student" | "answers" | "parent";
};
type ImageAsset = { data: Buffer; type: "png" | "jpg" | "gif" | "bmp" };

function run(text: string, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text, font: FONT, bold: options.bold, size: options.size ?? 22, color: options.color ?? "2F2A27" });
}

function title(text: string, subtitle?: string) {
  return [
    new Paragraph({ spacing: { before: 260, after: 110 }, children: [run(text, { bold: true, size: 36, color: orange })] }),
    ...(subtitle ? [new Paragraph({ spacing: { after: 180 }, children: [run(subtitle, { size: 22, color: gray })] })] : [])
  ];
}

function heading(text: string) {
  return new Paragraph({ spacing: { before: 180, after: 90 }, keepNext: true, children: [run(text, { bold: true, size: 25, color: orange })] });
}

function body(text: string, bold = false) {
  return new Paragraph({ spacing: { after: 100, line: 360 }, children: [run(text, { bold })] });
}

function numbered(items: string[]) {
  return items.map((item, index) => body(`${index + 1}. ${item}`));
}

function footer() {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("橙子讲义工坊  ·  ", { size: 17, color: "A79D96" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 17, color: "A79D96" })] })] });
}

function backgroundHeader(image?: ImageAsset) {
  if (!image) return undefined;
  return new Header({ children: [new Paragraph({ children: [new ImageRun({ ...image, transformation: { width: 794, height: 1123 }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, allowOverlap: true } })] })] });
}

function section(children: Paragraph[], background?: ImageAsset): ISectionOptions {
  return {
    properties: { type: SectionType.NEXT_PAGE, page: { margin: { top: 850, right: 850, bottom: 760, left: 850, header: 0, footer: 360 } } },
    headers: background ? { default: backgroundHeader(background) } : undefined,
    footers: { default: footer() },
    children
  };
}

function pickBackground(input: HandoutDocumentInput, role: keyof NonNullable<HandoutDocumentInput["backgrounds"]>) { return input.backgrounds?.[role] ?? input.backgrounds?.SIMPLE; }

function teacherParagraph(input: HandoutDocumentInput) {
  if (!input.teacherImage) return [];
  const pos = input.teacherPosition ?? { x: 67, y: 57, width: 25, height: 30 };
  return [new Paragraph({ children: [new ImageRun({ ...input.teacherImage, transformation: { width: Math.round(794 * pos.width / 100), height: Math.round(1123 * pos.height / 100) }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(794 * pos.x / 100 * 9525) }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(1123 * pos.y / 100 * 9525) }, behindDocument: false, allowOverlap: true } })] })];
}

function parentTeacherParagraph(input: HandoutDocumentInput) {
  if (!input.teacherPortrait) return [];
  return [new Paragraph({ children: [new ImageRun({ ...input.teacherPortrait, transformation: { width: 110, height: 110 }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 5_650_000 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 1_000_000 }, behindDocument: false, allowOverlap: true } })] })];
}

function practiceImage(input: HandoutDocumentInput, pageId?: string, fileId?: string) {
  const image = pageId ? input.practiceImages?.[pageId] : fileId ? input.practiceImages?.[fileId] : undefined;
  return image ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new ImageRun({ ...image, transformation: { width: 480, height: 320 } })] })] : [];
}

function lessonSections(lesson: LessonContent, input: HandoutDocumentInput) {
  const p1 = section([
    ...title(`第${lesson.lessonNumber}讲  ${lesson.title}`, lesson.subtitle),
    heading("今天学什么"), ...numbered(lesson.learningGoals),
    heading("核心方法"), body(lesson.technique, true),
    heading("家长陪学建议"), body("时间紧："), ...numbered(lesson.parentBusySteps), body("有时间："), ...numbered(lesson.parentExtendedSteps)
  ], pickBackground(input, "LESSON_HOME"));
  const p2 = section([
    ...title("💬 下课后，建议家长可以和孩子交流的话题"),
    ...lesson.conversationTopics.flatMap((topic, index) => [heading(`${index + 1}. ${topic.question}`), body(`参考：${topic.referenceAnswer}`)])
  ], pickBackground(input, "CONVERSATION"));
  const p3 = section([
    ...title("阅读文段"), body(lesson.readingExcerpt.text), heading("精读思考"), ...numbered(lesson.closeReadingQuestions)
  ], pickBackground(input, "READING"));
  const p4 = section([
    ...title("课堂方法与真题带练"), heading("方法小结"), body(lesson.methodSummary), heading("练一练"),
    ...lesson.practice.flatMap((item, index) => [body(`${index + 1}. ${item.prompt}`, true), ...practiceImage(input, item.imageSourcePageId, item.imageSourceFileId), body(`参考答案：${item.answer}`)]), ...teacherParagraph(input)
  ], pickBackground(input, "PRACTICE"));
  const p5 = section([
    ...title("我是小老师"), heading("讲解步骤"), ...numbered(lesson.littleTeacherSteps), heading("表达小支架"), body(lesson.oralFramework)
  ], pickBackground(input, "LITTLE_TEACHER"));
  return [p1, p2, p3, p4, p5];
}

function parentSections(input: HandoutDocumentInput) {
  const overview = section([
    ...title(`${input.grade}读写综合能力提升`, "家长使用手册  ·  真读书 · 有深度 · 用得上"),
    ...parentTeacherParagraph(input),
    heading("双师陪伴"), body(`主讲老师：${input.teacherFormalName ? `${input.teacherFormalName}老师` : "以项目绑定主讲老师为准"}。本手册配合${input.teachingYear}年${input.projectName}使用，帮助家长了解课程目标、陪学方式与课后沟通重点。`),
    heading("五讲课程带来的能力提升"), body("五讲合起来，孩子练习的是：读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。"),
    heading(`${input.grade}阶段，最需要关注什么？`),
    body("基础：从“会认字”走向“会用字词”。阅读中看见、理解并能在表达中使用，是低年级语文能力的关键起点。"),
    body("阅读：从“听故事”走向“读懂故事”。家长可追问人物、事情、证据和道理，帮助孩子把感受说清楚。"),
    body("表达：从“说一句话”走向“完整表达”。先把人物、事情、动作、语言、心情和结果说完整，再落到笔头。"),
    heading("家长怎么配合？"), ...numbered(["课前只做轻量预热，不提前讲答案，让孩子保留课堂发现感。", "课后先请孩子复述课堂方法，再完成讲义中的交流话题。", "参考答案用于追问与校准，不要求孩子逐字复述。", "阅读文段以主讲文件原文为准，不随意删改。"])
  ], pickBackground(input, "PARENT_MANUAL"));
  const schedule = section([
    ...title("五讲学习安排", "每讲学什么 · 家长怎么陪"),
    ...input.lessons.flatMap((lesson) => [
      heading(`第${lesson.lessonNumber}讲  ${lesson.title}`),
      body(`课堂方法：${lesson.technique}`, true),
      body(`课后建议：${lesson.parentBusySteps[0] ?? "请孩子用自己的话复述今天的一个方法。"}`),
      body(`交流重点：${lesson.conversationTopics[0]?.question ?? "请孩子说说今天学到的内容。"}`)
    ])
  ], pickBackground(input, "PARENT_MANUAL"));
  return [overview, schedule];
}

function coverSections(input: HandoutDocumentInput) {
  const cover = pickBackground(input, "COVER");
  return [section(cover ? [new Paragraph({ children: [run("")] })] : [
    ...title(input.projectName, `${input.grade} · ${input.teachingYear}年`),
    body(input.teacherFormalName ? `主讲：${input.teacherFormalName}老师` : "小学语文读写综合能力提升")
  ], cover)];
}

function answerSections(input: HandoutDocumentInput) {
  return input.lessons.map((lesson) => section([
    ...title(`第${lesson.lessonNumber}讲参考答案`, lesson.title),
    heading("交流话题参考"), ...lesson.conversationTopics.flatMap((item, index) => [body(`${index + 1}. ${item.question}`, true), body(item.referenceAnswer)]),
    heading("练习参考"), ...lesson.practice.flatMap((item, index) => [body(`${index + 1}. ${item.prompt}`, true), body(item.answer)])
  ], pickBackground(input, "SIMPLE")));
}

export async function generateHandoutDocx(input: HandoutDocumentInput) {
  const sections = input.mode === "parent" ? parentSections(input) : input.mode === "answers" ? answerSections(input) : [
    ...(input.includeFrontMatter ? [...coverSections(input), ...parentSections(input)] : []),
    ...input.lessons.flatMap((lesson) => lessonSections(lesson, input))
  ];
  const document = new Document({
    creator: "橙子讲义工坊",
    title: input.projectName,
    description: "可编辑小学语文课程讲义",
    styles: { default: { document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { line: 360 } } } } },
    sections
  });
  let buffer: Buffer<ArrayBufferLike> = Buffer.from(await Packer.toBuffer(document));
  if (input.fontSize && input.fontSize !== 11) buffer = await replaceBodyFontSize(buffer, input.fontSize);
  if (input.fontFamily && input.fontFamily !== FONT) buffer = await replaceDocumentFont(buffer, input.fontFamily);
  if (input.mode === "student" && input.pinyinReviews && Object.keys(input.pinyinReviews).length > 0) {
    buffer = await addNativeRuby(buffer, input.lessons, input.pinyinReviews);
  }
  return Buffer.from(buffer);
}

async function replaceDocumentFont(buffer: Buffer, fontFamily: string) {
  const zip = await JSZip.loadAsync(buffer);
  for (const path of ["word/document.xml", "word/styles.xml"]) {
    const entry = zip.file(path);
    if (!entry) continue;
    const xml = await entry.async("string");
    zip.file(path, xml.replaceAll("Microsoft YaHei", fontFamily));
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

async function replaceBodyFontSize(buffer: Buffer, fontSize: number) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) return buffer;
  const xml = await entry.async("string");
  zip.file("word/document.xml", xml.replace(/w:sz w:val="22"/g, `w:sz w:val="${Math.round(fontSize * 2)}"`));
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function rubyXml(units: PinyinUnit[]) {
  return units.map((unit) => {
    if (!/[\u3400-\u9fff]/u.test(unit.char) || !unit.pinyin) return `<w:r><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(unit.char)}</w:t></w:r>`;
    return `<w:ruby><w:rubyPr><w:rubyAlign w:val="center"/><w:hps w:val="14"/><w:hpsRaise w:val="22"/><w:hpsBaseText w:val="22"/><w:lid w:val="zh-CN"/></w:rubyPr><w:rt><w:r><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/><w:sz w:val="14"/></w:rPr><w:t>${escapeXml(unit.pinyin)}</w:t></w:r></w:rt><w:rubyBase><w:r><w:rPr><w:rFonts w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(unit.char)}</w:t></w:r></w:rubyBase></w:ruby>`;
  }).join("");
}

async function addNativeRuby(buffer: Buffer, lessons: LessonContent[], reviews: Record<number, PinyinUnit[]>) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("DOCX缺少document.xml");
  let xml = await entry.async("string");
  for (const lesson of lessons) {
    const units = reviews[lesson.lessonNumber];
    if (!units) continue;
    const escaped = escapeXml(lesson.readingExcerpt.text);
    const marker = `<w:t xml:space="preserve">${escaped}</w:t>`;
    const fallback = `<w:t>${escaped}</w:t>`;
    const target = xml.includes(marker) ? marker : fallback;
    if (!xml.includes(target)) throw new Error(`第${lesson.lessonNumber}讲阅读文段无法定位，未添加拼音`);
    xml = xml.replace(target, `</w:r>${rubyXml(units)}<w:r><w:t></w:t>`);
  }
  zip.file("word/document.xml", xml);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}
