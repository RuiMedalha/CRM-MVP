import { AIProvider, AIProviderMeta, AIProviderType, AICompletionOptions, AICompletionResult } from "../types";
import { withRetry } from "./utils";

export class MinimaxAdapter implements AIProvider {
  id: string;
  label: string;
  type: AIProviderType = "minimax";
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
      throw new Error(`API key ausente para o provedor ${this.meta.label} (MiniMax)`);
    }

    const model = options?.model || this.meta.default_model || "MiniMax-Text-01";
    const rawUrl = this.meta.base_url?.trim() || "https://api.minimax.io/v1/chat/completions";
    const systemPrompt = options?.systemPrompt || options?.system;
    
    // Check if it uses Anthropic-compatible format or OpenAI format
    const isAnthropicStyle = rawUrl.includes("/messages") || rawUrl.includes("anthropic");

    return await withRetry(async () => {
      const startTime = performance.now();
      let res: Response;

      if (isAnthropicStyle) {
        const body: Record<string, unknown> = {
          model,
          max_tokens: options?.maxTokens || 1024,
          messages: [{ role: "user", content: prompt }],
        };
        if (systemPrompt) body.system = systemPrompt;
        if (typeof options?.temperature === "number") body.temperature = options.temperature;

        res = await fetch(rawUrl, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            Authorization: `Bearer ${apiKey}`,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } else {
        const messages: Array<{ role: string; content: string }> = [];
        if (systemPrompt) {
          messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const body: Record<string, unknown> = {
          model,
          messages,
        };
        if (typeof options?.maxTokens === "number") body.max_tokens = options.maxTokens;
        if (typeof options?.temperature === "number") body.temperature = options.temperature;

        res = await fetch(rawUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      }

      const latency = Math.round(performance.now() - startTime);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let errMsg = `MiniMax API error (${res.status}): ${errText}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.base_resp?.status_msg) {
            errMsg = `MiniMax: ${errJson.base_resp.status_msg}`;
          } else if (errJson.error?.message) {
            errMsg = `MiniMax: ${errJson.error.message}`;
          }
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      
      // MiniMax retorna HTTP 200 mesmo quando há erro de quota, chave ou modelo via base_resp
      if (data.base_resp && typeof data.base_resp.status_code === "number" && data.base_resp.status_code !== 0) {
        throw new Error(`MiniMax (${data.base_resp.status_code}): ${data.base_resp.status_msg || "Erro na API MiniMax"}`);
      }

      if (data.error) {
        const msg = typeof data.error === "string" ? data.error : data.error.message || JSON.stringify(data.error);
        throw new Error(`MiniMax: ${msg}`);
      }

      let text = "";

      if (Array.isArray(data.content)) {
        text = data.content.map((c: { text?: string }) => c.text || "").join("");
      } else if (data.choices?.[0]?.message?.content) {
        text = data.choices[0].message.content;
      } else if (data.choices?.[0]?.messages?.[0]?.text) {
        text = data.choices[0].messages[0].text;
      } else if (data.choices?.[0]?.text) {
        text = data.choices[0].text;
      } else if (data.reply) {
        text = data.reply;
      }

      if (!text) {
        console.warn("[MiniMax] Resposta vazia ou estrutura desconhecida:", data);
        const snippet = JSON.stringify(data).slice(0, 180);
        throw new Error(`MiniMax conectou mas não retornou texto gerado. Resposta da API: ${snippet}`);
      }

      const tokens =
        data.usage?.total_tokens ||
        (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) ||
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
