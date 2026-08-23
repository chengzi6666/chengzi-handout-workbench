import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/security/encryption";

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().trim().min(1).max(100).optional(),
  apiKey: z.string().trim().min(1).max(500).optional(),
  supportsVision: z.boolean().optional(),
  supportsSearch: z.boolean().optional(),
  supportsJson: z.boolean().optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "更新内容不正确" }, { status: 400 });
  const { id } = await context.params;
  const { apiKey, ...rest } = parsed.data;
  const data = { ...rest, ...(apiKey ? { encryptedApiKey: encryptSecret(apiKey) } : {}) };
  const provider = await db.$transaction(async (transaction) => {
    if (rest.isDefault) await transaction.aiProviderConfig.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    return transaction.aiProviderConfig.update({ where: { id }, data });
  });
  return NextResponse.json({ provider: { ...provider, encryptedApiKey: undefined } });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  await db.aiProviderConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

