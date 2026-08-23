import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const jobs = await db.processingJob.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ projectStatus: project.status, jobs });
}
