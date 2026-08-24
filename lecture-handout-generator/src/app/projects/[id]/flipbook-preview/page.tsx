import Link from "next/link";
import { redirect } from "next/navigation";
import { Flipbook } from "@/components/flipbook";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { lessonContentSchema } from "@/lib/handout/content-schema";
import { createPinyinReview, validatePinyinReview } from "@/lib/handout/pinyin";

export const dynamic = "force-dynamic";

function richPage(layoutConfig: unknown, lessonNumber: number, pageIndex: number) {
  const config = layoutConfig as { richPreviewHtml?: Record<string, string> } | null;
  return config?.richPreviewHtml?.[`student-${lessonNumber}-${pageIndex}`];
}

function previewPractice<T extends { imageSourceFileId?: string }>(items: T[]) {
  return items.map((item) => ({
    ...item,
    ...(item.imageSourceFileId ? { imageUrl: `/api/assets/source-file/${item.imageSourceFileId}` } : {}),
  }));
}

function pageBackground(project: { backgroundPack: { assets: Array<{ id: string; role: string }> } | null }, role: string) {
  const asset = project.backgroundPack?.assets.find((item) => item.role === role) ?? project.backgroundPack?.assets.find((item) => item.role === "SIMPLE");
  return asset ? `/api/assets/background/${asset.id}` : `/handout-backgrounds/${role === "READING" ? "mint-school.png" : role === "CONVERSATION" || role === "LITTLE_TEACHER" ? "blush-school.png" : "butter-school.png"}`;
}

export default async function FlipbookPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ownerId: user.id },
    include: { lessons: { orderBy: { lessonNumber: "asc" } }, backgroundPack: { include: { assets: true } } },
  });
  if (!project) redirect("/");

  const studentPages = project.lessons.flatMap((savedLesson) => {
    const lesson = lessonContentSchema.parse(savedLesson.structuredContent);
    return [
      {
        collection: "student",
        kind: "home",
        title: `第${savedLesson.lessonNumber}讲 ${lesson.title}`,
        subtitle: lesson.subtitle ?? "",
        body: lesson.learningGoals,
        technique: lesson.technique, richHtml: richPage(project.layoutConfig, savedLesson.lessonNumber, 0), backgroundSrc: pageBackground(project, "LESSON_HOME"),
      },
      { collection: "student", kind: "conversation", title: "课后交流话题", topics: lesson.conversationTopics, richHtml: richPage(project.layoutConfig, savedLesson.lessonNumber, 1), backgroundSrc: pageBackground(project, "CONVERSATION") },
      {
        collection: "student", kind: "reading",
        title: "阅读文段",
        text: lesson.readingExcerpt.text,
        pinyinUnits: project.grade === "1升2" ? (() => {
          const saved = savedLesson.pinyinReview as Array<{ char: string; pinyin: string }> | null;
          try { return saved ? validatePinyinReview(lesson.readingExcerpt.text, saved) : createPinyinReview(lesson.readingExcerpt.text); } catch { return createPinyinReview(lesson.readingExcerpt.text); }
        })() : undefined,
        practice: lesson.closeReadingQuestions, richHtml: richPage(project.layoutConfig, savedLesson.lessonNumber, 2), backgroundSrc: pageBackground(project, "READING"),
      },
      {
        collection: "student", kind: "practice",
        title: "课堂方法与真题带练",
        method: lesson.methodSummary,
        practice: previewPractice(lesson.practice), richHtml: richPage(project.layoutConfig, savedLesson.lessonNumber, 3), backgroundSrc: pageBackground(project, "PRACTICE"),
      },
      {
        collection: "student", kind: "teacher",
        title: "我是小老师",
        steps: lesson.littleTeacherSteps,
        framework: lesson.oralFramework, richHtml: richPage(project.layoutConfig, savedLesson.lessonNumber, 4), backgroundSrc: pageBackground(project, "LITTLE_TEACHER"),
      },
    ];
  });
  const parentBackground = pageBackground(project, "PARENT_MANUAL");
  const parentPages = [
    { collection: "parent", kind: "parent", title: "家长使用手册", subtitle: "—— 真读书 · 有深度 · 用得上 ——", backgroundSrc: parentBackground, body: ["🤝 双师陪伴｜主讲老师＋班主任老师", "主讲老师负责课程讲解、阅读方法和表达写作训练；班主任老师负责直播跟课、日常答疑、阶段反馈、薄弱点跟踪和学习规划。"] },
    { collection: "parent", kind: "parent", title: "五讲课程带来的能力提升", backgroundSrc: parentBackground, body: ["五讲合起来，孩子练习的是：读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。", ...project.lessons.map((savedLesson) => { const lesson = lessonContentSchema.parse(savedLesson.structuredContent); return `第${savedLesson.lessonNumber}讲《${lesson.title}》：${lesson.subtitle ?? lesson.technique}`; })] },
    { collection: "parent", kind: "parent", title: "五讲学习安排", backgroundSrc: parentBackground, body: project.lessons.map((savedLesson) => { const lesson = lessonContentSchema.parse(savedLesson.structuredContent); return `第${savedLesson.lessonNumber}讲《${lesson.title}》｜${lesson.technique}｜${lesson.learningGoals.map((goal) => goal.replace(/^我[们]?/u, "")).join("；")}`; }) },
    { collection: "parent", kind: "parent", title: `🎯 ${project.grade}阶段，最需要关注什么？`, backgroundSrc: parentBackground, body: ["基础：从“会认字”走向“会用字词”。", "阅读：从“听故事”走向“读懂故事”，能说清人物、事情、证据和道理。", "表达：从“说一句话”走向“完整表达”。", "💡 家长怎么配合？正课前后按讲义完成复述、笔记或书面练习，并由班主任给予跟踪反馈。"] }
  ];
  const answerPages = project.lessons.flatMap((savedLesson) => {
    const lesson = lessonContentSchema.parse(savedLesson.structuredContent);
    return [
      { collection: "answers", kind: "answer", title: `第${savedLesson.lessonNumber}讲参考答案`, topics: lesson.conversationTopics, backgroundSrc: pageBackground(project, "SIMPLE") },
      { collection: "answers", kind: "answer", title: "真题带练参考", practice: previewPractice(lesson.practice), backgroundSrc: pageBackground(project, "SIMPLE") }
    ];
  });
  const pages = [...parentPages, ...studentPages, ...answerPages];

  return (
    <>
      <div className="flipbook-preview-bar">
        <span>预览已配置 · 尚未公开发布</span>
        <Link href={`/projects/${project.id}/layout`}>返回版式工作台</Link>
      </div>
      <Flipbook
        title={project.name}
        description={`${project.grade} · ${project.season ?? "课程"} · 微信翻页书预览`}
        pages={pages}
        projectId={project.id}
        coverSrc={project.backgroundPack?.assets.find((asset) => asset.role === "COVER") ? `/api/assets/background/${project.backgroundPack?.assets.find((asset) => asset.role === "COVER")?.id}` : undefined}
        shareCoverSrc={project.backgroundPack?.assets.find((asset) => asset.role === "WECHAT_SHARE") ? `/api/assets/background/${project.backgroundPack?.assets.find((asset) => asset.role === "WECHAT_SHARE")?.id}` : undefined}
      />
    </>
  );
}
