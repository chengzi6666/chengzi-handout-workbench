import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { lessonContentSchema, requiresPinyinReview } from "@/lib/handout/content-schema";

const patchSchema = z.object({ content: lessonContentSchema.optional(), approveText: z.boolean().optional(), approvePinyin: z.boolean().optional(), revokeTextApproval: z.boolean().optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "内容格式不正确" }, { status: 400 });
  const { id } = await context.params;
  const lesson = await db.lesson.findFirst({ where: { id, project: { ownerId: session.userId } }, include: { project: true } });
  if (!lesson) return NextResponse.json({ error: "课程不存在" }, { status: 404 });
  const content = parsed.data.content ?? lessonContentSchema.parse(lesson.structuredContent);
  if (parsed.data.approveText) {
    if (!content.readingExcerpt.approved) return NextResponse.json({ error: "请先勾选确认阅读文段与PDF原文一致" }, { status: 409 });
    if (content.curriculumAlignment.some((item) => !item.confirmed)) return NextResponse.json({ error: "请先确认所有联网对标来源" }, { status: 409 });
  }
  const updated = await db.lesson.update({ where: { id }, data: {
    structuredContent: content,
    readingExcerpt: content.readingExcerpt.text,
    readingExcerptSource: content.readingExcerpt,
    ...(parsed.data.approveText ? { textApprovedAt: new Date(), status: "APPROVED" } : {}),
    ...(parsed.data.revokeTextApproval ? { textApprovedAt: null, status: "TEXT_REVIEW" } : {}),
    ...(parsed.data.approvePinyin ? { pinyinApprovedAt: new Date() } : {})
  } });
  if (parsed.data.approveText) {
    const pending = await db.lesson.count({ where: { projectId: lesson.projectId, textApprovedAt: null } });
    if (pending === 0) await db.project.update({ where: { id: lesson.projectId }, data: { status: requiresPinyinReview(lesson.project.grade) ? "PINYIN_REVIEW" : "LAYOUT_REVIEW" } });
  }
  if (parsed.data.revokeTextApproval) await db.project.update({ where: { id: lesson.projectId }, data: { status: "TEXT_REVIEW" } });
  return NextResponse.json({ lesson: updated });
}
