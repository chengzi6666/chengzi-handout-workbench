import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/security/encryption";

const GROUP_MODEL_PRESET = {
  displayName: "集团 GPT-5.3 Codex（测试）",
  kind: "INTERNAL" as const,
  baseUrl: "http://ai-service.tal.com/claw",
  model: "gpt-5.3-codex",
  supportsVision: true,
  supportsSearch: true,
  supportsJson: true
};

const providerSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional().default(GROUP_MODEL_PRESET.displayName),
  kind: z.enum(["OPENAI", "OPENAI_COMPATIBLE", "INTERNAL"]).optional().default(GROUP_MODEL_PRESET.kind),
  baseUrl: z.string().url().optional().default(GROUP_MODEL_PRESET.baseUrl),
  model: z.string().trim().min(1).max(100).optional().default(GROUP_MODEL_PRESET.model),
  apiKey: z.string().trim().min(1).max(500),
  supportsVision: z.boolean().optional().default(GROUP_MODEL_PRESET.supportsVision),
  supportsSearch: z.boolean().optional().default(GROUP_MODEL_PRESET.supportsSearch),
  supportsJson: z.boolean().optional().default(GROUP_MODEL_PRESET.supportsJson),
  isDefault: z.boolean().default(false)
});

export async function GET() {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const providers = await db.aiProviderConfig.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  return NextResponse.json({
    providers: providers.map((provider) => ({
      ...provider,
      apiKeyMask: maskSecret(decryptSecret(provider.encryptedApiKey)),
      encryptedApiKey: undefined
    }))
  });
}

export async function POST(request: Request) {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = providerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "模型配置不正确" }, { status: 400 });
  const { apiKey, ...data } = parsed.data;
  const provider = await db.$transaction(async (transaction) => {
    if (data.isDefault) await transaction.aiProviderConfig.updateMany({ data: { isDefault: false } });
    return transaction.aiProviderConfig.create({ data: { ...data, encryptedApiKey: encryptSecret(apiKey) } });
  });
  return NextResponse.json({ provider: { ...provider, encryptedApiKey: undefined, apiKeyMask: maskSecret(apiKey) } }, { status: 201 });
}
