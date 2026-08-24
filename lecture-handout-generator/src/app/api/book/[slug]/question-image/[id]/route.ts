import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/storage/object-store";

/** Public image endpoint used only by an already-published flipbook. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await context.params;
  const file = await db.sourceFile.findFirst({
    where: { id, kind: "QUESTION_IMAGE", project: { flipbooks: { some: { slug } } } },
  });
  if (!file) return NextResponse.json({ error: "题图不存在" }, { status: 404 });
  const bytes = Buffer.from(await objectStore().get(file.objectKey));
  return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
    headers: { "content-type": file.mimeType, "cache-control": "public, max-age=86400" },
  });
}
