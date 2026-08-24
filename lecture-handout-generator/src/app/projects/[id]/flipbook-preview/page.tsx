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

  const pages = project.lessons.flatMap((savedLesson) => {
    const lesson = lessonContentSchema.parse(savedLesson.structuredContent);
    return [
      {
        kind: "home",
        title: `第${savedLesson.lessonNumber}讲 ${lesson.title}`,
        subtitle: lesson.subtitle ?? "",
        body: lesson.learningGoals,
        technique: lesson.technique,
      },
      { kind: "conversation", title: "课后交流话题", topics: lesson.conversationTopics },
      {
        kind: "reading",
        title: "阅读文段",
        text: lesson.readingExcerpt.text,
        pinyinUnits: project.grade === "1升2" ? (() => {
          const saved = savedLesson.pinyinReview as Array<{ char: string; pinyin: string }> | null;
          try { return saved ? validatePinyinReview(lesson.readingExcerpt.text, saved) : createPinyinReview(lesson.readingExcerpt.text); } catch { return createPinyinReview(lesson.readingExcerpt.text); }
        })() : undefined,
        practice: lesson.closeReadingQuestions,
      },
      {
        kind: "practice",
        title: "课堂方法与真题带练",
        method: lesson.methodSummary,
        practice: lesson.practice,
      },
      {
        kind: "teacher",
        title: "我是小老师",
        steps: lesson.littleTeacherSteps,
        framework: lesson.oralFramework,
      },
    ];
  });

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
        coverSrc={project.backgroundPack?.assets.find((asset) => asset.role === "COVER") ? `/api/assets/background/${project.backgroundPack?.assets.find((asset) => asset.role === "COVER")?.id}` : undefined}
      />
    </>
  );
}
