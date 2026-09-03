import { AIProvider, AIProviderMeta, AIProviderType, AICompletionOptions, AICompletionResult } from "../types";
import { withRetry } from "./utils";

export class OpenAICompatibleAdapter implements AIProvider {
  id: string;
  label: string;
  type: AIProviderType = "openai_compatible";
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
    const rawBase = (this.meta.base_url || "").trim();
    if (!rawBase) {
      throw new Error(`Base URL ausente para o provedor compatível ${this.meta.label}`);
    }

    const cleanBase = rawBase.replace(/\/+$/, "");
    const url = cleanBase.endsWith("/chat/completions")
      ? cleanBase
      : `${cleanBase}/chat/completions`;

    const model = options?.model || this.meta.default_model || "default";
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.meta.api_key?.trim()) {
      headers["Authorization"] = `Bearer ${this.meta.api_key.trim()}`;
    }

    return await withRetry(async () => {
      const startTime = performance.now();
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const latency = Math.round(performance.now() - startTime);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let errMsg = `OpenAI Compatible API error (${res.status}): ${errText}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error?.message) {
            errMsg = `Provedor IA: ${errJson.error.message}`;
          }
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const text =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.text ||
        data.response ||
        data.text ||
        "";

      const tokens =
        data.usage?.total_tokens ||
        (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0) ||
        0;

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
