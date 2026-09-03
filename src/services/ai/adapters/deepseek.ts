import { AIProvider, AIProviderMeta, AIProviderType, AICompletionOptions, AICompletionResult } from "../types";
import { withRetry } from "./utils";

export class DeepSeekAdapter implements AIProvider {
  id: string;
  label: string;
  type: AIProviderType = "deepseek";
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
      throw new Error(`API key ausente para o provedor ${this.meta.label} (DeepSeek)`);
    }

    const model = options?.model || this.meta.default_model || "deepseek-chat";
    const rawUrl = this.meta.base_url?.trim() || "https://api.deepseek.com/v1/chat/completions";
    const url = rawUrl.endsWith("/chat/completions")
      ? rawUrl
      : `${rawUrl.replace(/\/+$/, "")}/chat/completions`;
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
        let errMsg = `DeepSeek API error (${res.status}): ${errText}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error?.message) {
            errMsg = `DeepSeek: ${errJson.error.message}`;
          }
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message;
      const reasoning = choice?.reasoning_content || undefined;
      const text = choice?.content || (reasoning ? "" : "");
      const tokens = data.usage?.total_tokens || 0;

      return {
        text: text.trim(),
        reasoning: reasoning?.trim(),
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
