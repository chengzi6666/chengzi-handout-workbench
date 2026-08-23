import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { assertReadyForLayout, lessonContentSchema } from "@/lib/handout/content-schema";
import { generateHandoutDocx } from "@/lib/docx/generate";
import { validatePinyinReview, type PinyinUnit } from "@/lib/handout/pinyin";
import { objectStore } from "@/lib/storage/object-store";
import { getOrCreateSourcePageImage } from "@/lib/pdf/source-page-image";

const allowed = new Set(["combined_student", "combined_answers", "parent_manual", "lesson_student", "lesson_answers"]);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "combined_student";
  const lessonNumber = Number(url.searchParams.get("lesson") ?? "0");
  if (!allowed.has(kind)) return NextResponse.json({ error: "不支持的输出类型" }, { status: 400 });
  const project = await db.project.findFirst({ where: { id, ownerId: session.userId }, include: { teacher: { include: { assets: true } }, backgroundPack: { include: { assets: true } }, lessons: { orderBy: { lessonNumber: "asc" } } } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  let lessons = project.lessons.map((lesson) => ({ row: lesson, content: lessonContentSchema.parse(lesson.structuredContent) }));
  if (kind.startsWith("lesson_")) lessons = lessons.filter((lesson) => lesson.row.lessonNumber === lessonNumber);
  if (lessons.length === 0) return NextResponse.json({ error: "没有可输出的课程" }, { status: 409 });
  try {
    lessons.forEach(({ row, content }) => assertReadyForLayout(content, project.grade, Boolean(row.pinyinApprovedAt)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "课程尚未通过审核" }, { status: 409 });
  }
  const mode = kind === "parent_manual" ? "parent" : kind.includes("answers") ? "answers" : "student";
  const pinyinReviews: Record<number, PinyinUnit[]> = {};
  for (const { row, content } of lessons) {
    if (row.pinyinReview) pinyinReviews[row.lessonNumber] = validatePinyinReview(content.readingExcerpt.text, row.pinyinReview as PinyinUnit[]);
  }
  const typeOf = (key: string): "png" | "jpg" | "gif" | "bmp" => key.toLowerCase().match(/\.jpe?g$/) ? "jpg" : key.toLowerCase().endsWith(".gif") ? "gif" : key.toLowerCase().endsWith(".bmp") ? "bmp" : "png";
  const backgrounds: Record<string, { data: Buffer; type: "png" | "jpg" | "gif" | "bmp" }> = {};
  for (const asset of project.backgroundPack?.assets ?? []) backgrounds[asset.role] = { data: Buffer.from(await objectStore().get(asset.objectKey)), type: typeOf(asset.objectKey) };
  // 没有上传背景时也不能退化成白纸。内置背景来自经确认的二年级成品讲义；用户上传的同用途背景始终优先。
  const bundledBackground = async (name: string) => ({ data: await readFile(join(process.cwd(), "public", "handout-backgrounds", name)), type: "png" as const });
  const defaults = {
    blush: await bundledBackground("blush-school.png"),
    mint: await bundledBackground("mint-school.png"),
    butter: await bundledBackground("butter-school.png"),
  };
  const defaultRoles: Record<string, keyof typeof defaults> = {
    SIMPLE: "blush", COVER: "butter", PARENT_MANUAL: "mint", LESSON_HOME: "butter",
    CONVERSATION: "blush", READING: "mint", PRACTICE: "butter", LITTLE_TEACHER: "blush",
  };
  for (const [role, palette] of Object.entries(defaultRoles)) backgrounds[role] ??= defaults[palette];
  const layout = project.layoutConfig as { teacherImage?: { assetId?: string; x: number; y: number; width: number; height: number } } | null;
  const gradeKey = ({ "0升1": "0l1", "1升2": "1l2", "2升3": "2l3", "3升4": "3l4", "4升5": "4l5" } as Record<string, string>)[project.grade] ?? "1l2";
  const defaultTeacher = async (kind: "expression" | "portrait") => ({ data: await readFile(join(process.cwd(), "public", "teacher-defaults", `${gradeKey}-${kind}.png`)), type: "png" as const });
  const expressionAsset = project.teacher?.assets.find((asset) => asset.id === layout?.teacherImage?.assetId) ?? project.teacher?.assets.find((asset) => asset.kind === "EXPRESSION");
  const portraitAsset = project.teacher?.assets.find((asset) => asset.kind === "PORTRAIT");
  const teacherImage = expressionAsset ? { data: Buffer.from(await objectStore().get(expressionAsset.objectKey)), type: typeOf(expressionAsset.objectKey) } : await defaultTeacher("expression");
  const teacherPortrait = portraitAsset ? { data: Buffer.from(await objectStore().get(portraitAsset.objectKey)), type: typeOf(portraitAsset.objectKey) } : await defaultTeacher("portrait");
  const pageIds = lessons.flatMap(({ content }) => content.practice.map((item) => item.imageSourcePageId).filter((value): value is string => Boolean(value)));
  const sourcePages = pageIds.length ? await db.sourcePage.findMany({ where: { id: { in: pageIds }, sourceFile: { projectId: project.id } } }) : [];
  const practiceImages: Record<string, { data: Buffer; type: "png" | "jpg" | "gif" | "bmp" }> = {};
  for (const page of sourcePages) {
    const image = await getOrCreateSourcePageImage(page.id);
    if (image) practiceImages[page.id] = { data: Buffer.from(image.data), type: image.type };
  }
  const manualImageIds = lessons.flatMap(({ content }) => content.practice.map((item) => item.imageSourceFileId).filter((value): value is string => Boolean(value)));
  const manualImages = manualImageIds.length ? await db.sourceFile.findMany({ where: { id: { in: manualImageIds }, projectId: project.id, kind: "QUESTION_IMAGE" } }) : [];
  for (const image of manualImages) practiceImages[image.id] = { data: Buffer.from(await objectStore().get(image.objectKey)), type: typeOf(image.objectKey) };
  const buffer = await generateHandoutDocx({ projectName: project.name, grade: project.grade, teachingYear: project.teachingYear, teacherFormalName: project.teacher?.formalName, teacherNickname: project.teacher?.nickname, lessons: lessons.map((item) => item.content), pinyinReviews, backgrounds, teacherImage, teacherPortrait, teacherPosition: layout?.teacherImage, practiceImages, includeFrontMatter: kind === "combined_student", mode });
  const fileName = `${project.name}-${kind}${lessonNumber ? `-第${lessonNumber}讲` : ""}.docx`.replace(/[\\/:*?"<>|]/g, "-");
  return new NextResponse(buffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}` } });
}
