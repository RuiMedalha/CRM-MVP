import { directusRequest } from "./client";
import { AIProviderMeta, AIProviderType, AISettings } from "../../services/ai/types";

const LOCAL_STORAGE_PROVIDERS_KEY = "crm_ai_providers";
const LOCAL_STORAGE_SETTINGS_KEY = "crm_ai_settings";

let memoryProviders: AIProviderMeta[] | null = null;
let memorySettings: AISettings | null = null;

export const DEFAULT_AI_PROVIDERS: AIProviderMeta[] = [
  {
    id: "default-minimax",
    label: "MiniMax AI",
    type: "minimax",
    base_url: (import.meta.env?.VITE_MINIMAX_URL as string) || "https://api.minimax.io/v1/chat/completions",
    api_key: (import.meta.env?.VITE_MINIMAX_API_KEY as string) || (import.meta.env?.VITE_MINIMAX_TOKEN as string) || "",
    default_model: (import.meta.env?.VITE_MINIMAX_MODEL as string) || "MiniMax-Text-01",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
  {
    id: "default-anthropic",
    label: "Anthropic Claude",
    type: "anthropic",
    base_url: (import.meta.env?.VITE_ANTHROPIC_URL as string) || "https://api.anthropic.com/v1/messages",
    api_key: (import.meta.env?.VITE_ANTHROPIC_API_KEY as string) || "",
    default_model: (import.meta.env?.VITE_ANTHROPIC_MODEL as string) || "claude-3-5-sonnet-20241022",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
  {
    id: "default-openai",
    label: "OpenAI GPT",
    type: "openai",
    base_url: (import.meta.env?.VITE_OPENAI_URL as string) || "https://api.openai.com/v1/chat/completions",
    api_key: (import.meta.env?.VITE_OPENAI_API_KEY as string) || "",
    default_model: (import.meta.env?.VITE_OPENAI_MODEL as string) || "gpt-4o",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
  {
    id: "default-gemini",
    label: "Google Gemini",
    type: "gemini",
    base_url: (import.meta.env?.VITE_GEMINI_URL as string) || "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    api_key: (import.meta.env?.VITE_GEMINI_API_KEY as string) || "",
    default_model: (import.meta.env?.VITE_GEMINI_MODEL as string) || "gemini-2.0-flash",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
  {
    id: "default-deepseek",
    label: "DeepSeek AI",
    type: "deepseek",
    base_url: (import.meta.env?.VITE_DEEPSEEK_URL as string) || "https://api.deepseek.com/v1/chat/completions",
    api_key: (import.meta.env?.VITE_DEEPSEEK_API_KEY as string) || "",
    default_model: "deepseek-chat",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
  {
    id: "default-openrouter",
    label: "OpenRouter Hub",
    type: "openrouter",
    base_url: "https://openrouter.ai/api/v1/chat/completions",
    api_key: (import.meta.env?.VITE_OPENROUTER_API_KEY as string) || "",
    default_model: "anthropic/claude-3.5-sonnet",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
  {
    id: "default-kimi",
    label: "Kimi AI (Moonshot)",
    type: "kimi",
    base_url: "https://api.moonshot.cn/v1/chat/completions",
    api_key: (import.meta.env?.VITE_KIMI_API_KEY as string) || "",
    default_model: "moonshot-v1-8k",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
  {
    id: "default-opencode",
    label: "OpenCode Engine",
    type: "opencode",
    base_url: "https://opencode.ai/api/v1/chat/completions",
    api_key: (import.meta.env?.VITE_OPENCODE_API_KEY as string) || "",
    default_model: "opencode-coder",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
  {
    id: "default-custom-llm",
    label: "LLM Local / OpenAI Compatível (Ollama / vLLM)",
    type: "openai_compatible",
    base_url: (import.meta.env?.VITE_GATEWAY_URL as string) || "http://localhost:11434/v1",
    api_key: (import.meta.env?.VITE_GATEWAY_TOKEN as string) || "",
    default_model: (import.meta.env?.VITE_GATEWAY_MODEL as string) || "llama3.2",
    enabled: true,
    tenant_id: null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  },
];

export const DEFAULT_AI_SETTINGS: AISettings = {
  id: "global-ai-settings",
  default_provider_id: "default-minimax",
  fallback_provider_id: "default-anthropic",
  max_tokens_default: 1024,
  system_prompt_default: `És o Assistente Inteligente Comercial e Operacional da HotelEquip Portugal (hotelequip.pt), referência de confiança no setor de equipamentos hoteleiros, restauração e lavandaria industrial (HORECA) em Portugal.

MISSÃO E PAPEL:
Atuas como consultor de vendas B2B e suporte ao cliente omnicanal (WhatsApp, Email, Telefone e Propostas Comerciais), apoiando comerciais e clientes com respostas rápidas, fundamentadas, profissionais e orientadas a resultados.

1. LINGUAGEM E IDENTIDADE:
- Escreve SEMPRE em Português de Portugal (PT-PT) estrito e fluente (ex: "contacto", "equipa", "orçamento", "fatura", "conosco", "apoiar", "pós-venda").
- Tom consultivo, cortês, seguro, conhecedor e objetivo. Evita formalismos excessivos em chats rápidos e evita frieza mecânica de robô.
- Princípio: "IA propõe com rigor, o comercial valida e decide".

2. CONHECIMENTO DE CATÁLOGO E NEGÓCIO HORECA:
- A HotelEquip fornece equipamentos novos e selecionados seminovos/recondicionados com garantia.
- Principais famílias: Queima/Cozinha (fogões, fornos mistos, fritadeiras, grelhadores), Frio Comercial (armários de refrigeração e congelação, bancadas refrigeradas, abatedores de temperatura, vitrines, fabricadores de gelo), Lavagem de Loiça (máquinas de copos, abertura frontal, capota, túneis), Preparação Dinâmica e Estática (cortadoras de fiambre, picadoras, batedeiras, bancadas inox, pias), Extração/Ventilação e Lavandaria Industrial.
- Regra de Especificação: Quando o cliente pede um equipamento sem especificar detalhes, faz perguntas consultivas essenciais:
  a) Tipo de utilização e capacidade/volume pretendido;
  b) Espaço disponível (medidas L x P x A);
  c) Tipo de energia disponível (Monofásico 230V, Trifásico 400V, Gás Butano/Propano ou Gás Natural).

3. REGRAS COMERCIAIS E DE ORÇAMENTAÇÃO:
- Preços: Devem ser sempre comunicados líquidos, acrescidos de IVA à taxa legal em vigor (23% no continente).
- Propostas: Destacar sempre marca, modelo, especificações essenciais, garantia profissional, prazo de entrega e condições de fornecimento.
- Nunca inventes preços, referências ou dados bancários que não constem dos dados fornecidos ou do catálogo oficial.

4. REGRAS ESTRITAS DE ASSISTÊNCIA TÉCNICA E GARANTIA:
- NUNCA confirmes que uma reparação é gratuita ou está coberta por garantia sem prévia validação documental pela equipa técnica.
- Solicita com simpatia o NIF da empresa compradora e a fatura/guia de compra correspondente.
- Pergunta sempre a morada exata onde o equipamento se encontra instalado para eventual deslocação técnica.

5. CONVERSAS EM CURSO E ATENDIMENTO TEMPO REAL:
- Continuidade: Se a conversa já decorre (ex: histórico no WhatsApp ou thread de email), NUNCA repitas saudações formais ("Olá", "Agradecemos o seu contacto") ou o nome do cliente no início de cada frase. Responde diretamente ao que foi colocado.
- Concisão no WhatsApp: 1 a 3 frases claras e diretas. No email: corpo bem formatado em parágrafos curtos.
- Distinção de papéis: Se a mensagem for de um fornecedor (sourcing/cobrança), responde como cliente/comprador profissional da HotelEquip. Se for de um cliente, responde como comercial/assistência.`,
  date_created: new Date().toISOString(),
  date_updated: new Date().toISOString(),
};

function getLocalProviders(): AIProviderMeta[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_PROVIDERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
  } else if (memoryProviders) {
    return memoryProviders;
  }
  setLocalProviders(DEFAULT_AI_PROVIDERS);
  return DEFAULT_AI_PROVIDERS;
}

function setLocalProviders(providers: AIProviderMeta[]): void {
  memoryProviders = providers;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(LOCAL_STORAGE_PROVIDERS_KEY, JSON.stringify(providers));
    } catch {
      // ignore
    }
  }
}

function getLocalSettings(): AISettings {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return { ...DEFAULT_AI_SETTINGS, ...parsed };
        }
      }
    } catch {
      // ignore
    }
  } else if (memorySettings) {
    return memorySettings;
  }
  setLocalSettings(DEFAULT_AI_SETTINGS);
  return DEFAULT_AI_SETTINGS;
}

function setLocalSettings(settings: AISettings): void {
  memorySettings = settings;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }
}

