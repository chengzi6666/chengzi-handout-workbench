import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/storage/object-store";

const actionSchema = z.object({
  projectId: z.string().min(1),
  action: z.enum(["restore", "purge"])
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const projects = await db.project.findMany({
    where: { ownerId: session.userId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: { id: true, name: true, grade: true, lessonCount: true, deletedAt: true, updatedAt: true }
  });
  return NextResponse.json({ projects });
}

export async function PATCH(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "回收站操作不正确" }, { status: 400 });
  const project = await db.project.findFirst({
    where: { id: parsed.data.projectId, ownerId: session.userId, deletedAt: { not: null } },
    include: { sourceFiles: { include: { pages: true } }, generatedFiles: true }
  });
  if (!project) return NextResponse.json({ error: "回收站中未找到该项目" }, { status: 404 });

  if (parsed.data.action === "restore") {
    const restored = await db.project.update({ where: { id: project.id }, data: { deletedAt: null, status: "DRAFT" } });
    return NextResponse.json({ project: restored, message: "项目已恢复到工作台" });
  }

  // 先记录专属于该项目的文件，再删除数据库；背景包和教师素材可能被其他项目共用，绝不在此清理。
  const keys = [
    ...project.sourceFiles.flatMap((file) => [file.objectKey, ...file.pages.map((page) => page.imageObjectKey).filter((key): key is string => Boolean(key))]),
    ...project.generatedFiles.map((file) => file.objectKey)
  ];
  await db.project.delete({ where: { id: project.id } });
  await Promise.allSettled(keys.map((key) => objectStore().delete(key)));
  return NextResponse.json({ message: "项目已彻底删除" });
}
