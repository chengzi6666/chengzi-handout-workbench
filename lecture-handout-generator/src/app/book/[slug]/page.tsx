import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Flipbook } from "@/components/flipbook";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const book = await db.publishedFlipbook.findUnique({ where: { slug }, include: { project: { include: { backgroundPack: { include: { assets: true } } } } } });
  if (!book) return { title: "电子讲义" };
  const requestHeaders = await headers();
  const configuredOrigin = process.env.PUBLIC_APP_URL?.replace(/\/$/u, "");
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = configuredOrigin || (host ? `${proto}://${host}` : "");
  const relativeImage = `/book/${slug}/opengraph-image?v=${book.updatedAt.getTime()}`;
  const imageUrl = origin ? `${origin}${relativeImage}` : relativeImage;
  return {
    title: book.title,
    description: book.description,
    openGraph: { title: book.title, description: book.description, type: "book", locale: "zh_CN", url: origin ? `${origin}/book/${slug}` : undefined, images: [{ url: imageUrl, width: 1200, height: 630, alt: `${book.title}电子讲义` }] },
    twitter: { card: "summary_large_image", title: book.title, description: book.description, images: [imageUrl] },
  };
}
export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await db.publishedFlipbook.findUnique({ where: { slug }, include: { project: { include: { backgroundPack: { include: { assets: true } } } } } });
  if (!book) notFound();
  const shareCoverAsset = book.project.backgroundPack?.assets.find((asset) => asset.role === "WECHAT_SHARE");
  const version = book.updatedAt.getTime();
  const pages = book.content as Array<Record<string, unknown> & { pageImageUrl?: string }>;
  const firstPageImage = pages[0]?.pageImageUrl;
  // Imported Word books use the rendered first Word page as the real cover.
  // Once the cover is opened, start from page 2 so page 1 is not shown twice.
  const readerPages = firstPageImage ? pages.slice(1) : pages;
  const coverSrc = firstPageImage;
  const shareCoverSrc = shareCoverAsset ? `/api/book/${slug}/background/${shareCoverAsset.id}?v=${version}` : firstPageImage;
  const crop = (book.project.layoutConfig as { backgroundCrop?: Record<string, { x?: number; y?: number }> } | null)?.backgroundCrop ?? {};
  return <Flipbook title={book.title} description={book.description} pages={readerPages} coverSrc={coverSrc} shareCoverSrc={shareCoverSrc} coverPosition={{ x: 50, y: 50 }} shareCoverPosition={crop.WECHAT_SHARE} />;
}
