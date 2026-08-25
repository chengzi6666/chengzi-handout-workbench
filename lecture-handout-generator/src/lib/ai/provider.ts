export interface GenerateTextInput {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  provider: string;
}

export interface GenerateVisionTextInput extends GenerateTextInput {
  /** Local PDF pages encoded as data:image/png;base64,... */
  imageDataUrls: string[];
}

export interface AiProvider {
  readonly id: string;
  readonly displayName: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}

export interface OpenAiCompatibleProviderOptions {
  id: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
  useTokenHeader?: boolean;
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly id: string;
  readonly displayName: string;

  constructor(private readonly options: OpenAiCompatibleProviderOptions) {
    this.id = options.id;
    this.displayName = options.displayName;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    return this.request(input, { role: "user", content: input.userPrompt });
  }

  async generateVisionText(input: GenerateVisionTextInput): Promise<GenerateTextResult> {
    return this.request(input, {
      role: "user",
      content: [
        { type: "text", text: input.userPrompt },
        ...input.imageDataUrls.map((url) => ({ type: "image_url", image_url: { url } }))
      ]
    });
  }

  private async request(input: GenerateTextInput, userMessage: unknown): Promise<GenerateTextResult> {
    const endpoint = `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`;
    // 集团模型默认 RPM 很低。五讲生成会连续请求，必须由客户端主动退避，
    // 不能把一次 429 当作整份讲义失败。
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      let response: Response;
      try {
        response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(this.options.useTokenHeader ? { token: this.options.apiKey } : { authorization: `Bearer ${this.options.apiKey}` }),
          ...this.options.extraHeaders
        },
        body: JSON.stringify({
          model: this.options.model,
          temperature: input.temperature ?? 0.2,
          messages: [
            { role: "system", content: input.systemPrompt },
            userMessage
          ]
        })
        });
      } catch (error) {
        if (controller.signal.aborted) throw new Error(`AI provider ${this.displayName} 请求超时（90秒），请重试或更换模型`);
        // 公司网络、VPN 切换和低 RPM 网关都可能主动断开 keep-alive socket。
        // 这类瞬时连接错误不能原样泄露为 "fetch failed"，也不应立刻中断五讲任务。
        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 3_000 * (attempt + 1)));
          continue;
        }
        const cause = error instanceof Error && "cause" in error ? (error as Error & { cause?: { code?: string; message?: string } }).cause : undefined;
        const detail = cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : "unknown network error");
        throw new Error(`无法连接集团模型网关（${detail}）。请检查公司内网／VPN后重试；当前主讲文件已保留，无需重新上传。`);
      } finally {
        clearTimeout(timeout);
      }
      if (response.ok) {
        const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = payload.choices?.[0]?.message?.content;
        if (!text) throw new Error(`AI provider ${this.displayName} returned empty content`);
        return { text, model: this.options.model, provider: this.id };
      }
      if (response.status !== 429 || attempt === 4) throw new Error(`AI provider ${this.displayName} returned ${response.status}`);
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 12_000 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`AI provider ${this.displayName} 请求失败`);
  }
}
