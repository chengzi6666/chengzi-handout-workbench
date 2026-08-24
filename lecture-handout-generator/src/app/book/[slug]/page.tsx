import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Flipbook } from "@/components/flipbook";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const book = await db.publishedFlipbook.findUnique({ where: { slug } });
  if (!book) return { title: "电子讲义" };
  return { title: book.title, description: book.description, openGraph: { title: book.title, description: book.description, type: "book", locale: "zh_CN", images: [{ url: `/book/${slug}/opengraph-image`, width: 1200, height: 630, alt: `${book.title}电子讲义` }] } };
}
export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const book = await db.publishedFlipbook.findUnique({ where: { slug } }); if (!book) notFound();
  return <Flipbook title={book.title} description={book.description} pages={book.content as Array<Record<string, unknown>>} />;
}
