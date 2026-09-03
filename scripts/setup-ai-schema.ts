/**
 * Setup AI Providers & AI Settings Schema — Directus v11
 * 
 * Cria as coleções:
 * 1. `ai_providers` (label, type, base_url, api_key hidden, default_model, enabled, tenant_id, timestamps)
 * 2. `ai_settings` (single-row: default_provider_id, fallback_provider_id, max_tokens_default, system_prompt_default)
 * 
 * Idempotente: verifica existência antes de criar.
 * Uso: npx tsx scripts/setup-ai-schema.ts
 */

const DIRECTUS_URL = (process.env.DIRECTUS_URL || process.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt").replace(/\/+$/, "");
const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || process.env.VITE_DIRECTUS_ADMIN_TOKEN;

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

if (ADMIN_TOKEN) {
  headers["Authorization"] = `Bearer ${ADMIN_TOKEN}`;
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${DIRECTUS_URL}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as any) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 400 && (text.includes("already exists") || text.includes("duplicate"))) {
        return null;
      }
      throw new Error(`${options.method || "GET"} ${path} -> ${res.status}: ${text}`);
    }
    return await res.json().catch(() => null);
  } catch (e: any) {
    console.warn(`[WARN] API Request ${path}:`, e.message);
    return null;
  }
}

async function collectionExists(collection: string): Promise<boolean> {
  const res = await apiRequest(`/collections/${collection}`);
  return Boolean(res?.data);
}

async function createAIProvidersCollection() {
  console.log("📦 Verificando/Criando coleção `ai_providers`...");
  if (await collectionExists("ai_providers")) {
    console.log("  ✓ Coleção ai_providers já existe.");
    return;
  }

  await apiRequest("/collections", {
    method: "POST",
    body: JSON.stringify({
      collection: "ai_providers",
      meta: {
        icon: "psychology",
        note: "Provedores de Inteligência Artificial plug-in (Anthropic, OpenAI, OpenRouter, MiniMax, DeepSeek, etc)",
        display_template: "{{label}} ({{type}} - {{default_model}})",
      },
      schema: {},
      fields: [
        {
          field: "id",
          type: "string",
          schema: { is_primary_key: true, length: 64 },
          meta: { hidden: false, readonly: true, interface: "input" },
        },
        {
          field: "label",
          type: "string",
          schema: { is_nullable: false, length: 128 },
          meta: { interface: "input", note: "Nome legível do provedor (ex: Claude 3.5 Sonnet)" },
        },
        {
          field: "type",
          type: "string",
          schema: { is_nullable: false, length: 32 },
          meta: {
            interface: "select-dropdown",
            options: {
              choices: [
                { text: "Anthropic Claude", value: "anthropic" },
                { text: "OpenAI GPT", value: "openai" },
                { text: "OpenRouter Hub", value: "openrouter" },
                { text: "OpenCode Engine", value: "opencode" },
                { text: "MiniMax AI", value: "minimax" },
                { text: "DeepSeek AI", value: "deepseek" },
                { text: "OpenAI Compatible (Custom / Ollama)", value: "openai_compatible" },
              ],
            },
          },
        },
        {
          field: "base_url",
          type: "string",
          schema: { is_nullable: true, length: 500 },
          meta: { interface: "input", note: "URL base personalizada para API (opcional)" },
        },
        {
          field: "api_key",
          type: "text",
          schema: { is_nullable: true },
          meta: { interface: "input-hash", note: "Chave de API secreta (oculta para não-administradores)" },
        },
        {
          field: "default_model",
          type: "string",
          schema: { is_nullable: false, length: 128 },
          meta: { interface: "input", note: "Modelo predefinido (ex: claude-3-5-sonnet-20241022, gpt-4o)" },
        },
        {
          field: "enabled",
          type: "boolean",
          schema: { is_nullable: false, default_value: true },
          meta: { interface: "boolean", note: "Ativar/desativar este provedor no roteador" },
        },
        {
          field: "tenant_id",
          type: "string",
          schema: { is_nullable: true, length: 64 },
          meta: { interface: "input", note: "ID do Tenant para isolamento multi-tenant (opcional)" },
        },
        {
          field: "date_created",
          type: "dateTime",
          schema: { is_nullable: true },
          meta: { interface: "datetime", readonly: true, special: ["date-created"] },
        },
        {
          field: "date_updated",
          type: "dateTime",
          schema: { is_nullable: true },
          meta: { interface: "datetime", readonly: true, special: ["date-updated"] },
        },
      ],
    }),
  });
  console.log("  ✓ Coleção ai_providers criada com sucesso.");
}

