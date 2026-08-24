import {
  AlignmentType, Document, Footer, Header, HorizontalPositionRelativeFrom, ImageRun, PageNumber, Paragraph, Packer,
  SectionType, ShadingType, Table, TableCell, TableRow, TextRun, VerticalPositionRelativeFrom, WidthType, type ISectionOptions
} from "docx";
import JSZip from "jszip";
import type { LessonContent } from "@/lib/handout/content-schema";
import type { PinyinUnit } from "@/lib/handout/pinyin";
import { formatStudentBlank, studentOralFramework } from "@/lib/handout/student-format";

const FONT = "Microsoft YaHei";
const orange = "F07A42";
const gray = "6E655F";

export type HandoutDocumentInput = {
  projectName: string;
  grade: string;
  teachingYear: number;
  teacherFormalName?: string;
  teacherNickname?: string;
  headerText?: string;
  footerText?: string;
  noteOwnPage?: boolean;
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

function lessonBookTitle(value: string) {
  const match = value.match(/《[^》]+》/u);
  return match?.[0] ?? value.replace(/^第\s*\d+\s*讲[：:、\s]*/u, "").trim();
}

function lessonTitleBlock(lesson: LessonContent) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 70 }, children: [run(lessonBookTitle(lesson.title), { bold: true, size: 36, color: orange })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(`— “${lesson.technique.replace(/[—“”]/g, "").trim()}” —`, { bold: true, size: 24, color: "5B4B42" })] }),
    ...(lesson.subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [run(lesson.subtitle, { size: 22, color: gray })] })] : [])
  ];
}

function heading(text: string) {
  return new Paragraph({ spacing: { before: 180, after: 90 }, keepNext: true, children: [run(text, { bold: true, size: 25, color: orange })] });
}

function body(text: string, bold = false) {
  return new Paragraph({ spacing: { after: 100, line: 360 }, children: [run(expandAnswerSpace(text), { bold })] });
}

// 题目中的空括号和占位下划线必须给孩子留下可书写的空间，而不是只留两个字符。
export function expandAnswerSpace(text: string) {
  return formatStudentBlank(text);
}

function numbered(items: string[]) {
  return items.map((item, index) => body(`${index + 1}. ${item}`));
}

function footer(text?: string) {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`${text ?? "真读书 · 有深度 · 用得上"}  ·  `, { size: 17, color: "A79D96" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 17, color: "A79D96" })] })] });
}

function backgroundHeader(image?: ImageAsset, text?: string) {
  const children: Paragraph[] = [];
  if (image) children.push(new Paragraph({ children: [new ImageRun({ ...image, transformation: { width: 794, height: 1123 }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, allowOverlap: true } })] }));
  if (text) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run(text, { size: 16, color: "A79D96" })] }));
  return children.length ? new Header({ children }) : undefined;
}

function section(children: Array<Paragraph | Table>, background?: ImageAsset, input?: HandoutDocumentInput): ISectionOptions {
  return {
    properties: { type: SectionType.NEXT_PAGE, page: { margin: { top: 850, right: 850, bottom: 760, left: 850, header: 0, footer: 360 } } },
    headers: background || input?.headerText ? { default: backgroundHeader(background, input?.headerText) } : undefined,
    footers: { default: footer(input?.footerText) },
    children
  };
}

function pickBackground(input: HandoutDocumentInput, role: keyof NonNullable<HandoutDocumentInput["backgrounds"]>) { return input.backgrounds?.[role] ?? input.backgrounds?.SIMPLE; }

function teacherParagraph(input: HandoutDocumentInput) {
  if (!input.teacherImage) return [];
  const pos = input.teacherPosition ?? { x: 67, y: 57, width: 25, height: 30 };
  return [new Paragraph({ children: [new ImageRun({ ...input.teacherImage, transformation: { width: Math.round(794 * pos.width / 100), height: Math.round(1123 * pos.height / 100) }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(794 * pos.x / 100 * 9525) }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(1123 * pos.y / 100 * 9525) }, behindDocument: false, allowOverlap: true } })] })];
}

function parentTeacherTable(input: HandoutDocumentInput) {
  const image = input.teacherPortrait ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ ...input.teacherPortrait, transformation: { width: 130, height: 130 } })] })] : [body("主讲老师")];
  const introduction = teacherIntroduction(input.teacherFormalName);
  return new Table({ width: { size: 7600, type: WidthType.DXA }, rows: [new TableRow({ children: [
    new TableCell({ width: { size: 1900, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "F5F0EA", fill: "FFF8F2" }, children: image }),
    new TableCell({ width: { size: 5700, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "F5F0EA", fill: "FFF8F2" }, children: introduction.split("\n").map((line, i) => new Paragraph({ spacing: { after: i ? 0 : 80 }, children: [run(line, { bold: i === 0, size: i === 0 ? 24 : 21, color: i === 0 ? orange : "4D423A" })] })) })
  ] })] });
}

