import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  pinned: z.boolean().optional(),
  confirmTeachingYear: z.boolean().optional(),
  teacherId: z.string().nullable().optional(),
  selectedProviderId: z.string().nullable().optional()
}).refine((value) => Object.keys(value).length > 0, "没有需要更新的内容");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "更新内容不正确" }, { status: 400 });
  const { id } = await context.params;
  const existing = await db.project.findFirst({ where: { id, ownerId: session.userId } });
  if (!existing) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const { confirmTeachingYear, ...changes } = parsed.data;
  const project = await db.project.update({
    where: { id },
    data: {
      ...changes,
      ...(confirmTeachingYear === undefined ? {} : { teachingYearConfirmedAt: confirmTeachingYear ? new Date() : null })
    }
  });
  return NextResponse.json({ project });
}
