import assert from "node:assert/strict";
import test from "node:test";
import type { LessonContent } from "./content-schema";
import { answerPageSpec, isCurrentParentRichPage, lessonPageSpec, pageSpecText, parentPageSpec } from "./page-spec";

const lesson: LessonContent = {
  lessonNumber: 1, title: "《没头脑和不高兴》", subtitle: "人事理法讲故事", technique: "人事理法讲故事", courseAlignment: "教材第一单元",
  learningGoals: ["说清人物", "找到证据", "讲清道理"], curriculumAlignment: [{ claim: "对标", sourceUrl: "https://example.com", sourceTitle: "标准", confirmed: true }],
  parentBusySteps: ["复述"], parentExtendedSteps: ["练习"], conversationTopics: Array.from({ length: 4 }, (_, i) => ({ question: `问题${i + 1}`, referenceAnswer: `答案${i + 1}` })),
  readingExcerpt: { text: "阅读原文。", sourceFileId: "source", sourcePages: [1], sourceFingerprint: "1234567890abcdef", corrections: [], approved: true },
  closeReadingQuestions: ["精读问题"], closeReadingAnswers: ["精读答案"], methodSummary: "先人物，再事情，最后道理。",
  practice: [{ prompt: "练习题", answer: "练习答案" }], littleTeacherSteps: ["先说人物"], oralFramework: "故事里有______。"
};

test("shared page specification contains every preview section without shortened fallback", () => {
  const student = lessonPageSpec(lesson, "哈哈");
  assert.equal(student.length, 5);
  const text = student.flatMap(pageSpecText).join("\n");
  for (const expected of ["家长使用提示", "阅读原文。", "精读问题", "方法小结", "先人物，再事情，最后道理。", "故事里有______。"]) assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const parent = parentPageSpec("1升2", [lesson], "高远");
  assert.equal(parent.length, 3);
  assert.match(pageSpecText(parent[0]).join("\n"), /家长使用手册[\s\S]*五讲课程带来的能力提升/u);
  assert.doesNotMatch(pageSpecText(parent[1]).join("\n"), /五讲课程带来的能力提升/u);
  assert.equal(isCurrentParentRichPage("家长使用手册 五讲课程带来的能力提升", 0), true);
  assert.equal(isCurrentParentRichPage("五讲课程带来的能力提升 五讲学习安排", 1), false);
  assert.match(pageSpecText(answerPageSpec(lesson)).join("\n"), /参考答案：练习答案/);
});
