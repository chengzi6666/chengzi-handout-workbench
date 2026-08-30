import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/object-store";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await request.formData();
  const projectId = String(form.get("projectId") ?? "");
  const collection = String(form.get("collection") ?? "");
  const pageNumber = Number(form.get("pageNumber") ?? 0);
  const replace = String(form.get("replace") ?? "") === "true";
  const file = form.get("page");
  if (!projectId || !["student", "answers"].includes(collection) || pageNumber < 1 || !(file instanceof File)) return NextResponse.json({ error: "页面上传参数无效" }, { status: 400 });
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: session.userId } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const key = `projects/${project.id}/existing-book/${collection}/${String(pageNumber).padStart(3, "0")}.webp`;
  const existing = await db.sourceFile.findFirst({ where: { projectId, objectKey: key } });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (existing) {
    if (!replace) return NextResponse.json({ id: existing.id, reused: true });
    await objectStore().put({ key, body: bytes, contentType: file.type || "image/webp" });
    const source = await db.sourceFile.update({
      where: { id: existing.id },
      data: { originalName: file.name, mimeType: file.type || "image/webp", size: bytes.length, lessonNumber: pageNumber },
    });
    return NextResponse.json({ id: source.id, replaced: true });
  }
  await objectStore().put({ key, body: bytes, contentType: file.type || "image/webp" });
  const source = await db.sourceFile.create({ data: { projectId, kind: "BACKGROUND_IMAGE", originalName: file.name, objectKey: key, mimeType: file.type || "image/webp", size: bytes.length, lessonNumber: pageNumber } });
  return NextResponse.json({ id: source.id });
}