async function createAISettingsCollection() {
  console.log("📦 Verificando/Criando coleção `ai_settings`...");
  if (await collectionExists("ai_settings")) {
    console.log("  ✓ Coleção ai_settings já existe.");
    return;
  }

  await apiRequest("/collections", {
    method: "POST",
    body: JSON.stringify({
      collection: "ai_settings",
      meta: {
        icon: "tune",
        note: "Configurações globais do roteador de IA (Provedor padrão, fallback, tokens, prompt padrão)",
        singleton: true,
      },
      schema: {},
      fields: [
        {
          field: "id",
          type: "string",
          schema: { is_primary_key: true, length: 64 },
          meta: { hidden: false, readonly: true, interface: "input" },
        },
        {
          field: "default_provider_id",
          type: "string",
          schema: {
            is_nullable: true,
            length: 64,
            foreign_key_table: "ai_providers",
            foreign_key_column: "id",
          },
          meta: { interface: "select-dropdown-m2o", note: "Provedor preferido primário" },
        },
        {
          field: "fallback_provider_id",
          type: "string",
          schema: {
            is_nullable: true,
            length: 64,
            foreign_key_table: "ai_providers",
            foreign_key_column: "id",
          },
          meta: { interface: "select-dropdown-m2o", note: "Provedor secundário de contingência (fallback)" },
        },
        {
          field: "max_tokens_default",
          type: "integer",
          schema: { is_nullable: false, default_value: 1024 },
          meta: { interface: "input", note: "Limite padrão de tokens para conclusão (default 1024)" },
        },
        {
          field: "system_prompt_default",
          type: "text",
          schema: { is_nullable: true },
          meta: { interface: "input-multiline", note: "Prompt de sistema global predefinido" },
        },
        {
          field: "date_created",
          type: "dateTime",
          schema: { is_nullable: true },
          meta: { interface: "datetime", readonly: true, special: ["date-created"] },
        },
        {
          field: "date_updated",
          type: "dateTime",
          schema: { is_nullable: true },
          meta: { interface: "datetime", readonly: true, special: ["date-updated"] },
        },
      ],
    }),
  });
  console.log("  ✓ Coleção ai_settings criada com sucesso.");
}

async function configurePermissions() {
  console.log("🔐 Configurando permissões de IA...");
  const permissions = [
    {
      collection: "ai_providers",
      action: "read",
      fields: ["id", "label", "type", "base_url", "default_model", "enabled", "tenant_id", "date_created", "date_updated"],
    },
    {
      collection: "ai_settings",
      action: "read",
      fields: ["*"],
    },
  ];

  for (const perm of permissions) {
    await apiRequest("/permissions", {
      method: "POST",
      body: JSON.stringify(perm),
    }).catch(() => null);
  }
  console.log("  ✓ Permissões aplicadas.");
}

async function main() {
  console.log("=========================================");
  console.log("🚀 Setup Schema: AI Providers & AI Settings");
  console.log(`📡 URL Directus: ${DIRECTUS_URL}`);
  console.log("=========================================\n");

  await createAIProvidersCollection();
  await createAISettingsCollection();
  await configurePermissions();

  console.log("\n🎉 Setup Directus AI concluído com sucesso!");
}

main().catch((err) => {
  console.error("❌ Erro fatal no setup AI schema:", err);
});
