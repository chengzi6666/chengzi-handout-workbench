import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { ReviewWorkspace } from "@/components/review-workspace";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findFirst({ where: { id, ownerId: user.id }, include: { lessons: { orderBy: { lessonNumber: "asc" } } } });
  if (!project) redirect("/");
  return <ReviewWorkspace project={{ id: project.id, name: project.name, grade: project.grade, lessonCount: project.lessonCount }} initialLessons={project.lessons.map((lesson) => ({ id: lesson.id, lessonNumber: lesson.lessonNumber, title: lesson.title, content: lesson.structuredContent, textApproved: Boolean(lesson.textApprovedAt), pinyinApproved: Boolean(lesson.pinyinApprovedAt) }))} />;
}
