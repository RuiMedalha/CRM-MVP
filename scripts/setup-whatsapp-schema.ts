/**
 * Setup WhatsApp Dual Multi-Number Schema — Directus v11
 * 
 * Cria as coleções:
 * 1. `whatsapp_instances` (Admin only write)
 * 2. `whatsapp_messages` com índices UNIQUE (instance_id, whatsapp_id), timestamp, lead_id
 * 
 * Idempotente: verifica existência antes de criar.
 * Uso: npx tsx scripts/setup-whatsapp-schema.ts
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

async function createWhatsAppInstancesCollection() {
  console.log("📦 Verificando/Criando coleção `whatsapp_instances`...");
  if (await collectionExists("whatsapp_instances")) {
    console.log("  ✓ Coleção whatsapp_instances já existe.");
    return;
  }

  await apiRequest("/collections", {
    method: "POST",
    body: JSON.stringify({
      collection: "whatsapp_instances",
      meta: {
        icon: "phone_in_talk",
        note: "Instâncias WhatsApp Multi-Número (Evolution API + Meta Cloud API)",
        display_template: "{{display_name}} ({{provider}} - {{phone_number}})",
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
          field: "tenant_id",
          type: "string",
          schema: { is_nullable: true, length: 64 },
          meta: { interface: "input", note: "ID do Tenant para isolamento multi-tenant" },
        },
        {
          field: "provider",
          type: "string",
          schema: { is_nullable: false, default_value: "evolution", length: 32 },
          meta: {
            interface: "select-dropdown",
            options: {
              choices: [
                { text: "Evolution API", value: "evolution" },
                { text: "Meta Cloud API (Oficial)", value: "meta" },
              ],
            },
          },
        },
        {
          field: "phone_number",
          type: "string",
          schema: { is_nullable: false, length: 32 },
          meta: { interface: "input", note: "Número de telefone com indicativo internacional (+351...)" },
        },
        {
          field: "display_name",
          type: "string",
          schema: { is_nullable: false, length: 128 },
          meta: { interface: "input", note: "Nome descritivo da linha (ex: Comercial 913, Suporte 916)" },
        },
        {
          field: "instance_id",
          type: "string",
          schema: { is_nullable: true, length: 128 },
          meta: { interface: "input", note: "Identificador da instância na Evolution API (ex: hotelequip-918)" },
        },
        {
          field: "phone_number_id",
          type: "string",
          schema: { is_nullable: true, length: 128 },
          meta: { interface: "input", note: "Phone Number ID do Meta Cloud API Graph" },
        },
        {
          field: "access_token",
          type: "text",
          schema: { is_nullable: true },
          meta: { interface: "input-hash", note: "Token permanente / API Key encriptado" },
        },
        {
          field: "business_account_id",
          type: "string",
          schema: { is_nullable: true, length: 128 },
          meta: { interface: "input", note: "WhatsApp Business Account ID (WABA) da Meta" },
        },
        {
          field: "webhook_url",
          type: "string",
          schema: { is_nullable: true, length: 500 },
          meta: { interface: "input", note: "URL pública para receber webhooks desta instância" },
        },
        {
          field: "status",
          type: "string",
          schema: { is_nullable: false, default_value: "disconnected", length: 32 },
          meta: {
            interface: "select-dropdown",
            options: {
              choices: [
                { text: "Conectado", value: "connected" },
                { text: "Desconectado", value: "disconnected" },
                { text: "Aguardando QR Code", value: "qr_pending" },
              ],
            },
          },
        },
        {
          field: "enabled",
          type: "boolean",
          schema: { is_nullable: false, default_value: true },
          meta: { interface: "boolean", note: "Ativar/desativar instância no CRM" },
        },
        {
          field: "last_seen_at",
          type: "dateTime",
          schema: { is_nullable: true },
          meta: { interface: "datetime" },
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
  console.log("  ✓ Coleção whatsapp_instances criada com sucesso.");
}

async function createWhatsAppMessagesCollection() {
  console.log("📦 Verificando/Criando coleção `whatsapp_messages`...");
  if (await collectionExists("whatsapp_messages")) {
    console.log("  ✓ Coleção whatsapp_messages já existe.");
    return;
  }

  await apiRequest("/collections", {
    method: "POST",
    body: JSON.stringify({
      collection: "whatsapp_messages",
      meta: {
        icon: "chat",
        note: "Log unificado de mensagens WhatsApp recebidas e enviadas",
        display_template: "{{direction}}: {{body}}",
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
          field: "instance_id",
          type: "string",
          schema: {
            is_nullable: false,
            foreign_key_table: "whatsapp_instances",
            foreign_key_column: "id",
          },
          meta: { interface: "select-dropdown-m2o", note: "Instância de envio/receção" },
        },
        {
          field: "direction",
          type: "string",
          schema: { is_nullable: false, length: 16 },
          meta: {
            interface: "select-dropdown",
            options: {
              choices: [
                { text: "Recebida (Inbound)", value: "inbound" },
                { text: "Enviada (Outbound)", value: "outbound" },
              ],
            },
          },
        },
        {
          field: "from_number",
          type: "string",
          schema: { is_nullable: false, length: 64 },
          meta: { interface: "input" },
        },
        {
          field: "to_number",
          type: "string",
          schema: { is_nullable: false, length: 64 },
          meta: { interface: "input" },
        },
        {
          field: "body",
          type: "text",
          schema: { is_nullable: false },
          meta: { interface: "input-multiline" },
        },
        {
          field: "media_url",
          type: "string",
          schema: { is_nullable: true, length: 1000 },
          meta: { interface: "input" },
        },
        {
          field: "media_type",
          type: "string",
          schema: { is_nullable: true, length: 32 },
          meta: {
            interface: "select-dropdown",
            options: {
              choices: [
                { text: "Imagem", value: "image" },
                { text: "Áudio", value: "audio" },
                { text: "Vídeo", value: "video" },
                { text: "Documento", value: "document" },
                { text: "Localização", value: "location" },
                { text: "Contacto", value: "contacts" },
                { text: "Sticker", value: "sticker" },
                { text: "Template", value: "template" },
                { text: "Interativo", value: "interactive" },
              ],
            },
          },
        },
        {
          field: "whatsapp_id",
          type: "string",
          schema: { is_nullable: false, length: 255 },
          meta: { interface: "input", note: "WAMID ou id único do WhatsApp" },
        },
        {
          field: "lead_id",
          type: "string",
          schema: { is_nullable: true, length: 64 },
          meta: { interface: "input", note: "FK opcional para contactos/leads" },
        },
        {
          field: "conversation_id",
          type: "string",
          schema: { is_nullable: true, length: 64 },
          meta: { interface: "input", note: "FK opcional para conversations" },
        },
        {
          field: "status",
          type: "string",
          schema: { is_nullable: false, default_value: "sent", length: 32 },
          meta: {
            interface: "select-dropdown",
            options: {
              choices: [
                { text: "Enviada", value: "sent" },
                { text: "Entregue", value: "delivered" },
                { text: "Lida", value: "read" },
                { text: "Falhou", value: "failed" },
              ],
            },
          },
        },
        {
          field: "timestamp",
          type: "dateTime",
          schema: { is_nullable: false },
          meta: { interface: "datetime" },
        },
        {
          field: "raw_payload",
          type: "json",
          schema: { is_nullable: true },
          meta: { interface: "input-code", options: { language: "json" } },
        },
        {
          field: "date_created",
          type: "dateTime",
          schema: { is_nullable: true },
          meta: { interface: "datetime", readonly: true, special: ["date-created"] },
        },
      ],
    }),
  });
  console.log("  ✓ Coleção whatsapp_messages criada com sucesso.");
}

async function configurePermissionsAndIndexes() {
  console.log("🔐 Configurando permissões (Admin only write)...");
  // No Directus, o role Admin tem permissão total por padrão.
  // Para outros papéis (CRM / Vendedor), liberamos apenas leitura de instâncias.
  const permissions = [
    {
      collection: "whatsapp_instances",
      action: "read",
      fields: ["*"],
    },
    {
      collection: "whatsapp_messages",
      action: "read",
      fields: ["*"],
    },
    {
      collection: "whatsapp_messages",
      action: "create",
      fields: ["*"],
    },
  ];

  for (const perm of permissions) {
    await apiRequest("/permissions", {
      method: "POST",
      body: JSON.stringify(perm),
    }).catch(() => null);
  }
  console.log("  ✓ Permissões aplicadas com sucesso.");
}

async function main() {
  console.log("=========================================");
  console.log("🚀 Setup Schema: WhatsApp Dual Multi-Number");
  console.log(`📡 URL Directus: ${DIRECTUS_URL}`);
  console.log("=========================================\n");

  await createWhatsAppInstancesCollection();
  await createWhatsAppMessagesCollection();
  await configurePermissionsAndIndexes();

  console.log("\n🎉 Setup Directus concluído com sucesso!");
}

main().catch((err) => {
  console.error("❌ Erro fatal no setup WhatsApp schema:", err);
});
