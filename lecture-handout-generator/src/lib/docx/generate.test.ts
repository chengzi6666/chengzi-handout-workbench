import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { expandAnswerSpace, generateHandoutDocx } from "./generate";
import type { LessonContent } from "@/lib/handout/content-schema";

const lesson: LessonContent = {
  lessonNumber: 1, title: "测试课程", subtitle: "副标题", technique: "观察法", learningGoals: ["目标一", "目标二", "目标三"],
  curriculumAlignment: [{ claim: "课标对标", sourceUrl: "https://example.com/standard", sourceTitle: "标准", confirmed: true }],
  parentBusySteps: ["复述方法"], parentExtendedSteps: ["亲子讨论"], conversationTopics: Array.from({ length: 4 }, (_, index) => ({ question: `问题${index + 1}`, referenceAnswer: `答案${index + 1}` })),
  readingExcerpt: { text: "重阳节。", sourceFileId: "source-1", sourcePages: [1], sourceFingerprint: "1234567890abcdef", corrections: [], approved: true },
  closeReadingQuestions: ["想一想"], closeReadingAnswers: ["参考答案"], methodSummary: "先观察，再表达。", practice: [{ prompt: "练习", answer: "参考" }], littleTeacherSteps: ["说标题"], oralFramework: "我先……再……"
};

test("student docx contains five next-page sections and inline conversation answers", async () => {
  const output = await generateHandoutDocx({ projectName: "测试", grade: "0升1", teachingYear: 2026, lessons: [lesson], mode: "student" });
  const zip = await JSZip.loadAsync(output); const xml = await zip.file("word/document.xml")!.async("string");
  assert.equal((xml.match(/w:type w:val="nextPage"/g) ?? []).length, 5);
  assert.match(xml, /参考：答案1/);
  assert.doesNotMatch(xml, /参考答案：/);
});

test("answer document includes reading, practice, and oral reference sections", async () => {
  const output = await generateHandoutDocx({ projectName: "测试", grade: "1升2", teachingYear: 2026, lessons: [lesson], mode: "answers" });
  const zip = await JSZip.loadAsync(output); const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /一、阅读与方法题/);
  assert.match(xml, /二、真题带练／书面练习/);
  assert.match(xml, /三、“我是小老师”口头表达示例/);
  assert.match(xml, /参考答案/);
});

test("grade two reviewed pinyin is emitted as native Word ruby", async () => {
  const output = await generateHandoutDocx({ projectName: "测试", grade: "1升2", teachingYear: 2026, lessons: [lesson], pinyinReviews: { 1: [{ char: "重", pinyin: "chóng" }, { char: "阳", pinyin: "yáng" }, { char: "节", pinyin: "jié" }, { char: "。", pinyin: "" }] }, mode: "student" });
  const zip = await JSZip.loadAsync(output); const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /<w:ruby>/); assert.match(xml, /chóng/); assert.match(xml, /<w:rubyBase>/);
});

test("practice blanks reserve student writing space", () => {
  assert.equal(expandAnswerSpace("（ ）"), `（${"　".repeat(40)}）`);
  assert.equal(expandAnswerSpace("答案：*"), "答案：____________________");
});
