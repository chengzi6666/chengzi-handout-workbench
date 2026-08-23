import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { lessonContentSchema } from "@/lib/handout/content-schema";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId }, include: { lessons: { orderBy: { lessonNumber: "asc" } }, flipbooks: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (project.lessons.length === 0 || project.lessons.some((lesson) => !lesson.textApprovedAt)) return NextResponse.json({ error: "所有课程通过文字审核后才能发布" }, { status: 409 });
  const lessons = project.lessons.map((lesson) => lessonContentSchema.parse(lesson.structuredContent));
  const content = lessons.flatMap((lesson) => [
    { kind: "home", title: `第${lesson.lessonNumber}讲 ${lesson.title}`, subtitle: lesson.subtitle, body: lesson.learningGoals, technique: lesson.technique },
    { kind: "conversation", title: "课后交流话题", topics: lesson.conversationTopics },
    { kind: "reading", title: "阅读文段", text: lesson.readingExcerpt.text, questions: lesson.closeReadingQuestions },
    { kind: "practice", title: "课堂方法与真题带练", method: lesson.methodSummary, practice: lesson.practice },
    { kind: "teacher", title: "我是小老师", steps: lesson.littleTeacherSteps, framework: lesson.oralFramework }
  ]);
  const latest = project.flipbooks[0]; const slug = latest?.slug ?? randomBytes(6).toString("base64url");
  const flipbook = latest ? await db.publishedFlipbook.update({ where: { id: latest.id }, data: { title: project.name, description: `${project.grade}五讲读写课程电子讲义`, content } }) : await db.publishedFlipbook.create({ data: { projectId: project.id, slug, title: project.name, description: `${project.grade}五讲读写课程电子讲义`, content } });
  const origin = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(_request.url).origin;
  return NextResponse.json({ url: `${origin}/book/${flipbook.slug}` });
}
