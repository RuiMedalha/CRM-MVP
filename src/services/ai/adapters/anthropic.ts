import { AIProvider, AIProviderMeta, AIProviderType, AICompletionOptions, AICompletionResult } from "../types";
import { withRetry } from "./utils";

export class AnthropicAdapter implements AIProvider {
  id: string;
  label: string;
  type: AIProviderType = "anthropic";
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
      (import.meta.env?.VITE_ANTHROPIC_API_KEY as string) ||
      "";
    const model =
      options?.model ||
      this.meta.default_model ||
      (import.meta.env?.VITE_ANTHROPIC_MODEL as string) ||
      "claude-haiku-4-5";
    const maxTokens = options?.maxTokens || 1024;
    const systemPrompt = options?.systemPrompt || options?.system;
    const rawUrl =
      this.meta.base_url?.trim() ||
      (import.meta.env?.VITE_ANTHROPIC_URL as string) ||
      "https://api.anthropic.com/v1/messages";

    if (!apiKey) {
      // Fallback automático através do endpoint seguro /ai-proxy do Directus
      const { directusRequest } = await import("@/integrations/directus/client");
      const startTime = performance.now();
      const payload: Record<string, unknown> = {
        model: "claude-haiku-4-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      };
      if (systemPrompt) {
        payload.system = systemPrompt;
      }

      const data = await directusRequest<{
        model?: string;
        content?: Array<{ type: string; text: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      }>("/ai-proxy", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const latency = Math.round(performance.now() - startTime);
      let text = "";
      if (Array.isArray(data?.content)) {
        text = data.content
          .map((c) => c.text || "")
          .join("")
          .trim();
      }

      const inputTokens = data?.usage?.input_tokens || 0;
      const outputTokens = data?.usage?.output_tokens || 0;

      return {
        text,
        tokens: inputTokens + outputTokens,
        latency,
        providerId: this.id,
        providerLabel: this.meta.label,
        model: data?.model || "claude-haiku-4-5",
        raw: data,
      };
    }

    const url = this.meta.base_url?.trim() || "https://api.anthropic.com/v1/messages";

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }
    if (typeof options?.temperature === "number") {
      body.temperature = options.temperature;
    }

    return await withRetry(async () => {
      const startTime = performance.now();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const latency = Math.round(performance.now() - startTime);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let errMsg = `Anthropic API error (${res.status}): ${errText}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error?.message) {
            errMsg = `Anthropic: ${errJson.error.message}`;
          }
        } catch {
          // ignore json parse error
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      let text = "";
      if (Array.isArray(data.content)) {
        text = data.content
          .map((c: { text?: string }) => c.text || "")
          .join("")
          .trim();
      }

      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      const tokens = inputTokens + outputTokens;

      return {
        text,
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
