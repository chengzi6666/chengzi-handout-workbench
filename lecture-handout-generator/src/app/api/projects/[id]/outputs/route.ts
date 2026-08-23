import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

const kinds = z.array(z.enum(["LESSON_STUDENT", "COMBINED_STUDENT", "COMBINED_ANSWERS", "PARENT_MANUAL", "LESSON_ANSWERS"]));
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = kinds.safeParse((await request.json().catch(() => null))?.kinds); if (!parsed.success) return NextResponse.json({ error: "输出类型不正确" }, { status: 400 });
  const { id } = await context.params; const project = await db.project.findFirst({ where: { id, ownerId: session.userId } }); if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  await db.$transaction(async (transaction) => {
    await transaction.projectOutput.updateMany({ where: { projectId: id, kind: { notIn: parsed.data } }, data: { enabled: false } });
    for (const kind of parsed.data) await transaction.projectOutput.upsert({ where: { projectId_kind: { projectId: id, kind } }, create: { projectId: id, kind, enabled: true }, update: { enabled: true } });
  });
  return NextResponse.json({ ok: true });
}
