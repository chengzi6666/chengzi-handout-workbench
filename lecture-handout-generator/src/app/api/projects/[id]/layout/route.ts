import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

const configSchema = z.object({ teacherImage: z.object({ assetId: z.string().optional(), x: z.number().min(0).max(100), y: z.number().min(0).max(100), width: z.number().min(5).max(80), height: z.number().min(5).max(80) }), fontFamily: z.enum(["Microsoft YaHei", "SimSun", "KaiTi", "FangSong"]).default("Microsoft YaHei"), fontSize: z.number().min(10).max(18).default(11) });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(); if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = configSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "版式参数不正确" }, { status: 400 });
  const { id } = await context.params;
  const result = await db.project.updateMany({ where: { id, ownerId: session.userId }, data: { layoutConfig: parsed.data, status: "LAYOUT_REVIEW" } });
  if (!result.count) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
