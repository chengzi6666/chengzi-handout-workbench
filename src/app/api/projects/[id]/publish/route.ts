import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { lessonContentSchema } from "@/lib/handout/content-schema";
import { z } from "zod";
import { createPinyinReview, validatePinyinReview } from "@/lib/handout/pinyin";
import { defaultBackgroundPath } from "@/lib/handout/backgrounds";
import { answerPageSpec, defaultLessonBodySize, isCurrentParentRichPage, lessonPageSpec, parentPageSpec } from "@/lib/handout/page-spec";

const publishSchema = z.object({ includes: z.array(z.enum(["parent", "student", "answers"])).min(1) });

function publicPractice<T extends { imageSourceFileId?: string }>(items: T[], slug: string) {
  return items.map((item) => ({
    ...item,
    ...(item.imageSourceFileId ? { imageUrl: `/api/book/${slug}/question-image/${item.imageSourceFileId}` } : {}),
  }));
}

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
  return { bodySize: item?.bodySize ?? Math.min(config?.fontSize ?? fallback, fallback), titleSize: item?.titleSize ?? 20 };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = publishSchema.safeParse(await _request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请至少选择一种电子翻页书内容" }, { status: 400 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId }, include: { lessons: { orderBy: { lessonNumber: "asc" } }, backgroundPack: { include: { assets: true } }, teacher: { include: { assets: true } }, flipbooks: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (project.lessons.length === 0 || project.lessons.some((lesson) => !lesson.textApprovedAt)) return NextResponse.json({ error: "所有课程通过文字审核后才能发布" }, { status: 409 });
  const lessons = project.lessons.map((lesson) => lessonContentSchema.parse(lesson.structuredContent));
  const latest = project.flipbooks[0]; const slug = latest?.slug ?? randomBytes(6).toString("base64url");
  const background = (role: string) => {
    const asset = project.backgroundPack?.assets.find((item) => item.role === role) ?? project.backgroundPack?.assets.find((item) => item.role === "SIMPLE");
    return asset ? `/api/book/${slug}/background/${asset.id}` : defaultBackgroundPath(role);
  };
  const teacherName = project.teacher?.formalName ?? "主讲";
  type TeacherPosition = { assetId?: string; x?: number; y?: number; width?: number; height?: number };
  const layout = project.layoutConfig as { teacherImage?: TeacherPosition; teacherImages?: Record<string, TeacherPosition> } | null;
  const defaultTeacherKey = ({ "0升1": "0l1", "1升2": "1l2", "2升3": "2l3", "3升4": "3l4", "4升5": "4l5" } as Record<string, string>)[project.grade] ?? "1l2";
  const expressionAssets = project.teacher?.assets.filter((asset) => asset.kind === "EXPRESSION") ?? [];
  const parentSpecs = parentPageSpec(project.grade, lessons, teacherName, project.teacher?.introduction ?? undefined);
  const portraitAsset = project.teacher?.assets.find((asset) => asset.kind === "PORTRAIT");
  const teacherPortraitSrc = portraitAsset ? `/api/book/${slug}/teacher/${portraitAsset.id}` : `/teacher-defaults/${defaultTeacherKey}-portrait.png`;
  const parent = [
    { collection: "parent", kind: "parent", title: "家长使用手册", teacherPortraitSrc, sharedPage: parentSpecs[0], ...pageType(project.layoutConfig, "parent-0-0"), richHtml: richPage(project.layoutConfig, "parent", 0, 0), backgroundSrc: background("PARENT_MANUAL") },
    { collection: "parent", kind: "parent", title: "五讲课程带来的能力提升", sharedPage: parentSpecs[1], ...pageType(project.layoutConfig, "parent-0-1"), richHtml: richPage(project.layoutConfig, "parent", 0, 1), backgroundSrc: background("PARENT_MANUAL") },
    { collection: "parent", kind: "parent", title: `🎯 ${project.grade}阶段，最需要关注什么？`, sharedPage: parentSpecs[2], ...pageType(project.layoutConfig, "parent-0-2"), richHtml: richPage(project.layoutConfig, "parent", 0, 2), backgroundSrc: background("PARENT_MANUAL") },
  ];
  const student = lessons.flatMap((lesson) => {
    const specs = lessonPageSpec(lesson, project.teacher?.nickname ?? "主讲");
    const lessonTeacher = layout?.teacherImages?.[String(lesson.lessonNumber)];
    const teacherPosition = lessonTeacher ?? layout?.teacherImage ?? { x: 67, y: 57, width: 25, height: 30 };
    const selectedExpression = expressionAssets.find((asset) => asset.id === lessonTeacher?.assetId) ?? expressionAssets[(lesson.lessonNumber - 1) % Math.max(1, expressionAssets.length)];
    const teacherExpressionSrc = selectedExpression ? `/api/book/${slug}/teacher/${selectedExpression.id}` : `/teacher-defaults/${defaultTeacherKey}-expression.png`;
    return [
    { collection: "student", kind: "home", title: `第${lesson.lessonNumber}讲 ${lesson.title}`, sharedPage: specs[0], ...pageType(project.layoutConfig, `student-${lesson.lessonNumber}-0`, defaultLessonBodySize(0, lesson)), richHtml: richPage(project.layoutConfig, "student", lesson.lessonNumber, 0), backgroundSrc: background("LESSON_HOME") },
    { collection: "student", kind: "conversation", title: "课后交流话题", sharedPage: specs[1], ...pageType(project.layoutConfig, `student-${lesson.lessonNumber}-1`, defaultLessonBodySize(1, lesson)), richHtml: richPage(project.layoutConfig, "student", lesson.lessonNumber, 1), backgroundSrc: background("CONVERSATION") },
    { collection: "student", kind: "reading", title: "阅读文段", sharedPage: specs[2], ...pageType(project.layoutConfig, `student-${lesson.lessonNumber}-2`), pinyinUnits: project.grade === "1升2" ? (() => { const row = project.lessons.find((item) => item.lessonNumber === lesson.lessonNumber); try { return row?.pinyinReview ? validatePinyinReview(lesson.readingExcerpt.text, row.pinyinReview as Array<{ char: string; pinyin: string }>) : createPinyinReview(lesson.readingExcerpt.text); } catch { return createPinyinReview(lesson.readingExcerpt.text); } })() : undefined, richHtml: richPage(project.layoutConfig, "student", lesson.lessonNumber, 2), backgroundSrc: background("READING") },
    { collection: "student", kind: "practice", title: "课堂方法与真题带练", teacherExpressionSrc, teacherPosition, sharedPage: specs[3], ...pageType(project.layoutConfig, `student-${lesson.lessonNumber}-3`), practice: publicPractice(lesson.practice, slug), richHtml: richPage(project.layoutConfig, "student", lesson.lessonNumber, 3), backgroundSrc: background("PRACTICE") },
    { collection: "student", kind: "teacher", title: "我是小老师", sharedPage: specs[4], ...pageType(project.layoutConfig, `student-${lesson.lessonNumber}-4`), richHtml: richPage(project.layoutConfig, "student", lesson.lessonNumber, 4), backgroundSrc: background("LITTLE_TEACHER") }
  ]; });
  const answers = lessons.map((lesson) => ({ collection: "answers", kind: "answer", title: `第${lesson.lessonNumber}讲参考答案`, sharedPage: answerPageSpec(lesson), ...pageType(project.layoutConfig, `answers-${lesson.lessonNumber}-0`), richHtml: richPage(project.layoutConfig, "answers", lesson.lessonNumber, 0), backgroundSrc: background("SIMPLE") }));
  const chrome = pageChrome(project.layoutConfig);
  const content = [...(parsed.data.includes.includes("parent") ? parent : []), ...(parsed.data.includes.includes("student") ? student : []), ...(parsed.data.includes.includes("answers") ? answers : [])].map((page) => ({ ...page, ...chrome }));
  const flipbook = latest ? await db.publishedFlipbook.update({ where: { id: latest.id }, data: { title: project.name, description: `${project.grade}五讲读写课程电子讲义`, content } }) : await db.publishedFlipbook.create({ data: { projectId: project.id, slug, title: project.name, description: `${project.grade}五讲读写课程电子讲义`, content } });
  const origin = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(_request.url).origin;
  // 微信会长期缓存同一 URL 的标题与缩略图。每次重新发布附带内容版本，
  // 让手机端立即抓取刚上传的分享封面，而不是继续显示旧图。
  return NextResponse.json({ url: `${origin}/book/${flipbook.slug}?v=${flipbook.updatedAt.getTime()}` });
}
