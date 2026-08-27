import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/security/encryption";
import { OpenAiCompatibleProvider } from "./provider";
import { isCompanyGateway, resolveCompanyGatewayBaseUrl } from "./company-bridge";

export async function getConfiguredProvider(id?: string | null) {
  const config = id
    ? await db.aiProviderConfig.findFirst({ where: { id, enabled: true } })
    : await db.aiProviderConfig.findFirst({ where: { enabled: true }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  if (!config) throw new Error("请先在模型设置中配置并启用一个大语言模型");
  return new OpenAiCompatibleProvider({
    id: config.id,
    displayName: config.displayName,
    // Railway 上 INTERNAL 类型经 frp 隧道桥接公司内网网关；本地开发不设 TAL_BRIDGE_URL，直连不变。
    baseUrl: resolveCompanyGatewayBaseUrl(config.kind, config.baseUrl),
    apiKey: decryptSecret(config.encryptedApiKey),
    model: config.model,
    companyGateway: isCompanyGateway(config.kind, config.baseUrl),
    // 未来云调试台将参数标注为 token，但网关实际兼容 OpenAI Bearer 鉴权。
    useTokenHeader: false,
    extraHeaders: (config.extraHeaders ?? undefined) as Record<string, string> | undefined
  });
}

export function parseJsonResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate.trim());
}
