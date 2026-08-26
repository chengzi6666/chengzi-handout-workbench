import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

const teacherSchema = z.object({
  formalName: z.string().trim().min(2).max(30),
  nickname: z.string().trim().min(2).max(30),
  grade: z.string().trim().max(20).optional(),
  introduction: z.string().trim().min(10).max(1000)
});

export async function GET() {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const teachers = await db.teacher.findMany({ include: { assets: { orderBy: { sortOrder: "asc" } } }, orderBy: { grade: "asc" } });
  return NextResponse.json({ teachers });
}

export async function POST(request: Request) {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = teacherSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "教师信息不正确" }, { status: 400 });
  const teacher = await db.teacher.create({ data: parsed.data });
  return NextResponse.json({ teacher }, { status: 201 });
}

