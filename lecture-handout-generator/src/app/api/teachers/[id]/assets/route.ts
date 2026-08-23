import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { objectStore } from "@/lib/storage/object-store";
import { safeFileName } from "@/lib/storage/keys";

const kindSchema = z.enum(["PORTRAIT", "EXPRESSION"]);
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const teacher = await db.teacher.findUnique({ where: { id } }); if (!teacher) return NextResponse.json({ error: "老师不存在" }, { status: 404 });
  const form = await request.formData(); const file = form.get("file"); const kind = kindSchema.safeParse(form.get("kind"));
  if (!(file instanceof File) || !kind.success || !file.type.startsWith("image/")) return NextResponse.json({ error: "请选择老师图片" }, { status: 400 });
  const key = `teachers/${id}/${kind.data.toLowerCase()}-${Date.now()}-${safeFileName(file.name)}`;
  await objectStore().put({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
  const asset = await db.teacherAsset.create({ data: { teacherId: id, kind: kind.data, label: String(form.get("label") ?? file.name), objectKey: key } });
  return NextResponse.json({ asset });
}
