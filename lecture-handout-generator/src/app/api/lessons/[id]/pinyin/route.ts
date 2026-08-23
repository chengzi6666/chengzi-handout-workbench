import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { createPinyinReview, validatePinyinReview } from "@/lib/handout/pinyin";
import { requiresPinyinReview } from "@/lib/handout/content-schema";

const unitsSchema = z.array(z.object({ char: z.string().min(1), pinyin: z.string() }));

async function ownedLesson(id: string, ownerId: string) {
  return db.lesson.findFirst({ where: { id, project: { ownerId } }, include: { project: true } });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const lesson = await ownedLesson(id, session.userId);
  if (!lesson) return NextResponse.json({ error: "课程不存在" }, { status: 404 });
  if (!requiresPinyinReview(lesson.project.grade)) return NextResponse.json({ error: "本年级不需要添加拼音" }, { status: 409 });
  const units = lesson.pinyinReview ?? createPinyinReview(lesson.readingExcerpt ?? "");
  return NextResponse.json({ units, approved: Boolean(lesson.pinyinApprovedAt) });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = unitsSchema.safeParse((await request.json().catch(() => null))?.units);
  if (!parsed.success) return NextResponse.json({ error: "拼音数据格式不正确" }, { status: 400 });
  const { id } = await context.params;
  const lesson = await ownedLesson(id, session.userId);
  if (!lesson) return NextResponse.json({ error: "课程不存在" }, { status: 404 });
  try { validatePinyinReview(lesson.readingExcerpt ?? "", parsed.data); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "拼音校验失败" }, { status: 409 }); }
  await db.lesson.update({ where: { id }, data: { pinyinReview: parsed.data, pinyinApprovedAt: new Date() } });
  const pending = await db.lesson.count({ where: { projectId: lesson.projectId, pinyinApprovedAt: null } });
  if (pending === 0) await db.project.update({ where: { id: lesson.projectId }, data: { status: "LAYOUT_REVIEW" } });
  return NextResponse.json({ ok: true });
}
