import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/object-store";

/** Serves a manually uploaded replacement question image to authenticated previews. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const file = await db.sourceFile.findFirst({
    where: { id, kind: "QUESTION_IMAGE", project: { ownerId: session.userId } },
  });
  if (!file) return NextResponse.json({ error: "题图不存在" }, { status: 404 });
  const bytes = Buffer.from(await objectStore().get(file.objectKey));
  return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
    headers: { "content-type": file.mimeType, "cache-control": "private, max-age=3600" },
  });
}
