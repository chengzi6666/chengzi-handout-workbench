import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function absoluteAssets(value: unknown, origin: string): unknown {
  if (typeof value === "string" && value.startsWith("/")) return origin + value;
  if (Array.isArray(value)) return value.map((item) => absoluteAssets(item, origin));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, absoluteAssets(item, origin)]));
  }
  return value;
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const book = await db.publishedFlipbook.findUnique({
    where: { slug },
    include: { project: { include: { backgroundPack: { include: { assets: true } } } } },
  });
  if (!book) return NextResponse.json({ error: "电子书不存在" }, { status: 404 });
  const origin = new URL(request.url).origin;
  const version = book.updatedAt.getTime();
  const cover = book.project.backgroundPack?.assets.find((item) => item.role === "COVER");
  const shareCover = book.project.backgroundPack?.assets.find((item) => item.role === "WECHAT_SHARE");
  return NextResponse.json({
    slug: book.slug,
    grade: book.project.grade,
    title: book.title,
    description: book.description,
    updatedAt: book.updatedAt,
    coverUrl: cover ? origin + "/api/book/" + slug + "/background/" + cover.id + "?v=" + version : null,
    shareCoverUrl: shareCover ? origin + "/api/book/" + slug + "/background/" + shareCover.id + "?v=" + version : null,
    pages: absoluteAssets(book.content, origin),
  });
}
