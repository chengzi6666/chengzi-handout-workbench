import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  pinned: z.boolean().optional(),
  confirmTeachingYear: z.boolean().optional(),
  teachingYear: z.number().int().min(2022).max(2100).optional(),
  season: z.enum(["春季", "暑期", "秋季", "冬季"]).optional(),
  teacherId: z.string().nullable().optional(),
  selectedProviderId: z.string().nullable().optional()
}).refine((value) => Object.keys(value).length > 0, "没有需要更新的内容");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "更新内容不正确" }, { status: 400 });
  const { id } = await context.params;
  if (process.env.LOCAL_DEMO_MODE === "true") return NextResponse.json({ project: { id, ...parsed.data } });
  const existing = await db.project.findFirst({ where: { id, ownerId: session.userId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const { confirmTeachingYear, teachingYear, season, ...changes } = parsed.data;
  const project = await db.project.update({
    where: { id },
    data: {
      ...changes,
      ...(teachingYear === undefined ? {} : { teachingYear, teachingYearConfirmedAt: null }),
      ...(season === undefined ? {} : { season, teachingYearConfirmedAt: null }),
      ...(confirmTeachingYear === undefined ? {} : { teachingYearConfirmedAt: confirmTeachingYear ? new Date() : null })
    }
  });
  return NextResponse.json({ project });
}

/** 项目删除采用软删除，给教研保留恢复窗口。 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const existing = await db.project.findFirst({ where: { id, ownerId: session.userId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "项目不存在或已在回收站中" }, { status: 404 });

  const now = new Date();
  const [project] = await db.$transaction([
    db.project.update({ where: { id }, data: { deletedAt: now, pinned: false } }),
    db.processingJob.updateMany({
      where: { projectId: id, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "FAILED", error: "项目已移入回收站", finishedAt: now }
    })
  ]);
  return NextResponse.json({ project, message: "项目已移入回收站，可随时恢复" });
}
