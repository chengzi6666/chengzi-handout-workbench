import type { LessonContent } from "./content-schema";

export type SharedPageRole = "LESSON_HOME" | "CONVERSATION" | "READING" | "PRACTICE" | "LITTLE_TEACHER" | "PARENT_MANUAL" | "ANSWERS";
export type SharedBlock = { kind: "title" | "heading" | "text" | "numbered" | "callout"; text: string; items?: string[] };
export type SharedPage = { role: SharedPageRole; blocks: SharedBlock[] };

// Single source of page text. Web preview, flipbook and DOCX must consume this
// instead of recreating their own shortened variants.
export function lessonPageSpec(lesson: LessonContent, teacherName = "主讲"): SharedPage[] {
  return [
    { role: "LESSON_HOME", blocks: [
      { kind: "title", text: lesson.title }, { kind: "text", text: `— “${lesson.technique.replace(/[—“”]/g, "").trim()}” —` }, { kind: "text", text: lesson.subtitle ?? "" },
      { kind: "heading", text: "🎯 一、本讲要学什么" }, { kind: "callout", text: "本讲对标", items: [lesson.courseAlignment ?? "", "学习目标：", ...lesson.learningGoals.map((goal, index) => `${index + 1}. ${goal}`)] },
      { kind: "heading", text: "💡 二、家长使用提示　【二选一】" },
      { kind: "callout", text: "📱 忙碌时（5分钟搞定）", items: ["① 让孩子按第五部分【我是小老师】的口头框架讲一遍故事；", "② 录1分钟左右的小视频，发到班级群；", "③ 老师会1对1批改、点评。", "📚 学有余力时（写一写）", "① 让孩子完成第四部分【真题带练】的5行填空；", "② 拍照或文档发到班级群／私发给老师；", "③ 老师会1对1批改、点评。"] }
    ] },
    { role: "CONVERSATION", blocks: [{ kind: "title", text: "下课后，建议家长可以和孩子交流的话题" }, ...lesson.conversationTopics.flatMap((item, index) => [{ kind: "heading" as const, text: `${index + 1}. ${item.question}` }, { kind: "text" as const, text: `参考：${item.referenceAnswer}` }])] },
    { role: "READING", blocks: [{ kind: "title", text: "阅读文段" }, { kind: "text", text: lesson.readingExcerpt.text }, { kind: "heading", text: "精读思考" }, { kind: "numbered", text: "", items: lesson.closeReadingQuestions }] },
    { role: "PRACTICE", blocks: [{ kind: "title", text: `🌟 四、${teacherName}老师课堂 · 真题带练` }, { kind: "heading", text: "方法小结" }, { kind: "text", text: lesson.methodSummary }, { kind: "heading", text: "练一练" }, { kind: "numbered", text: "", items: lesson.practice.map((item) => item.prompt) }] },
    { role: "LITTLE_TEACHER", blocks: [{ kind: "title", text: "🎤 五、我是小老师" }, { kind: "heading", text: "🎯 作答步骤" }, { kind: "numbered", text: "", items: lesson.littleTeacherSteps }, { kind: "heading", text: "🎤 口头表达示范框架" }, { kind: "text", text: lesson.oralFramework }] },
  ];
}

export function pageSpecText(page: SharedPage) {
  return page.blocks.flatMap((block) => block.items?.length ? [block.text, ...block.items] : [block.text]).filter(Boolean);
}

export function defaultLessonBodySize(pageIndex: number, lesson: LessonContent) {
  const length = pageIndex === 0 ? (lesson.courseAlignment?.length ?? 0) + lesson.learningGoals.join("").length
    : pageIndex === 1 ? lesson.conversationTopics.reduce((sum, item) => sum + item.question.length + item.referenceAnswer.length, 0)
      : pageIndex === 2 ? lesson.readingExcerpt.text.length + lesson.closeReadingQuestions.join("").length
        : pageIndex === 3 ? lesson.methodSummary.length + lesson.practice.reduce((sum, item) => sum + item.prompt.length, 0)
          : lesson.littleTeacherSteps.join("").length + lesson.oralFramework.length;
  return length > 900 ? 8 : length > 680 ? 9 : length > 480 ? 10 : 11;
}

