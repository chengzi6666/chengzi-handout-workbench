import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { generateProjectContent } from "@/lib/handout/generate-project-content";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  try {
    const lessons = await generateProjectContent(project.id);
    return NextResponse.json({ lessonIds: lessons });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "内容生成失败" }, { status: 422 });
  }
}
