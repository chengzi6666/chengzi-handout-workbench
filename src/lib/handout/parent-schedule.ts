import type { LessonContent } from "./content-schema";

const conciseScheduleContent: Record<number, string> = {
  1: "从人物、事情、道理三个角度复述故事；积累“包”字族：饱、泡、抱、炮。",
  2: "用“我认为—因为什么—比如—所以”说清观点；积累足字旁：跳、跑、踢、跟。",
  3: "抓住人物的手部、脚部动作，把活动画面写具体；积累“青”字族：晴、清、睛、请。",
  4: "写清谁需要帮助、如何帮助和礼貌回应；积累竖心旁：惊、怕、快、忧。",
  5: "读懂笨狼学习使用电话和门铃的故事；运用“口诀法”写清犯错、劝导、改正和成长的过程。",
};

export function parentScheduleContent(lesson: Pick<LessonContent, "lessonNumber" | "learningGoals">) {
  return conciseScheduleContent[lesson.lessonNumber] ?? lesson.learningGoals.join("；");
}
