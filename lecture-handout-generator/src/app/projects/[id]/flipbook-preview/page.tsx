import Link from "next/link";
import { redirect } from "next/navigation";
import { Flipbook } from "@/components/flipbook";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { lessonContentSchema } from "@/lib/handout/content-schema";
import { createPinyinReview, validatePinyinReview } from "@/lib/handout/pinyin";
import { defaultBackgroundPath } from "@/lib/handout/backgrounds";
import { answerPageSpec, defaultLessonBodySize, isCurrentParentRichPage, lessonPageSpec, parentPageSpec } from "@/lib/handout/page-spec";

export const dynamic = "force-dynamic";

function richPage(layoutConfig: unknown, collection: "student" | "answers" | "parent", lessonNumber: number, pageIndex: number) {
  const config = layoutConfig as { richPreviewHtml?: Record<string, string> } | null;
  const value = config?.richPreviewHtml?.[`${collection}-${lessonNumber}-${pageIndex}`];
  return value && !/(?:请结合本讲|补充方法小结)/u.test(value) && (collection !== "parent" || isCurrentParentRichPage(value, pageIndex)) ? value : undefined;
}

function pageChrome(layoutConfig: unknown) {
  const config = layoutConfig as { headerText?: string; footerText?: string; fontFamily?: string } | null;
  return { headerText: config?.headerText ?? "", footerText: config?.footerText ?? "", fontFamily: config?.fontFamily ?? "Microsoft YaHei" };
}

function pageType(layoutConfig: unknown, key: string, fallback = 11) {
  const config = layoutConfig as { fontSize?: number; pageTypography?: Record<string, { bodySize?: number; titleSize?: number }> } | null;
  const item = config?.pageTypography?.[key];
  return { bodySize: item?.bodySize ?? config?.fontSize ?? fallback, titleSize: item?.titleSize ?? 20 };
}

function previewPractice<T extends { imageSourceFileId?: string }>(items: T[]) {
  return items.map((item) => ({
    ...item,
    ...(item.imageSourceFileId ? { imageUrl: `/api/assets/source-file/${item.imageSourceFileId}` } : {}),
  }));
}

