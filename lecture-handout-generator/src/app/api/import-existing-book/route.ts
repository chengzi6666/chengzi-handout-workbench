import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { objectStore } from "@/lib/object-store";
import { syncPublishedBookToWechat } from "@/lib/wechat-cloud-sync";

const gradeCodes: Record<string, string> = { "0升1": "0l1", "1升2": "1l2", "2升3": "2l3", "3升4": "3l4", "4升5": "4l5" };

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const grade = String(form.get("grade") ?? "").trim();
  const description = String(form.get("description") ?? `${grade}读写课电子讲义`).trim();
  const teachingYear = Number(form.get("teachingYear") ?? new Date().getFullYear());
  const studentPages = form.getAll("studentPages").filter((item): item is File => item instanceof File);
  const answerPages = form.getAll("answerPages").filter((item): item is File => item instanceof File);
  if (!title || !gradeCodes[grade] || studentPages.length === 0 || answerPages.length === 0) {
    return NextResponse.json({ error: "标题、年级、学生讲义页面和答案页面均不能为空" }, { status: 400 });
  }

  const project = await db.project.create({ data: { name: title, grade, teachingYear, season: "秋季", status: "COMPLETED", lessonCount: 5, ownerId: session.userId, layoutConfig: { importedWordBook: true } } });
  const slug = randomBytes(6).toString("base64url");
  const content: Array<Record<string, unknown>> = [];
  try {
    for (const [collection, pages] of [["student", studentPages], ["answers", answerPages]] as const) {
      for (let index = 0; index < pages.length; index += 1) {
        const file = pages[index];
        const bytes = Buffer.from(await file.arrayBuffer());
        const key = `projects/${project.id}/existing-book/${collection}/${String(index + 1).padStart(3, "0")}.webp`;
        await objectStore().put({ key, body: bytes, contentType: file.type || "image/webp" });
        const source = await db.sourceFile.create({ data: { projectId: project.id, kind: "BACKGROUND_IMAGE", originalName: file.name, objectKey: key, mimeType: file.type || "image/webp", size: bytes.length, lessonNumber: index + 1 } });
        content.push({ collection, kind: "document-page", title: collection === "student" ? `学生讲义第${index + 1}页` : `参考答案第${index + 1}页`, pageNumber: index + 1, pageImageUrl: `/api/book/${slug}/page-image/${source.id}` });
      }
    }
    const flipbook = await db.publishedFlipbook.create({ data: { projectId: project.id, slug, title, description, content: content as Prisma.InputJsonValue } });
    const configuredOrigin = process.env.PUBLIC_APP_URL?.replace(/\/$/u, "");
    const origin = configuredOrigin && !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/iu.test(configuredOrigin) ? configuredOrigin : new URL(request.url).origin;
    const absolutePages = content.map((page) => ({ ...page, pageImageUrl: origin + String(page.pageImageUrl) }));
    await syncPublishedBookToWechat({ slug, grade, title, description, updatedAt: flipbook.updatedAt, coverUrl: String(absolutePages[0].pageImageUrl), shareCoverUrl: String(absolutePages[0].pageImageUrl), pages: absolutePages });
    return NextResponse.json({ projectId: project.id, slug, pageCount: content.length, url: `${origin}/book/${slug}`, miniProgramPath: `/pages/book/index?grade=${gradeCodes[grade]}&slug=${slug}` });
  } catch (error) {
    await db.project.delete({ where: { id: project.id } }).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "导入失败" }, { status: 500 });
  }
}