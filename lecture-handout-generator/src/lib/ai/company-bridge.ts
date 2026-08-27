/**
 * 公司内网模型网关（ai-service.tal.com，内网 10.160.x.x）无法从公网直达。
 * Railway 部署通过容器内 frps + 本机 frpc 反向隧道访问：
 * 容器内 http://127.0.0.1:9000 即公司网关。设置 TAL_BRIDGE_URL 后，
 * INTERNAL 类型 provider 的 baseUrl 自动切换到桥接地址；本地开发不设该变量，
 * 继续直连公司内网域名，行为不变。
 */
export function resolveCompanyGatewayBaseUrl(kind: string, baseUrl: string): string {
  if (kind !== "INTERNAL") return baseUrl;
  const bridge = process.env.TAL_BRIDGE_URL?.trim();
  if (!bridge) return baseUrl;
  return bridge.replace(/\/+$/, "");
}

/** 公司网关需要 api-key 请求头（同时附带 Bearer 兼容两种鉴权）。 */
export function isCompanyGateway(kind: string, baseUrl: string): boolean {
  if (kind === "INTERNAL") return true;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "ai-service.tal.com" || host.endsWith(".tal.com");
  } catch {
    return false;
  }
}
