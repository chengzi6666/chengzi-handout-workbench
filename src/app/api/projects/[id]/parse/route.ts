import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId }, include: { sourceFiles: { where: { kind: { in: ["PDF", "DOCUMENT"] } }, include: { pages: true } } } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (!project.teachingYearConfirmedAt) return NextResponse.json({ error: `请先确认本项目使用${project.teachingYear}年教材口径` }, { status: 409 });
  if (project.sourceFiles.length === 0) return NextResponse.json({ error: "请先上传至少一个 PDF 或 DOCX 主讲文件" }, { status: 409 });
  const active = await db.processingJob.count({ where: { projectId: id, kind: "PDF_PARSE", status: { in: ["QUEUED", "RUNNING"] } } });
  if (active > 0) return NextResponse.json({ error: "PDF正在解析，请勿重复提交" }, { status: 409 });
  const pendingSources = project.sourceFiles.filter((file) => file.pages.length === 0);
  const existingContent = await db.processingJob.count({ where: { projectId: id, kind: "CONTENT_GENERATE", status: { in: ["QUEUED", "RUNNING", "SUCCEEDED"] } } });
  await db.$transaction([
    db.processingJob.deleteMany({ where: { projectId: id, kind: "PDF_PARSE", status: { in: ["FAILED", "SUCCEEDED"] } } }),
    db.processingJob.deleteMany({ where: { projectId: id, kind: "CONTENT_GENERATE", status: "FAILED" } }),
    ...pendingSources.map((file) => db.processingJob.create({ data: { projectId: id, kind: "PDF_PARSE", payload: { sourceFileId: file.id } } })),
    ...(pendingSources.length === 0 && existingContent === 0 ? [db.processingJob.create({ data: { projectId: id, kind: "CONTENT_GENERATE", payload: { automatic: true } } })] : []),
    db.project.update({ where: { id }, data: { status: "PARSING" } })
  ]);
  return NextResponse.json({ ok: true, jobCount: pendingSources.length, wordReady: project.sourceFiles.length - pendingSources.length }, { status: 202 });
}
