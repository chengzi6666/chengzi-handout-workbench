import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/security/encryption";
import { OpenAiCompatibleProvider } from "./provider";

export async function getConfiguredProvider(id?: string | null) {
  const config = id
    ? await db.aiProviderConfig.findFirst({ where: { id, enabled: true } })
    : await db.aiProviderConfig.findFirst({ where: { enabled: true }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  if (!config) throw new Error("请先在模型设置中配置并启用一个大语言模型");
  return new OpenAiCompatibleProvider({
    id: config.id,
    displayName: config.displayName,
    baseUrl: config.baseUrl,
    apiKey: decryptSecret(config.encryptedApiKey),
    model: config.model,
    extraHeaders: (config.extraHeaders ?? undefined) as Record<string, string> | undefined
  });
}

export function parseJsonResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate.trim());
}