function teacherIntroduction(name?: string) {
  const records: Record<string, string> = {
    "吴晨晨": "吴晨晨老师｜主讲老师\n毕业于加拿大英属哥伦比亚大学；国内和国际教师资格双认证。课堂注重用故事和方法帮助孩子建立阅读兴趣与表达自信。",
    "高远": "高远老师｜主讲老师\n学而思网校读写课程主讲老师，毕业于哈佛大学，拥有4年语文读写教学经验；研究方向为儿童语言与读写能力发展。",
    "张驰": "张驰老师｜主讲老师\n毕业于北京大学，北京大学中文系本科；获发展与教育心理学硕士。学而思小学语文教师培训负责人。",
    "唐润然": "唐润然老师｜主讲老师\n复旦大学硕士，深耕小学语文读写教学9年+；注重“授人以渔”，帮助孩子形成自己的学习方法和自主学习习惯。",
    "陈超": "陈超老师｜主讲老师\n北京大学中文系本科、古代文学专业硕士；13年教学经验，曾任学而思培优语文负责人，负责多套语文产品研发。",
  };
  return records[name ?? ""] ?? "主讲老师｜负责阅读方法、表达写作和课堂互动引导。";
}

function practiceImage(input: HandoutDocumentInput, pageId?: string, fileId?: string) {
  const image = pageId ? input.practiceImages?.[pageId] : fileId ? input.practiceImages?.[fileId] : undefined;
  return image ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new ImageRun({ ...image, transformation: { width: 480, height: 320 } })] })] : [];
}

function calloutTable(lines: string[], fill = "FFF8F2") {
  const paragraphs = lines.map((line, index) => new Paragraph({
    spacing: { after: index === lines.length - 1 ? 30 : 70 },
    children: [run(line, { bold: index === 0, size: index === 0 ? 24 : 21, color: index === 0 ? orange : "493D36" })]
  }));
  return new Table({ width: { size: 7600, type: WidthType.DXA }, rows: [new TableRow({ children: [new TableCell({
    width: { size: 7600, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "F5E1D5", fill }, children: paragraphs
  })] })] });
}

function studentParentChoiceTable() {
  return calloutTable([
    "📱 忙碌时（5分钟搞定）",
    "① 让孩子按第五部分【我是小老师】的口头框架讲一遍故事；② 录1分钟左右的小视频，发到班级群；③ 老师会1对1批改、点评。",
    "📚 学有余力时（写一写）",
    "① 让孩子完成第四部分【真题带练】的书面练习；② 拍照或文档发到班级群/私发给老师；③ 老师会1对1批改、点评。"
  ], "FFFDF8");
}

function noteTable() {
  return new Table({ width: { size: 7600, type: WidthType.DXA }, rows: [new TableRow({ children: [new TableCell({ width: { size: 7600, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "F2E5D9", fill: "FFFCF8" }, children: [
    new Paragraph({ children: [run("📖 笔记", { bold: true, size: 23, color: orange })] }),
    new Paragraph({ spacing: { before: 80, after: 720 }, children: [run("")] }),
    new Paragraph({ spacing: { after: 720 }, children: [run("")] }),
    new Paragraph({ spacing: { after: 360 }, children: [run("")] })
  ] })] })] });
}

function lessonSections(lesson: LessonContent, input: HandoutDocumentInput) {
  const p1 = section([
    ...lessonTitleBlock(lesson),
    heading("🎯 一、本讲要学什么"),
    calloutTable(["本讲对标", lesson.courseAlignment ?? "本讲教材对标待生成，请重新生成文字初稿后核对。", "学习目标", ...lesson.learningGoals.map((goal, index) => `${index + 1}. ${goal}`)])
  ], pickBackground(input, "LESSON_HOME"), input);
  const p2 = section([
    ...title("💡 二、家长使用提示", "【二选一】"), studentParentChoiceTable(),
    heading("💬 下课后，建议家长可以和孩子交流的话题"),
    ...lesson.conversationTopics.flatMap((topic, index) => [heading(`${index + 1}. ${topic.question}`), body(`参考：${topic.referenceAnswer}`)])
  ], pickBackground(input, "CONVERSATION"), input);
  const p3 = section([
    ...title("📖 三、精读片段"), heading("📖 课文片段"), body(lesson.readingExcerpt.text),
    heading("💡 精读批注"), ...numbered(lesson.closeReadingQuestions), ...(input.noteOwnPage ? [] : [noteTable()])
  ], pickBackground(input, "READING"), input);
  const notePage = input.noteOwnPage ? section([
    ...title("📖 阅读笔记"),
    noteTable()
  ], pickBackground(input, "READING"), input) : null;
  const p4 = section([
    ...title(`🌟 四、${input.teacherNickname ?? "主讲"}老师课堂 · 真题带练`), heading("本讲方法"), body(lesson.methodSummary), heading("练一练"),
    ...lesson.practice.flatMap((item, index) => [body(`${index + 1}. ${item.prompt}`, true), ...practiceImage(input, item.imageSourcePageId, item.imageSourceFileId), body("我的作答：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿")]), ...teacherParagraph(input)
  ], pickBackground(input, "PRACTICE"), input);
  const p5 = section([
    ...title("🎤 五、我是小老师"), heading("🎯 作答步骤"), ...numbered(lesson.littleTeacherSteps), heading("🎤 口头表达示范框架"), body(studentOralFramework(lesson))
  ], pickBackground(input, "LITTLE_TEACHER"), input);
  return [p1, p2, p3, ...(notePage ? [notePage] : []), p4, p5];
}

