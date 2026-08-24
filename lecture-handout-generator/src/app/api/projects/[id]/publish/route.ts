import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { lessonContentSchema } from "@/lib/handout/content-schema";
import { z } from "zod";

const publishSchema = z.object({ includes: z.array(z.enum(["parent", "student", "answers"])).min(1) });

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = publishSchema.safeParse(await _request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请至少选择一种电子翻页书内容" }, { status: 400 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId }, include: { lessons: { orderBy: { lessonNumber: "asc" } }, flipbooks: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (project.lessons.length === 0 || project.lessons.some((lesson) => !lesson.textApprovedAt)) return NextResponse.json({ error: "所有课程通过文字审核后才能发布" }, { status: 409 });
  const lessons = project.lessons.map((lesson) => lessonContentSchema.parse(lesson.structuredContent));
  const parent = [{ collection: "parent", kind: "parent", title: "家长使用手册", subtitle: "—— 真读书 · 有深度 · 用得上 ——", body: ["双师陪伴：主讲老师负责课程讲解、阅读方法和表达写作训练；班主任老师负责直播跟课、答疑、反馈和学习规划。", "五讲合起来，孩子练习的是：读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。"] }];
  const student = lessons.flatMap((lesson) => [
    { collection: "student", kind: "home", title: `第${lesson.lessonNumber}讲 ${lesson.title}`, subtitle: lesson.subtitle, body: lesson.learningGoals, technique: lesson.technique },
    { collection: "student", kind: "conversation", title: "课后交流话题", topics: lesson.conversationTopics },
    { collection: "student", kind: "reading", title: "阅读文段", text: lesson.readingExcerpt.text, questions: lesson.closeReadingQuestions },
    { collection: "student", kind: "practice", title: "课堂方法与真题带练", method: lesson.methodSummary, practice: lesson.practice },
    { collection: "student", kind: "teacher", title: "我是小老师", steps: lesson.littleTeacherSteps, framework: lesson.oralFramework }
  ]);
  const answers = lessons.flatMap((lesson) => [
    { collection: "answers", kind: "answer", title: `第${lesson.lessonNumber}讲参考答案`, topics: lesson.conversationTopics },
    { collection: "answers", kind: "answer", title: "真题带练参考", practice: lesson.practice }
  ]);
  const content = [...(parsed.data.includes.includes("parent") ? parent : []), ...(parsed.data.includes.includes("student") ? student : []), ...(parsed.data.includes.includes("answers") ? answers : [])];
  const latest = project.flipbooks[0]; const slug = latest?.slug ?? randomBytes(6).toString("base64url");
  const flipbook = latest ? await db.publishedFlipbook.update({ where: { id: latest.id }, data: { title: project.name, description: `${project.grade}五讲读写课程电子讲义`, content } }) : await db.publishedFlipbook.create({ data: { projectId: project.id, slug, title: project.name, description: `${project.grade}五讲读写课程电子讲义`, content } });
  const origin = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(_request.url).origin;
  return NextResponse.json({ url: `${origin}/book/${flipbook.slug}` });
}
