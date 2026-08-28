import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { syncPublishedBookManifest } from "@/lib/wechat-cloud-sync";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const projectId = String(body.projectId ?? "");
  const assets = body.assets && typeof body.assets === "object" ? body.assets as Record<string, string> : {};
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: session.userId }, include: { flipbooks: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!project?.flipbooks[0]) return NextResponse.json({ error: "电子书尚未发布" }, { status: 404 });
  const flipbook = project.flipbooks[0];
  const content = Array.isArray(flipbook.content) ? flipbook.content : [];
  const configuredOrigin = process.env.PUBLIC_APP_URL?.replace(/\/$/u, "");
  const origin = configuredOrigin && !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/iu.test(configuredOrigin) ? configuredOrigin : new URL(request.url).origin;
  const pages = content.map((value) => {
    const page = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const raw = String(page.pageImageUrl ?? "");
    const absolute = raw.startsWith("http") ? raw : origin + raw;
    return { ...page, pageImageUrl: assets[absolute] || absolute };
  });
  if (!pages.length || pages.some((page) => !String(page.pageImageUrl).startsWith("cloud://"))) return NextResponse.json({ error: "微信云页面素材尚未全部同步" }, { status: 400 });
  await syncPublishedBookManifest({ slug: flipbook.slug, grade: project.grade, title: flipbook.title, description: flipbook.description, updatedAt: flipbook.updatedAt, coverUrl: String(pages[0].pageImageUrl), shareCoverUrl: String(pages[0].pageImageUrl), pages });
  return NextResponse.json({ ok: true, slug: flipbook.slug, pageCount: pages.length });
}
