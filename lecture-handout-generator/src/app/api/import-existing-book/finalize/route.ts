import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { syncPublishedBookToWechat } from "@/lib/wechat-cloud-sync";

const gradeCodes: Record<string, string> = { "0升1": "0l1", "1升2": "1l2", "2升3": "2l3", "3升4": "3l4", "4升5": "4l5" };

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const projectId = String(body.projectId ?? "");
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: session.userId }, include: { sourceFiles: true, flipbooks: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const config = (project.layoutConfig ?? {}) as { importSlug?: string; importDescription?: string };
  if (!config.importSlug) return NextResponse.json({ error: "不是分批导入项目" }, { status: 400 });
  const files = project.sourceFiles.filter((file) => file.objectKey.includes("/existing-book/")).sort((a, b) => a.objectKey.localeCompare(b.objectKey));
  const student = files.filter((file) => file.objectKey.includes("/student/"));
  const answers = files.filter((file) => file.objectKey.includes("/answers/"));
  if (!student.length || !answers.length) return NextResponse.json({ error: "学生讲义或参考答案页面尚未上传完整" }, { status: 400 });
  const content = [...student, ...answers].map((file) => {
    const collection = file.objectKey.includes("/student/") ? "student" : "answers";
    return { collection, kind: "document-page", title: collection === "student" ? `学生讲义第${file.lessonNumber}页` : `参考答案第${file.lessonNumber}页`, pageNumber: file.lessonNumber, pageImageUrl: `/api/book/${config.importSlug}/page-image/${file.id}` };
  });
  const flipbook = project.flipbooks[0]
    ? await db.publishedFlipbook.update({ where: { id: project.flipbooks[0].id }, data: { title: project.name, description: config.importDescription || `${project.grade}读写课电子讲义`, content: content as Prisma.InputJsonValue } })
    : await db.publishedFlipbook.create({ data: { projectId, slug: config.importSlug, title: project.name, description: config.importDescription || `${project.grade}读写课电子讲义`, content: content as Prisma.InputJsonValue } });
  await db.project.update({ where: { id: projectId }, data: { status: "COMPLETED" } });
  const configuredOrigin = process.env.PUBLIC_APP_URL?.replace(/\/$/u, "");
  const origin = configuredOrigin && !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/iu.test(configuredOrigin) ? configuredOrigin : new URL(request.url).origin;
  const absolutePages = content.map((page) => ({ ...page, pageImageUrl: origin + page.pageImageUrl }));
  await syncPublishedBookToWechat({ slug: flipbook.slug, grade: project.grade, title: project.name, description: flipbook.description, updatedAt: flipbook.updatedAt, coverUrl: absolutePages[0].pageImageUrl, shareCoverUrl: absolutePages[0].pageImageUrl, pages: absolutePages });
  return NextResponse.json({ projectId, slug: flipbook.slug, pageCount: content.length, url: `${origin}/book/${flipbook.slug}`, miniProgramPath: `/pages/book/index?grade=${gradeCodes[project.grade]}&slug=${flipbook.slug}` });
}