export async function fetchAIProvidersDirectus(): Promise<AIProviderMeta[]> {
  try {
    const res = await directusRequest<{ data: any[] }>("/items/ai_providers?sort=date_created");
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      const mapped: AIProviderMeta[] = res.data.map((item) => ({
        id: String(item.id),
        label: item.label || "Sem nome",
        type: (item.type as AIProviderType) || "openai_compatible",
        base_url: item.base_url || null,
        api_key: item.api_key || null,
        default_model: item.default_model || "default",
        enabled: Boolean(item.enabled),
        tenant_id: item.tenant_id ? String(item.tenant_id) : null,
        date_created: item.date_created,
        date_updated: item.date_updated,
      }));
      setLocalProviders(mapped);
      return mapped;
    }
  } catch (err) {
    // console.warn("Directus fetch /items/ai_providers falhou, usando armazenamento local:", err);
  }
  return getLocalProviders();
}

export async function createAIProviderDirectus(
  payload: Partial<AIProviderMeta>
): Promise<AIProviderMeta> {
  const newId = payload.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `prov_${Date.now()}`);
  const record: AIProviderMeta = {
    id: newId,
    label: payload.label || "Novo Provedor",
    type: payload.type || "anthropic",
    base_url: payload.base_url || null,
    api_key: payload.api_key || null,
    default_model: payload.default_model || "claude-3-5-sonnet-20241022",
    enabled: payload.enabled ?? true,
    tenant_id: payload.tenant_id || null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  try {
    const res = await directusRequest<{ data: any }>("/items/ai_providers", {
      method: "POST",
      body: JSON.stringify(record),
    });
    if (res?.data?.id) {
      record.id = String(res.data.id);
    }
  } catch (err) {
    // console.warn("Directus create /items/ai_providers falhou, persistindo localmente:", err);
  }

  const list = getLocalProviders();
  list.unshift(record);
  setLocalProviders(list);
  return record;
}

