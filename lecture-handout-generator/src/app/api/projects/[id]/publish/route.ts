import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { lessonContentSchema } from "@/lib/handout/content-schema";
import { z } from "zod";
import { createPinyinReview, validatePinyinReview } from "@/lib/handout/pinyin";

const publishSchema = z.object({ includes: z.array(z.enum(["parent", "student", "answers"])).min(1) });

function publicPractice<T extends { imageSourceFileId?: string }>(items: T[], slug: string) {
  return items.map((item) => ({
    ...item,
    ...(item.imageSourceFileId ? { imageUrl: `/api/book/${slug}/question-image/${item.imageSourceFileId}` } : {}),
  }));
}

function richPage(layoutConfig: unknown, lessonNumber: number, pageIndex: number) {
  const config = layoutConfig as { richPreviewHtml?: Record<string, string> } | null;
  return config?.richPreviewHtml?.[`student-${lessonNumber}-${pageIndex}`];
}

function pageChrome(layoutConfig: unknown) {
  const config = layoutConfig as { headerText?: string; footerText?: string } | null;
  return { headerText: config?.headerText ?? "", footerText: config?.footerText ?? "" };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = publishSchema.safeParse(await _request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请至少选择一种电子翻页书内容" }, { status: 400 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId }, include: { lessons: { orderBy: { lessonNumber: "asc" } }, backgroundPack: { include: { assets: true } }, teacher: true, flipbooks: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (project.lessons.length === 0 || project.lessons.some((lesson) => !lesson.textApprovedAt)) return NextResponse.json({ error: "所有课程通过文字审核后才能发布" }, { status: 409 });
  const lessons = project.lessons.map((lesson) => lessonContentSchema.parse(lesson.structuredContent));
  const latest = project.flipbooks[0]; const slug = latest?.slug ?? randomBytes(6).toString("base64url");
  const background = (role: string) => {
    const asset = project.backgroundPack?.assets.find((item) => item.role === role) ?? project.backgroundPack?.assets.find((item) => item.role === "SIMPLE");
    return asset ? `/api/book/${slug}/background/${asset.id}` : `/handout-backgrounds/${role === "READING" ? "mint-school.png" : role === "CONVERSATION" || role === "LITTLE_TEACHER" ? "blush-school.png" : "butter-school.png"}`;
  };
  const teacherName = project.teacher?.formalName ?? "主讲";
  const teacherPortraitSrc = `/teacher-defaults/${({ "0升1": "0l1", "1升2": "1l2", "2升3": "2l3", "3升4": "3l4", "4升5": "4l5" }[project.grade] ?? "1l2")}-portrait.png`;
  const parent = [
    { collection: "parent", kind: "parent", title: "家长使用手册", subtitle: "—— 真读书 · 有深度 · 用得上 ——", teacherPortraitSrc, backgroundSrc: background("PARENT_MANUAL"), body: [`${teacherName}老师｜主讲老师`, project.teacher?.introduction ?? "负责阅读方法、表达写作和课堂互动引导。", "🤝 双师陪伴｜主讲老师＋班主任老师", `${teacherName}老师负责课程讲解、阅读方法和表达写作训练；班主任老师负责直播跟课、日常答疑、阶段反馈、薄弱点跟踪和学习规划，两位老师共同陪伴一个孩子。`] },
    { collection: "parent", kind: "parent", title: "五讲课程带来的能力提升", backgroundSrc: background("PARENT_MANUAL"), body: ["五讲合起来，孩子练习的是：读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。", "五讲学习安排", ...lessons.map((lesson) => `第${lesson.lessonNumber}讲《${lesson.title}》｜${lesson.technique}｜${lesson.learningGoals.map((goal) => goal.replace(/^我[们]?/u, "")).join("；")}`)] },
    { collection: "parent", kind: "parent", title: `🎯 ${project.grade}阶段，最需要关注什么？`, backgroundSrc: background("PARENT_MANUAL"), body: ["基础：从“会认字”走向“会用字词”——在故事语境中认识并积累字词，并能用到自己的口头和书面表达中。", "阅读：从“听故事”走向“读懂故事”——说清人物、事情、结果与道理，并从原文中找到具体词句作证据。", "表达：从“说一句话”走向“完整表达”——借助课堂方法，把人物、事情、动作、语言、心情和结果说完整、写清楚。", "💡 家长怎么配合？正课前后按讲义完成复述、笔记或书面练习，并由班主任给予跟踪反馈。"] },
  ];
  const student = lessons.flatMap((lesson) => [
    { collection: "student", kind: "home", title: `第${lesson.lessonNumber}讲 ${lesson.title}`, subtitle: lesson.subtitle, body: lesson.learningGoals, technique: lesson.technique, richHtml: richPage(project.layoutConfig, lesson.lessonNumber, 0), backgroundSrc: background("LESSON_HOME") },
    { collection: "student", kind: "conversation", title: "课后交流话题", topics: lesson.conversationTopics, richHtml: richPage(project.layoutConfig, lesson.lessonNumber, 1), backgroundSrc: background("CONVERSATION") },
    { collection: "student", kind: "reading", title: "阅读文段", text: lesson.readingExcerpt.text, pinyinUnits: project.grade === "1升2" ? (() => { const row = project.lessons.find((item) => item.lessonNumber === lesson.lessonNumber); try { return row?.pinyinReview ? validatePinyinReview(lesson.readingExcerpt.text, row.pinyinReview as Array<{ char: string; pinyin: string }>) : createPinyinReview(lesson.readingExcerpt.text); } catch { return createPinyinReview(lesson.readingExcerpt.text); } })() : undefined, questions: lesson.closeReadingQuestions, richHtml: richPage(project.layoutConfig, lesson.lessonNumber, 2), backgroundSrc: background("READING") },
    { collection: "student", kind: "practice", title: "课堂方法与真题带练", method: lesson.methodSummary, practice: publicPractice(lesson.practice, slug), richHtml: richPage(project.layoutConfig, lesson.lessonNumber, 3), backgroundSrc: background("PRACTICE") },
    { collection: "student", kind: "teacher", title: "我是小老师", steps: lesson.littleTeacherSteps, framework: lesson.oralFramework, richHtml: richPage(project.layoutConfig, lesson.lessonNumber, 4), backgroundSrc: background("LITTLE_TEACHER") }
  ]);
  const answers = lessons.flatMap((lesson) => [
    { collection: "answers", kind: "answer", title: `第${lesson.lessonNumber}讲参考答案`, topics: lesson.conversationTopics, backgroundSrc: background("SIMPLE") },
    { collection: "answers", kind: "answer", title: "真题带练参考", practice: publicPractice(lesson.practice, slug), backgroundSrc: background("SIMPLE") }
  ]);
  const chrome = pageChrome(project.layoutConfig);
  const content = [...(parsed.data.includes.includes("parent") ? parent : []), ...(parsed.data.includes.includes("student") ? student : []), ...(parsed.data.includes.includes("answers") ? answers : [])].map((page) => ({ ...page, ...chrome }));
  const flipbook = latest ? await db.publishedFlipbook.update({ where: { id: latest.id }, data: { title: project.name, description: `${project.grade}五讲读写课程电子讲义`, content } }) : await db.publishedFlipbook.create({ data: { projectId: project.id, slug, title: project.name, description: `${project.grade}五讲读写课程电子讲义`, content } });
  const origin = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(_request.url).origin;
  return NextResponse.json({ url: `${origin}/book/${flipbook.slug}` });
}
