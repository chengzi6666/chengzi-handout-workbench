import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { objectStore } from "@/lib/storage/object-store";
import { projectSourceKey } from "@/lib/storage/keys";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

async function ownedProject(id: string, userId: string) {
  return db.project.findFirst({ where: { id, ownerId: userId } });
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!(await ownedProject(id, session.userId))) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const files = await db.sourceFile.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ files });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!(await ownedProject(id, session.userId))) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file");
  const lessonNumberValue = form.get("lessonNumber");
  const requestedKind = form.get("kind") === "QUESTION_IMAGE" ? "QUESTION_IMAGE" : "PDF";
  if (!(file instanceof File)) return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "PDF大小必须在100MB以内" }, { status: 400 });
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (requestedKind === "PDF" && !isPdf) return NextResponse.json({ error: "主讲文件必须是PDF" }, { status: 400 });
  if (requestedKind === "QUESTION_IMAGE" && !file.type.startsWith("image/")) return NextResponse.json({ error: "人工替代题图必须是图片" }, { status: 400 });
  const body = new Uint8Array(await file.arrayBuffer());
  if (requestedKind === "PDF" && new TextDecoder().decode(body.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "文件不是有效PDF" }, { status: 400 });
  const checksum = createHash("sha256").update(body).digest("hex");
  const duplicate = await db.sourceFile.findFirst({ where: { projectId: id, checksum } });
  if (duplicate) return NextResponse.json({ file: duplicate, duplicate: true });
  const key = projectSourceKey(id, file.name);
  await objectStore().put({ key, body, contentType: file.type || "application/octet-stream" });
  const lessonNumber = typeof lessonNumberValue === "string" && lessonNumberValue ? Number(lessonNumberValue) : null;
  const source = await db.sourceFile.create({
    data: { projectId: id, kind: requestedKind, originalName: file.name, objectKey: key, mimeType: file.type || "application/octet-stream", size: file.size, checksum, lessonNumber: Number.isInteger(lessonNumber) ? lessonNumber : null }
  });
  return NextResponse.json({ file: source, duplicate: false }, { status: 201 });
}
