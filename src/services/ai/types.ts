export type AIProviderType =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "opencode"
  | "minimax"
  | "deepseek"
  | "kimi"
  | "openai_compatible";

export interface AICompletionOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
  systemPrompt?: string;
  temperature?: number;
}

export interface AICompletionResult {
  text: string;
  reasoning?: string;
  tokens: number;
  latency: number;
  providerId?: string;
  providerLabel?: string;
  model?: string;
  raw?: unknown;
}

export interface AIProviderMeta {
  id: string;
  label: string;
  type: AIProviderType;
  base_url?: string | null;
  api_key?: string | null;
  default_model: string;
  enabled: boolean;
  tenant_id?: string | null;
  date_created?: string;
  date_updated?: string;
}

export interface AISettings {
  id?: string;
  default_provider_id?: string | null;
  fallback_provider_id?: string | null;
  max_tokens_default?: number;
  system_prompt_default?: string | null;
  date_created?: string;
  date_updated?: string;
}

export interface AIProvider {
  id: string;
  label: string;
  type: AIProviderType;
  meta: AIProviderMeta;
  complete(
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResult>;
}

export interface AIRouter {
  listProviders(forceRefresh?: boolean): Promise<AIProviderMeta[]>;
  getProvider(providerId: string): Promise<AIProvider | null>;
  getSettings(forceRefresh?: boolean): Promise<AISettings>;
  saveSettings(settings: Partial<AISettings>): Promise<AISettings>;
  complete(
    providerId: string,
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResult>;
  completeWithFallback(
    prompt: string,
    options?: AICompletionOptions,
    preferredProviderId?: string
  ): Promise<AICompletionResult>;
  saveProvider(provider: Partial<AIProviderMeta>): Promise<AIProviderMeta>;
  deleteProvider(id: string): Promise<void>;
  toggleProvider(id: string, enabled: boolean): Promise<AIProviderMeta>;
}
