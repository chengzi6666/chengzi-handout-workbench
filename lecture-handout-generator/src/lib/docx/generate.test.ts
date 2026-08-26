import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { expandAnswerSpace, generateHandoutDocx } from "./generate";
import type { LessonContent } from "@/lib/handout/content-schema";
import { formatStudentBlank, normalizeStudentFacingContent } from "@/lib/handout/student-format";

const lesson: LessonContent = {
  lessonNumber: 1, title: "测试课程", subtitle: "副标题", technique: "观察法", learningGoals: ["目标一", "目标二", "目标三"],
  curriculumAlignment: [{ claim: "课标对标", sourceUrl: "https://example.com/standard", sourceTitle: "标准", confirmed: true }],
  parentBusySteps: ["复述方法"], parentExtendedSteps: ["亲子讨论"], conversationTopics: Array.from({ length: 4 }, (_, index) => ({ question: `问题${index + 1}`, referenceAnswer: `答案${index + 1}` })),
  readingExcerpt: { text: "重阳节。", sourceFileId: "source-1", sourcePages: [1], sourceFingerprint: "1234567890abcdef", corrections: [], approved: true },
  closeReadingQuestions: ["想一想"], closeReadingAnswers: ["参考答案"], methodSummary: "先观察，再表达。", practice: [{ prompt: "练习", answer: "参考" }], littleTeacherSteps: ["说标题"], oralFramework: "我先……再……"
};

function assertWellFormedXml(xml: string) {
  const stack: string[] = [];
  for (const match of xml.matchAll(/<(\/)?([\w:.-]+)(?:\s[^<>]*)?\/?\s*>/gu)) {
    const closing = match[1];
    const name = match[2];
    if (!name || name.startsWith("?")) continue;
    if (closing) assert.equal(stack.pop(), name, `DOCX XML 标签未正确闭合：${name}`);
    else if (!match[0].endsWith("/>") ) stack.push(name);
  }
  assert.equal(stack.length, 0, "DOCX XML 存在未闭合标签");
}

test("student docx contains five next-page sections and inline conversation answers", async () => {
  const output = await generateHandoutDocx({ projectName: "测试", grade: "0升1", teachingYear: 2026, lessons: [lesson], mode: "student" });
  const zip = await JSZip.loadAsync(output); const xml = await zip.file("word/document.xml")!.async("string");
  assert.equal((xml.match(/w:type w:val="nextPage"/g) ?? []).length, 5);
  assert.match(xml, /参考：答案1/);
  assert.doesNotMatch(xml, /参考答案：/);
  assert.equal((xml.match(/<w:p(?:\s[^>]*)?>/g) ?? []).length, (xml.match(/<w:kinsoku\/>/g) ?? []).length, "每个Word段落都应启用中文避头尾规则");
});

test("answer document uses the same conversation and practice sections as preview", async () => {
  const output = await generateHandoutDocx({ projectName: "测试", grade: "1升2", teachingYear: 2026, lessons: [lesson], mode: "answers" });
  const zip = await JSZip.loadAsync(output); const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /交流话题参考/);
  assert.match(xml, /参考：答案1/);
  assert.match(xml, /真题带练参考/);
  assert.match(xml, /参考答案：参考/);
  assert.doesNotMatch(xml, /我是小老师.*口头表达示例/);
});

test("grade two reviewed pinyin is emitted as native Word ruby", async () => {
  const output = await generateHandoutDocx({ projectName: "测试", grade: "1升2", teachingYear: 2026, lessons: [lesson], pinyinReviews: { 1: [{ char: "重", pinyin: "chóng" }, { char: "阳", pinyin: "yáng" }, { char: "节", pinyin: "jié" }, { char: "。", pinyin: "" }] }, pageTypography: { "student-1-2": { bodySize: 13 } }, mode: "student" });
  const zip = await JSZip.loadAsync(output); const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /<w:r><w:ruby>/, "Word ruby 必须包在外层文本 run 中");
  assert.doesNotMatch(xml, /<w:pPr>[^]*?<\/w:pPr><w:ruby>/u, "ruby 不能作为段落的直接子节点");
  assert.match(xml, /chóng/); assert.match(xml, /<w:rubyBase>/);
  assert.match(xml, /<w:rubyBase><w:r><w:rPr>[^]*?<w:sz w:val="26"\/>[^]*?<w:t>重<\/w:t>/u, "汉字基文必须存在且遵守阅读页字号");
  const baseText = [...xml.matchAll(/<w:rubyBase>[^]*?<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>[^]*?<\/w:rubyBase>/gu)].map((match) => match[1]).join("");
  assert.equal(baseText, "重阳节", "启用拼音后仍必须保留全部汉字基文");
  assert.match(xml, /<w:t xml:space="preserve">。<\/w:t>/u, "启用拼音后仍必须保留普通标点");
  assertWellFormedXml(xml);
});

