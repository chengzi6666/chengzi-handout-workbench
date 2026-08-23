import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { getOrCreateSourcePageImage } from "@/lib/pdf/source-page-image";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params; const page = await db.sourcePage.findFirst({ where: { id, sourceFile: { project: { ownerId: session.userId } } } });
  if (!page) return NextResponse.json({ error: "页面不存在" }, { status: 404 });
  const image = await getOrCreateSourcePageImage(page.id);
  if (!image) return NextResponse.json({ error: "Word 文档页面没有可用的原图" }, { status: 404 });
  const bytes = Buffer.from(image.data);
  return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { headers: { "content-type": "image/png", "cache-control": "private, max-age=3600" } });
}
