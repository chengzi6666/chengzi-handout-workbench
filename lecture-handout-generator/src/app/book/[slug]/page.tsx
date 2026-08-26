import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Flipbook } from "@/components/flipbook";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const book = await db.publishedFlipbook.findUnique({ where: { slug }, include: { project: { include: { backgroundPack: { include: { assets: true } } } } } });
  if (!book) return { title: "电子讲义" };
  const uploadedShareCover = book.project.backgroundPack?.assets.find((asset) => asset.role === "WECHAT_SHARE");
  const origin = process.env.PUBLIC_APP_URL?.replace(/\/$/u, "");
  const relativeImage = uploadedShareCover ? `/api/book/${slug}/background/${uploadedShareCover.id}` : `/book/${slug}/opengraph-image`;
  const imageUrl = origin ? `${origin}${relativeImage}` : relativeImage;
  return {
    title: book.title,
    description: book.description,
    openGraph: { title: book.title, description: book.description, type: "book", locale: "zh_CN", url: origin ? `${origin}/book/${slug}` : undefined, images: [{ url: imageUrl, width: 1200, height: 630, alt: `${book.title}电子讲义` }] },
    twitter: { card: "summary_large_image", title: book.title, description: book.description, images: [imageUrl] },
  };
}
export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const book = await db.publishedFlipbook.findUnique({ where: { slug } }); if (!book) notFound();
  return <Flipbook title={book.title} description={book.description} pages={book.content as Array<Record<string, unknown>>} />;
}
