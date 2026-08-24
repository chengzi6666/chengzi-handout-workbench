import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/storage/object-store";

/** Public only after the owning project has published this exact book slug. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await context.params;
  const asset = await db.backgroundAsset.findFirst({ where: { id, backgroundPack: { projects: { some: { flipbooks: { some: { slug } } } } } } });
  if (!asset) return NextResponse.json({ error: "背景不存在" }, { status: 404 });
  const bytes = Buffer.from(await objectStore().get(asset.objectKey));
  return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { headers: { "content-type": asset.objectKey.toLowerCase().endsWith(".jpg") || asset.objectKey.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png", "cache-control": "public, max-age=86400" } });
}
