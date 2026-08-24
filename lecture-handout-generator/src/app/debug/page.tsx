import { DebugWorkbench } from "@/components/debug-workbench";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({ where: { ownerId: user.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } });
  return <DebugWorkbench projects={projects} />;
}
