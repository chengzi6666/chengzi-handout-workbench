import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { objectStore } from "@/lib/storage/object-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const asset = await db.backgroundAsset.findFirst({ where: { id, backgroundPack: { projects: { some: { ownerId: session.userId } } } } });
  if (!asset) return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  const bytes = Buffer.from(await objectStore().get(asset.objectKey));
  return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { headers: { "content-type": "image/*", "cache-control": "private, max-age=3600" } });
}
