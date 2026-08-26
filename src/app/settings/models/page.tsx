import { requireUser } from "@/lib/auth/current-user";
import { ModelSettings } from "@/components/model-settings";

export const dynamic = "force-dynamic";

export default async function ModelSettingsPage() {
  await requireUser();
  return <ModelSettings />;
}

