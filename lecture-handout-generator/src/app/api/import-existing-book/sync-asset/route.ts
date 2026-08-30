import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mirrorPublishedAsset } from "@/lib/wechat-cloud-sync";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const projectId = String(body.projectId ?? "");
  const sourceFileId = String(body.sourceFileId ?? "");
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: session.userId }, include: { flipbooks: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!project?.flipbooks[0]) return NextResponse.json({ error: "电子书尚未发布" }, { status: 404 });
  const source = await db.sourceFile.findFirst({ where: { id: sourceFileId, projectId } });
  if (!source) return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  const flipbook = project.flipbooks[0];
  const configuredOrigin = process.env.PUBLIC_APP_URL?.replace(/\/$/u, "");
  const origin = configuredOrigin && !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/iu.test(configuredOrigin) ? configuredOrigin : new URL(request.url).origin;
  const pageImageUrl = `${origin}/api/book/${flipbook.slug}/page-image/${source.id}`;
  const fileID = await mirrorPublishedAsset(pageImageUrl, flipbook.slug, String(flipbook.updatedAt.getTime()));
  return NextResponse.json({ pageImageUrl, fileID });
}
