import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const jobs = await db.processingJob.findMany({
    where: { project: { ownerId: session.userId, deletedAt: null } }, orderBy: { createdAt: "desc" }, take: 40,
    select: { id: true, kind: true, status: true, createdAt: true, startedAt: true, finishedAt: true, error: true, result: true, project: { select: { id: true, name: true, status: true } } }
  });
  return NextResponse.json({ serverTime: new Date().toISOString(), jobs });
}
