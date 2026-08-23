import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

const updateSchema = z.object({
  formalName: z.string().trim().min(2).max(30).optional(),
  nickname: z.string().trim().min(2).max(30).optional(),
  grade: z.string().trim().max(20).nullable().optional(),
  introduction: z.string().trim().min(10).max(1000).optional(),
  enabled: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "更新内容不正确" }, { status: 400 });
  const { id } = await context.params;
  const teacher = await db.teacher.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ teacher });
}

