import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { ReviewWorkspace } from "@/components/review-workspace";
import { lessonContentSchema } from "@/lib/handout/content-schema";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await db.project.findFirst({ where: { id, ownerId: user.id }, include: { lessons: { orderBy: { lessonNumber: "asc" } } } });
  if (!project) redirect("/");
  // A refresh can reach this route while the background content job is still running.
  // Never mount the editor with a legacy/partial JSON object: its array fields are not ready yet.
  const completeLessons = project.lessons.flatMap((lesson) => {
    const parsed = lessonContentSchema.safeParse(lesson.structuredContent);
    return parsed.success ? [{ lesson, content: parsed.data }] : [];
  });
  if (completeLessons.length === 0) redirect("/");
  return <ReviewWorkspace project={{ id: project.id, name: project.name, grade: project.grade, lessonCount: project.lessonCount }} initialLessons={completeLessons.map(({ lesson, content }) => ({ id: lesson.id, lessonNumber: lesson.lessonNumber, title: lesson.title, content, textApproved: Boolean(lesson.textApprovedAt), pinyinApproved: Boolean(lesson.pinyinApprovedAt) }))} />;
}
