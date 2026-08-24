import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { objectStore } from "@/lib/storage/object-store";
import { safeFileName } from "@/lib/storage/keys";

const roles = ["SIMPLE", "COVER", "WECHAT_SHARE", "PARENT_MANUAL", "LESSON_HOME", "CONVERSATION", "READING", "PRACTICE", "LITTLE_TEACHER"] as const;
const roleSchema = z.enum(roles);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId }, include: { backgroundPack: { include: { assets: true } } } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ pack: project.backgroundPack });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file"); const parsedRole = roleSchema.safeParse(form.get("role")); const mode = form.get("mode") === "professional" ? "professional" : "simple";
  if (!(file instanceof File) || !parsedRole.success) return NextResponse.json({ error: "请选择图片和用途" }, { status: 400 });
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "仅支持20MB以内图片" }, { status: 400 });
  const pack = project.backgroundPackId ? await db.backgroundPack.findUniqueOrThrow({ where: { id: project.backgroundPackId } }) : await db.backgroundPack.create({ data: { name: `${project.name}背景`, mode } });
  const key = `projects/${project.id}/backgrounds/${parsedRole.data.toLowerCase()}-${Date.now()}-${safeFileName(file.name)}`;
  await objectStore().put({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
  const asset = await db.backgroundAsset.upsert({ where: { backgroundPackId_role: { backgroundPackId: pack.id, role: parsedRole.data } }, create: { backgroundPackId: pack.id, role: parsedRole.data, objectKey: key }, update: { objectKey: key } });
  await db.project.update({ where: { id: project.id }, data: { backgroundPackId: pack.id } });
  return NextResponse.json({ asset });
}
