export type AIProviderType =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "opencode"
  | "minimax"
  | "deepseek"
  | "openai_compatible";

export interface AICompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AICompletionResult {
  text: string;
  tokens: number;
  latency: number;
  providerId: string;
  providerLabel?: string;
  model: string;
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

export interface AIProvider {
  id: string;
  meta: AIProviderMeta;
  complete(
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResult>;
}

export interface AIRouter {
  listProviders(): Promise<AIProviderMeta[]>;
  getProvider(providerId: string): Promise<AIProvider | null>;
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
