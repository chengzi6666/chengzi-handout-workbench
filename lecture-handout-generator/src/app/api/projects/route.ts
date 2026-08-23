import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  grade: z.string().trim().min(1).max(20),
  teachingYear: z.number().int().min(2022).max(2100),
  season: z.string().trim().max(20).optional(),
  lessonCount: z.number().int().min(1).max(20).default(5)
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const projects = await db.project.findMany({
    where: { ownerId: session.userId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }]
  });
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "项目信息不正确" }, { status: 400 });
  const project = await db.project.create({
    data: {
      ...parsed.data,
      ownerId: session.userId,
      outputs: {
        create: [
          { kind: "LESSON_STUDENT" },
          { kind: "COMBINED_STUDENT" }
        ]
      }
    }
  });
  return NextResponse.json({ project }, { status: 201 });
}

