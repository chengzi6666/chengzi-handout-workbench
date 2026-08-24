import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { objectStore } from "@/lib/storage/object-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const report = await db.debugReport.findFirst({ where: { id, userId: session.userId } });
  if (!report?.imageKey) return NextResponse.json({ error: "截图不存在" }, { status: 404 });
  const image = await objectStore().get(report.imageKey);
  if (!image) return NextResponse.json({ error: "截图文件不存在" }, { status: 404 });
  const contentType = report.imageKey.endsWith(".webp") ? "image/webp" : report.imageKey.endsWith(".jpg") || report.imageKey.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  const bytes = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer;
  return new NextResponse(bytes, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" } });
}