export async function updateAIProviderDirectus(
  id: string,
  payload: Partial<AIProviderMeta>
): Promise<AIProviderMeta> {
  const list = getLocalProviders();
  const idx = list.findIndex((p) => p.id === id);
  const updatedRecord: AIProviderMeta = {
    ...(idx >= 0 ? list[idx] : ({ id } as AIProviderMeta)),
    ...payload,
    id,
    date_updated: new Date().toISOString(),
  };

  try {
    await directusRequest(`/items/ai_providers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // console.warn("Directus update /items/ai_providers falhou, persistindo localmente:", err);
  }

  if (idx >= 0) {
    list[idx] = updatedRecord;
  } else {
    list.push(updatedRecord);
  }
  setLocalProviders(list);
  return updatedRecord;
}

export async function deleteAIProviderDirectus(id: string): Promise<void> {
  try {
    await directusRequest(`/items/ai_providers/${id}`, {
      method: "DELETE",
    });
  } catch (err) {
    // console.warn("Directus delete /items/ai_providers falhou, apagando localmente:", err);
  }

  const list = getLocalProviders().filter((p) => p.id !== id);
  setLocalProviders(list);
}

export async function fetchAISettingsDirectus(): Promise<AISettings> {
  try {
    const res = await directusRequest<{ data: any }>("/items/ai_settings?limit=1");
    let item = Array.isArray(res?.data) ? res.data[0] : res?.data;
    if (item && item.id) {
      const mapped: AISettings = {
        id: String(item.id),
        default_provider_id: item.default_provider_id ? String(item.default_provider_id) : null,
        fallback_provider_id: item.fallback_provider_id ? String(item.fallback_provider_id) : null,
        max_tokens_default: item.max_tokens_default ?? 1024,
        system_prompt_default: item.system_prompt_default ?? null,
        date_created: item.date_created,
        date_updated: item.date_updated,
      };
      setLocalSettings(mapped);
      return mapped;
    }
  } catch (err) {
    // console.warn("Directus fetch /items/ai_settings falhou, usando armazenamento local:", err);
  }
  return getLocalSettings();
}

export async function updateAISettingsDirectus(
  payload: Partial<AISettings>
): Promise<AISettings> {
  const current = getLocalSettings();
  const updated: AISettings = {
    ...current,
    ...payload,
    date_updated: new Date().toISOString(),
  };

  try {
    if (current.id && current.id !== "global-ai-settings") {
      await directusRequest(`/items/ai_settings/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      const res = await directusRequest<{ data: any }>("/items/ai_settings", {
        method: "POST",
        body: JSON.stringify(updated),
      });
      if (res?.data?.id) {
        updated.id = String(res.data.id);
      }
    }
  } catch (err) {
    // console.warn("Directus update /items/ai_settings falhou, persistindo localmente:", err);
  }

  setLocalSettings(updated);
  return updated;
}
