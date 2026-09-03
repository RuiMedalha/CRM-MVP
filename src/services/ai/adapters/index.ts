import { AIProvider, AIProviderMeta } from "../types";
import { AnthropicAdapter } from "./anthropic";
import { OpenAIAdapter } from "./openai";
import { OpenRouterAdapter } from "./openrouter";
import { OpenCodeAdapter } from "./opencode";
import { MinimaxAdapter } from "./minimax";
import { DeepSeekAdapter } from "./deepseek";
import { OpenAICompatibleAdapter } from "./openai_compatible";

export {
  AnthropicAdapter,
  OpenAIAdapter,
  OpenRouterAdapter,
  OpenCodeAdapter,
  MinimaxAdapter,
  DeepSeekAdapter,
  OpenAICompatibleAdapter,
};

export function createAIAdapter(meta: AIProviderMeta): AIProvider {
  switch (meta.type) {
    case "anthropic":
      return new AnthropicAdapter(meta);
    case "openai":
      return new OpenAIAdapter(meta);
    case "openrouter":
      return new OpenRouterAdapter(meta);
    case "opencode":
      return new OpenCodeAdapter(meta);
    case "minimax":
      return new MinimaxAdapter(meta);
    case "deepseek":
      return new DeepSeekAdapter(meta);
    case "kimi":
      return new OpenAICompatibleAdapter({
        ...meta,
        base_url: meta.base_url || "https://api.moonshot.cn/v1/chat/completions",
        default_model: meta.default_model || "moonshot-v1-8k",
      });
    case "openai_compatible":
    default:
      return new OpenAICompatibleAdapter(meta);
  }
}