export function parentPageSpec(grade: string, lessons: LessonContent[], teacherName = "主讲", teacherIntroduction = "负责阅读方法、表达写作和课堂互动引导。"): SharedPage[] {
  return [
    { role: "PARENT_MANUAL", blocks: [{ kind: "title", text: "家长使用手册" }, { kind: "text", text: "—— 真读书 · 有深度 · 用得上 ——" }, { kind: "heading", text: `${teacherName}老师｜主讲老师` }, { kind: "text", text: teacherIntroduction }, { kind: "heading", text: "🤝 双师陪伴｜主讲老师＋班主任老师" }, { kind: "callout", text: "", items: [`${teacherName}老师负责课程讲解、阅读方法和表达写作训练；班主任老师负责直播跟课、日常答疑、阶段反馈、薄弱点跟踪和学习规划，两位老师共同陪伴一个孩子。`] }, { kind: "title", text: "五讲课程带来的能力提升" }, { kind: "text", text: "五讲合起来，孩子练习的是：读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。" }] },
    { role: "PARENT_MANUAL", blocks: [{ kind: "heading", text: "五讲学习安排" }, ...lessons.map((lesson) => ({ kind: "callout" as const, text: `第${lesson.lessonNumber}讲｜${lesson.title}｜${lesson.technique}`, items: lesson.learningGoals.map((goal, index) => `${index + 1}. ${goal}`) }))] },
    { role: "PARENT_MANUAL", blocks: [{ kind: "title", text: `🎯 ${grade}阶段，最需要关注什么？` }, { kind: "heading", text: "☁️ 基础：从“会认字”走向“会用字词”" }, { kind: "text", text: "在故事语境中认识并积累字词，不只会读，还能联系人物、动作和情节理解词义；通过圈画、复述与句式练习，把常用表达用到自己的口头和书面表达中。" }, { kind: "heading", text: "📚 阅读：从“听故事”走向“读懂故事”" }, { kind: "text", text: "不止复述热闹情节，还要能说清“谁做了什么、为什么这样做、结果怎样”，并从原文中找到具体词句作证据，逐步形成整本书阅读习惯。" }, { kind: "heading", text: "✍️ 表达：从“说一句话”走向“完整表达”" }, { kind: "text", text: "借助课堂方法，把人物、事情、动作、语言、心情和结果说完整、写清楚；每周完成一次口头表达或简短书面练习，形成可迁移的表达框架。" }, { kind: "heading", text: "💡 家长怎么配合？" }, { kind: "callout", text: "", items: ["正课时间：19:00-19:40。课前10分钟＋课后10分钟由班主任老师统一带领预习、复习，无需家长提前筹备。", "课业紧张时，按第五部分口头框架录1分钟复习视频；学有余力时，完成第四部分书面练习并提交老师批改。"] }] }
  ];
}

export function isCurrentParentRichPage(value: string, pageIndex: number) {
  if (pageIndex === 0) return value.includes("家长使用手册") && value.includes("五讲课程带来的能力提升");
  if (pageIndex === 1) return value.includes("五讲学习安排") && !value.includes("五讲课程带来的能力提升");
  return true;
}

export function answerPageSpec(lesson: LessonContent): SharedPage {
  return { role: "ANSWERS", blocks: [{ kind: "title", text: `第${lesson.lessonNumber}讲参考答案` }, { kind: "heading", text: "交流话题参考" }, ...lesson.conversationTopics.flatMap((item, index) => [{ kind: "heading" as const, text: `${index + 1}. ${item.question}` }, { kind: "text" as const, text: `参考：${item.referenceAnswer}` }]), { kind: "heading", text: "真题带练参考" }, ...lesson.practice.flatMap((item, index) => [{ kind: "heading" as const, text: `${index + 1}. ${item.prompt}` }, { kind: "text" as const, text: `参考答案：${item.answer}` }])] };
}
