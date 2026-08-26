import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/storage/object-store";

/** Public only when the teacher asset belongs to the project that published this slug. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await context.params;
  const asset = await db.teacherAsset.findFirst({
    where: {
      id,
      teacher: { projects: { some: { flipbooks: { some: { slug } } } } },
    },
  });
  if (!asset) return NextResponse.json({ error: "教师图片不存在" }, { status: 404 });
  const bytes = Buffer.from(await objectStore().get(asset.objectKey));
  const contentType = asset.objectKey.toLowerCase().match(/\.jpe?g$/u) ? "image/jpeg" : "image/png";
  return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { headers: { "content-type": contentType, "cache-control": "public, max-age=86400" } });
}
