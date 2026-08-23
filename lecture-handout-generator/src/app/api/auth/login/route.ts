import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const inputSchema = z.object({
  employeeNumber: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/, "工号格式不正确"),
  name: z.string().trim().min(2).max(24)
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "登录信息不正确" }, { status: 400 });

  const { employeeNumber, name } = parsed.data;
  const existing = await db.user.findUnique({ where: { employeeNumber } });
  if (existing && existing.name !== name) {
    return NextResponse.json({ error: "工号与姓名不匹配" }, { status: 403 });
  }

  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } })
    : await db.user.create({ data: { employeeNumber, name, lastLoginAt: new Date() } });

  await createSession({ userId: user.id, employeeNumber: user.employeeNumber, name: user.name });
  return NextResponse.json({ user: { id: user.id, employeeNumber: user.employeeNumber, name: user.name } });
}

