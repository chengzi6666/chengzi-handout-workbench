import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/security/encryption";
import { OpenAiCompatibleProvider } from "@/lib/ai/provider";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const config = await db.aiProviderConfig.findUnique({ where: { id } });
  if (!config) return NextResponse.json({ error: "接口不存在" }, { status: 404 });
  try {
    const provider = new OpenAiCompatibleProvider({
      id: config.id,
      displayName: config.displayName,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: decryptSecret(config.encryptedApiKey),
      extraHeaders: (config.extraHeaders as Record<string, string> | null) ?? undefined,
      requestTimeoutMs: 10_000,
      maxAttempts: 1
    });
    const startedAt = Date.now();
    const result = await provider.generateText({ systemPrompt: "你是接口连通性测试助手。", userPrompt: "只回复：连接成功", temperature: 0 });
    return NextResponse.json({ ok: true, latencyMs: Date.now() - startedAt, model: result.model, preview: result.text.slice(0, 80) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "接口测试失败" }, { status: 502 });
  }
}