function pageBackground(project: { backgroundPack: { assets: Array<{ id: string; role: string }> } | null }, role: string) {
  const asset = project.backgroundPack?.assets.find((item) => item.role === role) ?? project.backgroundPack?.assets.find((item) => item.role === "SIMPLE");
  return asset ? `/api/assets/background/${asset.id}` : defaultBackgroundPath(role);
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
    include: { lessons: { orderBy: { lessonNumber: "asc" } }, backgroundPack: { include: { assets: true } }, teacher: { include: { assets: true } } },
  });
  if (!project) redirect("/");

  type TeacherPosition = { assetId?: string; x?: number; y?: number; width?: number; height?: number };
  const layout = project.layoutConfig as { teacherImage?: TeacherPosition; teacherImages?: Record<string, TeacherPosition> } | null;
  const defaultTeacherKey = ({ "0升1": "0l1", "1升2": "1l2", "2升3": "2l3", "3升4": "3l4", "4升5": "4l5" } as Record<string, string>)[project.grade] ?? "1l2";
  const studentPages = project.lessons.flatMap((savedLesson) => {
    const lesson = lessonContentSchema.parse(savedLesson.structuredContent);
    const specs = lessonPageSpec(lesson, project.teacher?.nickname ?? "主讲");
    const teacherPosition = layout?.teacherImages?.[String(savedLesson.lessonNumber)] ?? layout?.teacherImage ?? { x: 67, y: 57, width: 25, height: 30 };
    const selectedExpression = project.teacher?.assets.find((asset) => asset.id === teacherPosition.assetId) ?? project.teacher?.assets.find((asset) => asset.kind === "EXPRESSION");
    const teacherExpressionSrc = selectedExpression ? `/api/assets/teacher/${selectedExpression.id}` : `/teacher-defaults/${defaultTeacherKey}-expression.png`;
    return [
      {
        collection: "student",
        kind: "home",
        title: `第${savedLesson.lessonNumber}讲 ${lesson.title}`,
        subtitle: lesson.subtitle ?? "",
        body: lesson.learningGoals,
        technique: lesson.technique, sharedPage: specs[0], ...pageType(project.layoutConfig, `student-${savedLesson.lessonNumber}-0`, defaultLessonBodySize(0, lesson)), richHtml: richPage(project.layoutConfig, "student", savedLesson.lessonNumber, 0), backgroundSrc: pageBackground(project, "LESSON_HOME"),
      },
      { collection: "student", kind: "conversation", title: "课后交流话题", topics: lesson.conversationTopics, sharedPage: specs[1], ...pageType(project.layoutConfig, `student-${savedLesson.lessonNumber}-1`, defaultLessonBodySize(1, lesson)), richHtml: richPage(project.layoutConfig, "student", savedLesson.lessonNumber, 1), backgroundSrc: pageBackground(project, "CONVERSATION") },
      {
        collection: "student", kind: "reading",
        title: "阅读文段",
        text: lesson.readingExcerpt.text,
        pinyinUnits: project.grade === "1升2" ? (() => {
          const saved = savedLesson.pinyinReview as Array<{ char: string; pinyin: string }> | null;
          try { return saved ? validatePinyinReview(lesson.readingExcerpt.text, saved) : createPinyinReview(lesson.readingExcerpt.text); } catch { return createPinyinReview(lesson.readingExcerpt.text); }
        })() : undefined,
        questions: lesson.closeReadingQuestions, sharedPage: specs[2], ...pageType(project.layoutConfig, `student-${savedLesson.lessonNumber}-2`, defaultLessonBodySize(2, lesson)), richHtml: richPage(project.layoutConfig, "student", savedLesson.lessonNumber, 2), backgroundSrc: pageBackground(project, "READING"),
      },
      {
        collection: "student", kind: "practice",
        title: "课堂方法与真题带练",
        method: lesson.methodSummary,
        practice: previewPractice(lesson.practice), teacherExpressionSrc, teacherPosition, sharedPage: specs[3], ...pageType(project.layoutConfig, `student-${savedLesson.lessonNumber}-3`, defaultLessonBodySize(3, lesson)), richHtml: richPage(project.layoutConfig, "student", savedLesson.lessonNumber, 3), backgroundSrc: pageBackground(project, "PRACTICE"),
      },
      {
        collection: "student", kind: "teacher",
        title: "我是小老师",
        steps: lesson.littleTeacherSteps,
        framework: lesson.oralFramework, sharedPage: specs[4], ...pageType(project.layoutConfig, `student-${savedLesson.lessonNumber}-4`, defaultLessonBodySize(4, lesson)), richHtml: richPage(project.layoutConfig, "student", savedLesson.lessonNumber, 4), backgroundSrc: pageBackground(project, "LITTLE_TEACHER"),
      },
    ];
  });
  const parentBackground = pageBackground(project, "PARENT_MANUAL");
  const teacherName = project.teacher?.formalName ?? "主讲";
  const parsedLessons = project.lessons.map((item) => lessonContentSchema.parse(item.structuredContent));
  const parentSpecs = parentPageSpec(project.grade, parsedLessons, teacherName, project.teacher?.introduction ?? undefined);
  const portraitAsset = project.teacher?.assets.find((asset) => asset.kind === "PORTRAIT");
  const teacherPortraitSrc = portraitAsset ? `/api/assets/teacher/${portraitAsset.id}` : `/teacher-defaults/${defaultTeacherKey}-portrait.png`;
  const parentPages = [
    { collection: "parent", kind: "parent", title: "家长使用手册", teacherPortraitSrc, sharedPage: parentSpecs[0], ...pageType(project.layoutConfig, "parent-0-0"), richHtml: richPage(project.layoutConfig, "parent", 0, 0), backgroundSrc: parentBackground },
    { collection: "parent", kind: "parent", title: "五讲课程带来的能力提升", sharedPage: parentSpecs[1], ...pageType(project.layoutConfig, "parent-0-1"), richHtml: richPage(project.layoutConfig, "parent", 0, 1), backgroundSrc: parentBackground },
    { collection: "parent", kind: "parent", title: `🎯 ${project.grade}阶段，最需要关注什么？`, sharedPage: parentSpecs[2], ...pageType(project.layoutConfig, "parent-0-2"), richHtml: richPage(project.layoutConfig, "parent", 0, 2), backgroundSrc: parentBackground }
  ];
  const answerPages = project.lessons.map((savedLesson) => {
    const lesson = lessonContentSchema.parse(savedLesson.structuredContent);
    return { collection: "answers", kind: "answer", title: `第${savedLesson.lessonNumber}讲参考答案`, sharedPage: answerPageSpec(lesson), ...pageType(project.layoutConfig, `answers-${savedLesson.lessonNumber}-0`), topics: lesson.conversationTopics, practice: previewPractice(lesson.practice), richHtml: richPage(project.layoutConfig, "answers", savedLesson.lessonNumber, 0), backgroundSrc: pageBackground(project, "SIMPLE") };
  });
  const chrome = pageChrome(project.layoutConfig);
  const pages = [...parentPages, ...studentPages, ...answerPages].map((page) => ({ ...page, ...chrome }));

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
        headerText={chrome.headerText}
        footerText={chrome.footerText}
      />
    </>
  );
}
