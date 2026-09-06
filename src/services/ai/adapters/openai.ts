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
    const apiKey =
      this.meta.api_key?.trim() ||
      (import.meta.env?.VITE_OPENAI_API_KEY as string) ||
      (import.meta.env?.VITE_OPENAI_TOKEN as string) ||
      "";

    const url =
      this.meta.base_url?.trim() ||
      (import.meta.env?.VITE_OPENAI_URL as string) ||
      "https://api.openai.com/v1/chat/completions";

    const model =
      options?.model ||
      this.meta.default_model ||
      (import.meta.env?.VITE_OPENAI_MODEL as string) ||
      "gpt-4o";

    const isOfficialOpenAI = url.includes("api.openai.com");
    if (!apiKey && isOfficialOpenAI) {
      throw new Error(`API key ausente para o provedor ${this.meta.label} (OpenAI)`);
    }

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
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
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
