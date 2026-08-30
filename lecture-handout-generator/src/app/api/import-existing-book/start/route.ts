import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const gradeCodes: Record<string, string> = { "0升1": "0l1", "1升2": "1l2", "2升3": "2l3", "3升4": "3l4", "4升5": "4l5" };

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const grade = String(body.grade ?? "").trim();
  const description = String(body.description ?? `${grade}读写课电子讲义`).trim();
  const teachingYear = Number(body.teachingYear ?? new Date().getFullYear());
  if (!title || !gradeCodes[grade]) return NextResponse.json({ error: "标题或年级无效" }, { status: 400 });
  const slug = randomBytes(6).toString("base64url");
  const project = await db.project.create({ data: { name: title, grade, teachingYear, season: "秋季", status: "LAYOUT_GENERATING", lessonCount: 5, ownerId: session.userId, layoutConfig: { importedWordBook: true, importDescription: description, importSlug: slug } } });
  return NextResponse.json({ projectId: project.id, slug });
}
