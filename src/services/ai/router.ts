import {
  AICompletionOptions,
  AICompletionResult,
  AIProvider,
  AIProviderMeta,
  AIRouter,
  AISettings,
} from "./types";
import { createAIAdapter } from "./adapters";
import {
  fetchAIProvidersDirectus,
  createAIProviderDirectus,
  updateAIProviderDirectus,
  deleteAIProviderDirectus,
  fetchAISettingsDirectus,
  updateAISettingsDirectus,
} from "../../integrations/directus/ai-providers";

export * from "./types";
export * from "./adapters";

export class AIRouterService implements AIRouter {
  private adapterCache: Map<string, AIProvider> = new Map();
  private providersCache: AIProviderMeta[] | null = null;
  private settingsCache: AISettings | null = null;

  async listProviders(forceRefresh = false): Promise<AIProviderMeta[]> {
    if (!this.providersCache || forceRefresh) {
      this.providersCache = await fetchAIProvidersDirectus();
      this.adapterCache.clear();
    }
    return this.providersCache;
  }

  async getProvider(providerId: string): Promise<AIProvider | null> {
    if (this.adapterCache.has(providerId)) {
      return this.adapterCache.get(providerId)!;
    }

    const providers = await this.listProviders();
    const meta = providers.find((p) => p.id === providerId);
    if (!meta) return null;

    const adapter = createAIAdapter(meta);
    this.adapterCache.set(providerId, adapter);
    return adapter;
  }

  async getSettings(forceRefresh = false): Promise<AISettings> {
    if (!this.settingsCache || forceRefresh) {
      this.settingsCache = await fetchAISettingsDirectus();
    }
    return this.settingsCache;
  }

  async saveSettings(settings: Partial<AISettings>): Promise<AISettings> {
    const updated = await updateAISettingsDirectus(settings);
    this.settingsCache = updated;
    return updated;
  }

  async complete(
    providerId: string,
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResult> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provedor IA com id '${providerId}' não encontrado.`);
    }

    if (!provider.meta.enabled) {
      throw new Error(`Provedor IA '${provider.meta.label}' está desativado.`);
    }

    const settings = await this.getSettings();
    const effectiveOptions: AICompletionOptions = {
      maxTokens: options?.maxTokens ?? settings.max_tokens_default ?? 1024,
      systemPrompt: options?.systemPrompt ?? options?.system ?? settings.system_prompt_default ?? undefined,
      model: options?.model,
      temperature: options?.temperature,
    };

    return await provider.complete(prompt, effectiveOptions);
  }

  /**
   * Executa a conclusão no provedor preferido/default.
   * Se falhar, faz fallback automático para o próximo provedor habilitado (fallback_provider_id primeiro).
   */
  async completeWithFallback(
    prompt: string,
    options?: AICompletionOptions,
    preferredProviderId?: string
  ): Promise<AICompletionResult> {
    const providers = await this.listProviders();
    const enabledProviders = providers.filter((p) => p.enabled);

    if (enabledProviders.length === 0) {
      throw new Error(
        "Nenhum provedor de IA está habilitado. Ative ou configure pelo menos um provedor em /definicoes/ia-providers."
      );
    }

    const settings = await this.getSettings();
    const primaryId = preferredProviderId || settings.default_provider_id;
    const fallbackId = settings.fallback_provider_id;

    // Constrói ordem de prioridade estrita: Primário (MiniMax) -> Fallback 1 (Claude) -> Fallback 2 (Gemini) -> Fallback 3 (GPT)
    const ordered: AIProviderMeta[] = [];
    
    // 1. Provedor primário se existir e estiver ativo (padrão: MiniMax)
    if (primaryId) {
      const p = enabledProviders.find((x) => x.id === primaryId);
      if (p) ordered.push(p);
    }

    // 2. Provedor de fallback se configurado (padrão: Claude)
    if (fallbackId && fallbackId !== primaryId) {
      const f = enabledProviders.find((x) => x.id === fallbackId);
      if (f && !ordered.some((x) => x.id === f.id)) ordered.push(f);
    }

    // 3. Fallbacks prioritários subsequentes (Gemini e GPT)
    const standardFallbacks = ["default-gemini", "default-openai", "default-openrouter", "default-deepseek"];
    for (const fbId of standardFallbacks) {
      const ep = enabledProviders.find((x) => x.id === fbId);
      if (ep && !ordered.some((x) => x.id === ep.id)) {
        ordered.push(ep);
      }
    }

    // 4. Demais provedores habilitados
    for (const ep of enabledProviders) {
      if (!ordered.some((x) => x.id === ep.id)) {
        ordered.push(ep);
      }
    }

    const errors: Array<{ provider: string; error: string }> = [];

    const effectiveOptions: AICompletionOptions = {
      maxTokens: options?.maxTokens ?? settings.max_tokens_default ?? 1024,
      systemPrompt: options?.systemPrompt ?? options?.system ?? settings.system_prompt_default ?? undefined,
      model: options?.model,
      temperature: options?.temperature,
    };

    for (const meta of ordered) {
      try {
        const adapter = await this.getProvider(meta.id);
        if (!adapter) continue;

        const result = await adapter.complete(prompt, effectiveOptions);
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[AIRouter Fallback] Provedor '${meta.label}' (${meta.type}) falhou: ${msg}. A tentar próximo...`
        );
        errors.push({ provider: meta.label, error: msg });
      }
    }

    const summary = errors.map((e) => `• ${e.provider}: ${e.error}`).join("\n");
    throw new Error(
      `Todos os provedores de IA disponíveis falharam na conclusão:\n${summary}`
    );
  }

  async saveProvider(provider: Partial<AIProviderMeta>): Promise<AIProviderMeta> {
    let saved: AIProviderMeta;
    if (provider.id && !provider.id.startsWith("new-")) {
      saved = await updateAIProviderDirectus(provider.id, provider);
    } else {
      saved = await createAIProviderDirectus(provider);
    }
    await this.listProviders(true);
    return saved;
  }

  async deleteProvider(id: string): Promise<void> {
    await deleteAIProviderDirectus(id);
    await this.listProviders(true);
  }

  async toggleProvider(id: string, enabled: boolean): Promise<AIProviderMeta> {
    const updated = await updateAIProviderDirectus(id, { enabled });
    await this.listProviders(true);
    return updated;
  }
}

export const aiRouter = new AIRouterService();