function parentSections(input: HandoutDocumentInput) {
  const gradeName = input.grade.replace("升", "年级升").replace(/^0年级升1$/, "一年级").replace(/^(\d)年级升(\d)$/, "$2年级");
  const capability = input.lessons.map((lesson) => `第${lesson.lessonNumber}讲《${lesson.title}》：${lesson.subtitle || lesson.technique}`).join("；");
  const overview = section([
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 60 }, children: [run("家长使用手册", { bold: true, size: 36, color: orange })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 150 }, children: [run("—— 真读书 · 有深度 · 用得上 ——", { size: 22, color: gray })] }),
    parentTeacherTable(input),
    heading("🤝 双师陪伴｜主讲老师＋班主任老师"),
    body(`${input.teacherFormalName ? `${input.teacherFormalName}老师` : "主讲老师"}负责课程讲解、阅读方法和表达写作训练；班主任老师负责直播跟课、日常答疑、阶段反馈、薄弱点跟踪和学习规划。两位老师共同陪伴一个孩子。`),
    heading("📚 五讲课程带来的能力提升"), body(capability),
    heading("五讲合起来，孩子练习的是："), body("读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。"),
    heading(`🎯 ${gradeName}阶段，最需要关注什么？`),
    body(`基础：结合${input.teachingYear}年课程学习节奏，从“会认字”走向“会用字词”，让孩子在故事语境中把字词读懂、用上。`),
    body("阅读：从“听故事”走向“读懂故事”，能说清人物、事情、证据和道理。"),
    body("表达：从“说一句话”走向“完整表达”，逐步写清人物、事情、动作、语言、心情和结果。"),
    heading("💡 家长怎么配合？"), ...numbered(["正课时间为19:00-19:40；课前10分钟和课后10分钟由班主任老师统一带领预习、复习，无需家长提前筹备。", "基础巩固：提交本讲笔记；课业紧张：参考讲义【第五部分】口头表达框架，录制1分钟左右复习小视频。", "学有余力：完成讲义【第四部分】书面练习，发班级群或私发老师获取批改点评。", "忙碌时，让孩子按【我是小老师】口头框架讲一遍故事；学有余力时，完成【真题带练】书面练习。"])
  ], pickBackground(input, "PARENT_MANUAL"), input);
  const schedule = section([
    ...title("五讲学习安排", "每讲学什么 · 家长怎么陪"),
    ...input.lessons.flatMap((lesson) => [
      heading(`第${lesson.lessonNumber}讲  ${lesson.title}`),
      body(`课堂方法：${lesson.technique}`, true),
      body(`课后建议：${lesson.parentBusySteps[0] ?? "请孩子用自己的话复述今天的一个方法。"}`),
      body(`交流重点：${lesson.conversationTopics[0]?.question ?? "请孩子说说今天学到的内容。"}`)
    ])
  ], pickBackground(input, "PARENT_MANUAL"), input);
  return [overview, schedule];
}

function coverSections(input: HandoutDocumentInput) {
  const cover = pickBackground(input, "COVER");
  return [section(cover ? [new Paragraph({ children: [run("")] })] : [
    ...title(input.projectName, `${input.grade} · ${input.teachingYear}年`),
    body(input.teacherFormalName ? `主讲：${input.teacherFormalName}老师` : "小学语文读写综合能力提升")
  ], cover, input)];
}

function answerSections(input: HandoutDocumentInput) {
  return input.lessons.map((lesson) => section([
    ...title(`第${lesson.lessonNumber}讲参考答案`, lesson.title),
    body("使用说明：客观题给出明确答案；开放题提供一种完整示例，合理、有依据、表达通顺即可，不要求与示例完全一致。"),
    heading("一、阅读与方法题"), ...lesson.closeReadingQuestions.flatMap((question, index) => [body(question, true), body(lesson.closeReadingAnswers[index] ?? "参考：请结合原文中的词句或具体情节作答。")]),
    heading("二、真题带练／书面练习"), ...lesson.practice.flatMap((item, index) => [body(`${index + 1}. ${item.prompt}`, true), body(`示例：${item.answer}`)]),
    heading("三、“我是小老师”口头表达示例"), body((lesson as LessonContent & { oralReferenceAnswer?: string }).oralReferenceAnswer ?? lesson.oralFramework), body("★ 开放题答案不唯一，重点看是否使用本讲方法。")
  ], pickBackground(input, "SIMPLE"), input));
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
