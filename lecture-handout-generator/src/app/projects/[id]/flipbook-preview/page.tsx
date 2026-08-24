import Link from "next/link";
import { redirect } from "next/navigation";
import { Flipbook } from "@/components/flipbook";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { lessonContentSchema } from "@/lib/handout/content-schema";
import { createPinyinReview, validatePinyinReview } from "@/lib/handout/pinyin";

export const dynamic = "force-dynamic";

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
        technique: lesson.technique,
      },
      { collection: "student", kind: "conversation", title: "课后交流话题", topics: lesson.conversationTopics },
      {
        collection: "student", kind: "reading",
        title: "阅读文段",
        text: lesson.readingExcerpt.text,
        pinyinUnits: project.grade === "1升2" ? (() => {
          const saved = savedLesson.pinyinReview as Array<{ char: string; pinyin: string }> | null;
          try { return saved ? validatePinyinReview(lesson.readingExcerpt.text, saved) : createPinyinReview(lesson.readingExcerpt.text); } catch { return createPinyinReview(lesson.readingExcerpt.text); }
        })() : undefined,
        practice: lesson.closeReadingQuestions,
      },
      {
        collection: "student", kind: "practice",
        title: "课堂方法与真题带练",
        method: lesson.methodSummary,
        practice: lesson.practice,
      },
      {
        collection: "student", kind: "teacher",
        title: "我是小老师",
        steps: lesson.littleTeacherSteps,
        framework: lesson.oralFramework,
      },
    ];
  });
  const parentPages = [
    { collection: "parent", kind: "parent", title: "家长使用手册", subtitle: "—— 真读书 · 有深度 · 用得上 ——", body: ["双师陪伴：主讲老师负责课程讲解、阅读方法和表达写作训练；班主任老师负责直播跟课、答疑、反馈和学习规划。", "五讲合起来，孩子练习的是：读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。"] },
    { collection: "parent", kind: "parent", title: "五讲学习安排", body: project.lessons.map((savedLesson) => { const lesson = lessonContentSchema.parse(savedLesson.structuredContent); return `第${savedLesson.lessonNumber}讲《${lesson.title}》：${lesson.subtitle ?? lesson.technique}`; }) }
  ];
  const answerPages = project.lessons.flatMap((savedLesson) => {
    const lesson = lessonContentSchema.parse(savedLesson.structuredContent);
    return [
      { collection: "answers", kind: "answer", title: `第${savedLesson.lessonNumber}讲参考答案`, topics: lesson.conversationTopics },
      { collection: "answers", kind: "answer", title: "真题带练参考", practice: lesson.practice }
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
      />
    </>
  );
}