test("practice blanks reserve student writing space", () => {
  const bracket = expandAnswerSpace("（ ）");
  assert.match(bracket, /^（_+）$/u);
  assert.equal(bracket.length, 42);
  assert.equal(expandAnswerSpace("人物是------。"), "人物是____________________。");
  assert.ok(expandAnswerSpace("答案：*").length >= 22);
  const student = normalizeStudentFacingContent(lesson);
  assert.match(student.oralFramework, /_{20}/u);
  assert.equal(student.oralReferenceAnswer, lesson.oralFramework);
});

test("refreshing a partial legacy lesson never crashes student normalization", () => {
  const partial = { lessonNumber: 1, title: "生成中", technique: "阅读方法" } as LessonContent;
  assert.doesNotThrow(() => normalizeStudentFacingContent(partial));
  assert.deepEqual(normalizeStudentFacingContent(partial).practice, []);
});

test("parent manual follows the family guidance structure", async () => {
  const lessons = Array.from({ length: 5 }, (_, index) => ({ ...lesson, lessonNumber: index + 1, title: `第${index + 1}讲测试课程` }));
  const output = await generateHandoutDocx({ projectName: "测试", grade: "1升2", teachingYear: 2026, teacherFormalName: "高远", lessons, mode: "parent" });
  const zip = await JSZip.loadAsync(output); const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /家长使用手册/);
  assert.match(xml, /双师陪伴/);
  assert.match(xml, /五讲课程带来的能力提升/);
  assert.match(xml, /家长怎么配合/);
  assert.match(xml, /高远老师/);
  assert.match(xml, /讲次名称/);
  assert.match(xml, /w:pgSz w:w="11906" w:h="16838"/u);
  assert.doesNotMatch(xml, /w:tblW w:type="dxa" w:w="7600"/u);
  const tableWidths = [...xml.matchAll(/w:tblW w:type="dxa" w:w="(\d+)"/gu)].map((match) => Number(match[1]));
  assert.ok(tableWidths.length >= 4);
  assert.ok(tableWidths.every((width) => width === 10206));
  assert.ok(xml.indexOf("五讲课程带来的能力提升") < xml.indexOf("五讲学习安排"));
  assert.match(xml, /w:tblHeader/u);
  assert.ok((xml.match(/w:type w:val="nextPage"/g) ?? []).length >= 3);
});

test("every generated Word section can carry the same page background as the preview", async () => {
  const background = { data: Buffer.from(await readFile(join(process.cwd(), "public", "handout-backgrounds", "blush-school.png"))), type: "png" as const };
  const output = await generateHandoutDocx({
    projectName: "测试", grade: "1升2", teachingYear: 2026, lessons: [lesson], mode: "parent",
    backgrounds: { PARENT_MANUAL: background },
  });
  const zip = await JSZip.loadAsync(output);
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /w:headerReference/u);
  assert.ok(Object.keys(zip.files).some((name) => /^word\/header\d+\.xml$/u.test(name)));
  assert.ok(Object.keys(zip.files).some((name) => /^word\/media\//u.test(name)));
});

test("combined parent and student export keeps every handbook and lesson section", async () => {
  const lessons = Array.from({ length: 5 }, (_, index) => ({ ...lesson, lessonNumber: index + 1, title: `第${index + 1}讲测试课程` }));
  const output = await generateHandoutDocx({ projectName: "测试", grade: "1升2", teachingYear: 2026, lessons, mode: "student", includeParentManual: true });
  const zip = await JSZip.loadAsync(output); const xml = await zip.file("word/document.xml")!.async("string");
  assertWellFormedXml(xml);
  assert.match(xml, /家长使用手册/);
  for (let index = 1; index <= 5; index += 1) assert.match(xml, new RegExp(`第${index}讲`, "u"));
  // 家长手册为三页（第二页合并能力提升和五讲安排），每讲固定五页。
  assert.ok((xml.match(/w:type w:val="nextPage"/g) ?? []).length >= 28);
});
