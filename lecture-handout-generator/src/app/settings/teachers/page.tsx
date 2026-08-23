import { requireUser } from "@/lib/auth/current-user";
import { TeacherSettings } from "@/components/teacher-settings";

export const dynamic = "force-dynamic";

export default async function TeacherSettingsPage() {
  await requireUser();
  return <TeacherSettings />;
}

