import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { requiresPinyinReview } from "@/lib/handout/content-schema";
import { PinyinWorkspace } from "@/components/pinyin-workspace";

export const dynamic = "force-dynamic";
export default async function PinyinPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findFirst({ where: { id, ownerId: user.id }, include: { lessons: { orderBy: { lessonNumber: "asc" } } } });
  if (!project || !requiresPinyinReview(project.grade)) redirect("/");
  return <PinyinWorkspace project={{ id: project.id, name: project.name }} lessons={project.lessons.map((lesson) => ({ id: lesson.id, lessonNumber: lesson.lessonNumber, title: lesson.title, approved: Boolean(lesson.pinyinApprovedAt) }))} />;
}
