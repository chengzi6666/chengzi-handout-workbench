import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/security/encryption";
import { OpenAiCompatibleProvider } from "@/lib/ai/provider";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const config = await db.aiProviderConfig.findUnique({ where: { id } });
  if (!config) return NextResponse.json({ error: "接口不存在" }, { status: 404 });
  if (process.env.AI_EXECUTION_MODE === "local-bridge") {
    const project = await db.project.findFirst({
      where: { ownerId: session.userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "请先创建一个项目，再测试公司模型" }, { status: 409 });
    const job = await db.processingJob.create({
      data: { projectId: project.id, kind: "CONTENT_GENERATE", payload: { connectivityTest: true, providerId: config.id } },
    });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      const current = await db.processingJob.findUnique({ where: { id: job.id } });
      if (current?.status === "SUCCEEDED") {
        const result = current.result as { latencyMs?: number; model?: string; preview?: string } | null;
        return NextResponse.json({ ok: true, latencyMs: result?.latencyMs ?? 0, model: result?.model, preview: result?.preview });
      }
      if (current?.status === "FAILED") return NextResponse.json({ error: current.error?.split("\n")[0] ?? "接口测试失败" }, { status: 502 });
    }
    await db.processingJob.deleteMany({ where: { id: job.id, status: "QUEUED" } });
    return NextResponse.json({ error: "本机公司模型桥未连通；请保持桥接程序运行，并将电脑连接公司网络后重试。" }, { status: 503 });
  }
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
