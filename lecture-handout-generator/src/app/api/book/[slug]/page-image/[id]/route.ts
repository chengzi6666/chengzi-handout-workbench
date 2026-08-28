import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/object-store";

export async function GET(_request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await context.params;
  const file = await db.sourceFile.findFirst({ where: { id, project: { flipbooks: { some: { slug } } } } });
  if (!file) return new NextResponse("not found", { status: 404 });
  const bytes = Buffer.from(await objectStore().get(file.objectKey));
  return new NextResponse(bytes, { headers: { "content-type": file.mimeType, "cache-control": "public, max-age=31536000, immutable" } });
}