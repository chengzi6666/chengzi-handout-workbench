import { writeFile } from "node:fs/promises";
import { generateHandoutDocx } from "../src/lib/docx/generate";
import type { LessonContent } from "../src/lib/handout/content-schema";

const lesson: LessonContent = {
  lessonNumber: 1, title: "爷爷一定有办法", subtitle: "奇妙的毯子", technique: "按顺序讲清变化",
  learningGoals: ["认真倾听故事，感受亲情。", "按顺序说清毯子的变化。", "用完整句表达自己的想法。"],
  curriculumAlignment: [{ claim: "发展语言运用能力", sourceUrl: "https://example.com", sourceTitle: "测试来源", confirmed: true }],
  parentBusySteps: ["请孩子用一分钟复述毯子的变化。"], parentExtendedSteps: ["找一件旧物，说说它背后的家庭故事。"],
  conversationTopics: [1, 2, 3, 4].map((n) => ({ question: `故事交流问题${n}是什么？`, referenceAnswer: `这是第${n}道问题的示例参考答案，家长可以继续追问孩子为什么。` })),
  readingExcerpt: { text: "重阳节到了，爷爷把旧毯子变成了一件温暖的外套。", sourceFileId: "qa", sourcePages: [1], sourceFingerprint: "1234567890abcdef", corrections: [], approved: true },
  closeReadingQuestions: ["爷爷为什么一次次改造旧毯子？", "你从故事中感受到了怎样的亲情？"], methodSummary: "先找出物品每一次变化，再用“先、接着、然后、最后”串起来。",
  practice: [{ prompt: "请按顺序说一说旧毯子的变化。", answer: "旧毯子先变成外套，接着又变成其他有用的物品。" }],
  littleTeacherSteps: ["先介绍故事人物。", "按顺序说清物品变化。", "最后说出自己的感受。"], oralFramework: "我先讲……接着讲……最后我感受到……"
};
const units = Array.from(lesson.readingExcerpt.text).map((char) => ({ char, pinyin: /[\u3400-\u9fff]/u.test(char) ? "pīn" : "" }));
async function main() {
  const data = await generateHandoutDocx({ projectName: "QA样张", grade: "1升2", teachingYear: 2026, lessons: [lesson], pinyinReviews: { 1: units }, mode: "student" });
  await writeFile(".tmp/handout-qa.docx", data);
}
void main();
