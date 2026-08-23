import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { LayoutWorkspace } from "@/components/layout-workspace";

export const dynamic = "force-dynamic";
export default async function LayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const [project, teachers] = await Promise.all([
    db.project.findFirst({ where: { id, ownerId: user.id }, include: { backgroundPack: { include: { assets: true } } } }),
    db.teacher.findMany({ where: { enabled: true }, include: { assets: { orderBy: { sortOrder: "asc" } } }, orderBy: { formalName: "asc" } })
  ]);
  if (!project) redirect("/");
  return <LayoutWorkspace project={{ id: project.id, name: project.name, grade: project.grade, teacherId: project.teacherId, layoutConfig: project.layoutConfig }} backgrounds={project.backgroundPack?.assets ?? []} teachers={teachers.map((teacher) => ({ id: teacher.id, formalName: teacher.formalName, nickname: teacher.nickname, grade: teacher.grade, assets: teacher.assets.map((asset) => ({ id: asset.id, label: asset.label, kind: asset.kind })) }))} />;
}
