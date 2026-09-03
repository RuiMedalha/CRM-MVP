import { AIProvider, AIProviderMeta, AIProviderType, AICompletionOptions, AICompletionResult } from "../types";
import { withRetry } from "./utils";

export class OpenAIAdapter implements AIProvider {
  id: string;
  label: string;
  type: AIProviderType = "openai";
  meta: AIProviderMeta;

  constructor(meta: AIProviderMeta) {
    this.id = meta.id;
    this.label = meta.label;
    this.meta = meta;
  }

  async complete(
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResult> {
    const apiKey = this.meta.api_key?.trim();
    if (!apiKey) {
      throw new Error(`API key ausente para o provedor ${this.meta.label} (OpenAI)`);
    }

    const model = options?.model || this.meta.default_model || "gpt-4o";
    const url = this.meta.base_url?.trim() || "https://api.openai.com/v1/chat/completions";
    const systemPrompt = options?.systemPrompt || options?.system;

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
    };

    if (typeof options?.maxTokens === "number") {
      body.max_tokens = options.maxTokens;
    }
    if (typeof options?.temperature === "number") {
      body.temperature = options.temperature;
    }

    return await withRetry(async () => {
      const startTime = performance.now();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const latency = Math.round(performance.now() - startTime);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let errMsg = `OpenAI API error (${res.status}): ${errText}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error?.message) {
            errMsg = `OpenAI: ${errJson.error.message}`;
          }
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      const tokens = data.usage?.total_tokens || 0;

      return {
        text: text.trim(),
        tokens,
        latency,
        providerId: this.id,
        providerLabel: this.meta.label,
        model,
        raw: data,
      };
    });
  }
}
