import { WorkspaceShell } from "@/components/workspace-shell";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import type { HandoutProject, OutputKind, ProjectStatus } from "@/lib/domain";

export const dynamic = "force-dynamic";

const statusMap: Record<string, ProjectStatus> = {
  DRAFT: "draft",
  PARSING: "draft",
  TEXT_REVIEW: "text_review",
  PINYIN_REVIEW: "text_review",
  LAYOUT_GENERATING: "layout_review",
  LAYOUT_REVIEW: "layout_review",
  COMPLETED: "completed",
  FAILED: "draft"
};
const outputMap: Partial<Record<string, OutputKind>> = { LESSON_STUDENT: "lesson_student", COMBINED_STUDENT: "combined_student", COMBINED_ANSWERS: "combined_answers", PARENT_MANUAL: "parent_manual", LESSON_ANSWERS: "lesson_answers" };

export default async function HomePage() {
  const user = await requireUser();
  const rows = await db.project.findMany({
    where: { ownerId: user.id },
    include: { outputs: true },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }]
  });
  const projects: HandoutProject[] = rows.map((project) => ({
    id: project.id,
    name: project.name,
    grade: project.grade,
    lessonCount: project.lessonCount,
    teachingYear: project.teachingYear,
    teachingYearConfirmed: Boolean(project.teachingYearConfirmedAt),
    outputKinds: project.outputs.filter((output) => output.enabled).map((output) => outputMap[output.kind]).filter((kind): kind is OutputKind => Boolean(kind)),
    status: statusMap[project.status] ?? "draft",
    pinned: project.pinned,
    updatedAt: new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(project.updatedAt)
  }));
  return <WorkspaceShell initialProjects={projects} user={{ employeeNumber: user.employeeNumber, name: user.name }} />;
}
