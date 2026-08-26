import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { objectStore } from "@/lib/object-store";
import { safeFileName } from "@/lib/storage-keys";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const reports = await db.debugReport.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 30 });
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await request.formData();
  const note = String(form.get("note") ?? "").trim();
  if (!note) return NextResponse.json({ error: "请先描述需要调整的问题" }, { status: 400 });
  const file = form.get("image");
  let imageKey: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "截图不能超过12MB" }, { status: 400 });
    imageKey = `debug-reports/${session.userId}/${Date.now()}-${safeFileName(file.name || "screen.png")}`;
    await objectStore().put({ key: imageKey, body: new Uint8Array(await file.arrayBuffer()), contentType: file.type || "image/png" });
  }
  const selectionRaw = String(form.get("selection") ?? "");
  let selection: unknown = undefined;
  try { selection = selectionRaw ? JSON.parse(selectionRaw) : undefined; } catch { return NextResponse.json({ error: "框选坐标格式错误" }, { status: 400 }); }
  const projectId = String(form.get("projectId") ?? "").trim() || null;
  if (projectId) {
    const owns = await db.project.findFirst({ where: { id: projectId, ownerId: session.userId } });
    if (!owns) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const report = await db.debugReport.create({ data: { userId: session.userId, projectId, pageUrl: String(form.get("pageUrl") ?? "").trim() || null, note, selection: selection as never, imageKey } });
  return NextResponse.json({ report }, { status: 201 });
}
