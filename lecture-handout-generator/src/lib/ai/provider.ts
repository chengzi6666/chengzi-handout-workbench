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
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly id: string;
  readonly displayName: string;

  constructor(private readonly options: OpenAiCompatibleProviderOptions) {
    this.id = options.id;
    this.displayName = options.displayName;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const endpoint = `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
        ...this.options.extraHeaders
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature: input.temperature ?? 0.2,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI provider ${this.displayName} returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error(`AI provider ${this.displayName} returned empty content`);

    return { text, model: this.options.model, provider: this.id };
  }
}

