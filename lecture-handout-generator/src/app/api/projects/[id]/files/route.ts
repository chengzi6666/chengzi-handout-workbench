import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { objectStore } from "@/lib/storage/object-store";
import { projectSourceKey } from "@/lib/storage/keys";
import { extractWordText } from "@/lib/word/extract";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

async function ownedProject(id: string, userId: string) {
  return db.project.findFirst({ where: { id, ownerId: userId } });
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (process.env.LOCAL_DEMO_MODE === "true") return NextResponse.json({ files: [{ id: `${id}-pdf-1`, originalName: "秋01讲《要是没有发明文字》——探索文字奥秘.pdf", size: 18_240_000 }, { id: `${id}-pdf-2`, originalName: "秋02讲《爷爷一定有办法》——奇妙的毯子.pdf", size: 21_680_000 }] });
  if (!(await ownedProject(id, session.userId))) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const files = await db.sourceFile.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ files });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (process.env.LOCAL_DEMO_MODE === "true") return NextResponse.json({ error: "本地演示模式不保存上传文件" }, { status: 409 });
  if (!(await ownedProject(id, session.userId))) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file");
  const lessonNumberValue = form.get("lessonNumber");
  const requestedKind = form.get("kind") === "QUESTION_IMAGE" ? "QUESTION_IMAGE" : "PDF";
  if (!(file instanceof File)) return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "主讲文件大小必须在100MB以内" }, { status: 400 });
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isWord = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx");
  const sourceKind = requestedKind === "QUESTION_IMAGE" ? "QUESTION_IMAGE" : isWord ? "DOCUMENT" : "PDF";
  if (requestedKind === "PDF" && !isPdf && !isWord) return NextResponse.json({ error: "主讲文件必须是 PDF 或 DOCX" }, { status: 400 });
  if (requestedKind === "QUESTION_IMAGE" && !file.type.startsWith("image/")) return NextResponse.json({ error: "人工替代题图必须是图片" }, { status: 400 });
  const body = new Uint8Array(await file.arrayBuffer());
  if (sourceKind === "PDF" && new TextDecoder().decode(body.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "文件不是有效PDF" }, { status: 400 });
  if (sourceKind === "DOCUMENT" && !(body[0] === 0x50 && body[1] === 0x4b)) return NextResponse.json({ error: "文件不是有效DOCX，请先将旧版 .doc 转存为 .docx" }, { status: 400 });
  const checksum = createHash("sha256").update(body).digest("hex");
  const duplicate = await db.sourceFile.findFirst({ where: { projectId: id, checksum } });
  if (duplicate) return NextResponse.json({ file: duplicate, duplicate: true });
  const key = projectSourceKey(id, file.name);
  await objectStore().put({ key, body, contentType: file.type || "application/octet-stream" });
  const lessonNumber = typeof lessonNumberValue === "string" && lessonNumberValue ? Number(lessonNumberValue) : null;
  const source = await db.sourceFile.create({
    data: { projectId: id, kind: sourceKind, originalName: file.name, objectKey: key, mimeType: file.type || "application/octet-stream", size: file.size, checksum, lessonNumber: Number.isInteger(lessonNumber) ? lessonNumber : null }
  });
  // DOCX is a zip/XML container, not an OCR job. Parse it while the upload request is still
  // open so Word files never wait behind a long-running scanned-PDF vision queue.
  if (sourceKind === "DOCUMENT") {
    try {
      const text = await extractWordText(body);
      await db.sourcePage.create({ data: { sourceFileId: source.id, pageNumber: 1, extractedText: text } });
    } catch (error) {
      await db.sourceFile.delete({ where: { id: source.id } }).catch(() => undefined);
      await objectStore().delete(key).catch(() => undefined);
      return NextResponse.json({ error: error instanceof Error ? `DOCX文字提取失败：${error.message}` : "DOCX文字提取失败" }, { status: 422 });
    }
  }
  return NextResponse.json({ file: source, duplicate: false }, { status: 201 });
}

/** Delete one uploaded source and its derived pages. Existing lesson drafts are retained for
 * comparison, but the project returns to draft status so it cannot silently generate from a
 * removed source. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (process.env.LOCAL_DEMO_MODE === "true") return NextResponse.json({ error: "本地演示模式不删除示例文件" }, { status: 409 });
  if (!(await ownedProject(id, session.userId))) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "缺少文件ID" }, { status: 400 });
  const source = await db.sourceFile.findFirst({ where: { id: fileId, projectId: id } });
  if (!source) return NextResponse.json({ error: "文件不存在或不属于当前项目" }, { status: 404 });

  const jobs = await db.processingJob.findMany({
    where: { projectId: id, kind: "PDF_PARSE", status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true, payload: true }
  });
  const relatedJobIds = jobs
    .filter((job) => (job.payload as { sourceFileId?: string }).sourceFileId === source.id)
    .map((job) => job.id);
  await db.$transaction([
    ...(relatedJobIds.length ? [db.processingJob.deleteMany({ where: { id: { in: relatedJobIds } } })] : []),
    db.sourcePage.deleteMany({ where: { sourceFileId: source.id } }),
    db.sourceFile.delete({ where: { id: source.id } }),
    db.project.update({ where: { id }, data: { status: "DRAFT" } })
  ]);
  await objectStore().delete(source.objectKey).catch(() => undefined);
  return NextResponse.json({ ok: true, fileId: source.id });
}
