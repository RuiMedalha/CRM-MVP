// WA·913 — WABA oficial (Meta Cloud API) — reads from Directus, sends via /wa-proxy
import { DIRECTUS_ADMIN_TOKEN as DIRECTUS_TOKEN, directusRequest } from "./client";
import { DIRECTUS_URL } from "@/lib/env";

export const META_TOKEN = ""; // Moved server-side to /wa-proxy endpoint
export const PHONE_NUMBER_ID = "943101945557713"; // Kept for reference only

const directusHeaders = {
  Authorization: `Bearer ${DIRECTUS_TOKEN}`,
  "Content-Type": "application/json",
};

// Identificar conversas do 913 pelo source.
const SOURCE_SUFFIX = "351913866565";

export interface WA913Conversation {
  id: string;
  customer_name: string;
  source: string;
  last_message: string | null;
  last_activity_at: string | null;
  unread_count: number;
  updated_at: string;
  status: string;
  channel: string;
}

export interface WA913Message {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "agent" | "system";
  sender_name: string;
  content: string;
  content_type: string;
  created_at: string;
  attachments:
    | Array<{ type: string; url: string; mime_type?: string; filename?: string }>
    | null;
}

export async function getWA913Conversations(): Promise<WA913Conversation[]> {
  const params = new URLSearchParams({
    "filter[channel][_eq]": "whatsapp",
    "filter[source][_contains]": SOURCE_SUFFIX,
    sort: "-last_activity_at",
    limit: "50",
    fields: "id,customer_name,source,last_message,last_activity_at,unread_count,updated_at,status",
  });
  const resp = await fetch(`${DIRECTUS_URL}/items/conversations?${params}`, {
    headers: directusHeaders,
  });
  if (!resp.ok) throw new Error(`Directus 913 conversations ${resp.status}`);
  const data = await resp.json();
  return data.data ?? [];
}

export async function getWA913Messages(conversationId: string): Promise<WA913Message[]> {
  const params = new URLSearchParams({
    "filter[conversation_id][_eq]": conversationId,
    sort: "created_at",
    limit: "100",
    fields: "id,conversation_id,sender_type,sender_name,content,content_type,created_at,attachments",
  });
  const resp = await fetch(`${DIRECTUS_URL}/items/messages?${params}`, {
    headers: directusHeaders,
  });
  if (!resp.ok) throw new Error(`Directus 913 messages ${resp.status}`);
  const data = await resp.json();
  return data.data ?? [];
}

// Enviar texto via Meta Cloud API
export async function sendTextViaWA913(toPhone: string, text: string): Promise<void> {
  const phone = toPhone.replace(/\D/g, "");
  const resp = await directusRequest<{ ok: boolean }>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({ provider: "meta", action: "sendText", number: phone, text }),
  });
  if (!(resp as any)?.ok) throw new Error(`Meta sendText failed via proxy`);
}

export interface WA913TemplateButton {
  type: string
  text: string
  url?: string
  phone_number?: string
}

export interface WA913TemplateComponent {
  type: string
  format?: string
  text?: string
  buttons?: WA913TemplateButton[]
}

export interface WA913ApprovedTemplate {
  name: string
  status: "APPROVED"
  language: string
  category: string
  components: WA913TemplateComponent[]
}

export async function listApprovedTemplatesViaWA913(): Promise<WA913ApprovedTemplate[]> {
  const resp = await directusRequest<{ ok: boolean; templates?: WA913ApprovedTemplate[] }>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({ provider: "meta", action: "listTemplates" }),
  })
  if (!(resp as any)?.ok) throw new Error("Não foi possível carregar os templates aprovados da Meta")
  return Array.isArray((resp as any)?.templates) ? (resp as any).templates : []
}

// Enviar template aprovado via Meta Cloud API, sempre pelo proxy server-side
export async function sendTemplateViaWA913(
  toPhone: string,
  templateName: string,
  languageCode: string = "pt_PT",
  components: object[] = [],
): Promise<{ messageId?: string }> {
  const phone = toPhone.replace(/\D/g, "");
  const resp = await directusRequest<{ ok: boolean; data?: { messages?: Array<{ id?: string }> } }>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({
      provider: "meta",
      action: "sendTemplate",
      number: phone,
      templateName,
      languageCode,
      components,
    }),
  });
  if (!(resp as any)?.ok) throw new Error("Meta sendTemplate failed via proxy")
  return { messageId: (resp as any)?.data?.messages?.[0]?.id }
}

// Marcar como lida
export async function markWA913ConversationRead(conversationId: string): Promise<void> {
  await fetch(`${DIRECTUS_URL}/items/conversations/${conversationId}`, {
    method: "PATCH",
    headers: directusHeaders,
    body: JSON.stringify({ unread_count: 0 }),
  });
}

// Registar mensagem enviada no Directus
export async function createWA913OutboundMessage(
  conversationId: string,
  content: string,
  contentType: string = "text",
): Promise<void> {
  await fetch(`${DIRECTUS_URL}/items/messages`, {
    method: "POST",
    headers: directusHeaders,
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_type: "agent",
      sender_name: "Agente",
      content,
      content_type: contentType,
      delivery_status: "sent",
    }),
  });
}

// Enviar media via Meta Cloud API
export async function sendMediaViaWA913(
  phone: string,
  type: 'image' | 'video' | 'audio' | 'document',
  mediaUrl: string,
  filename?: string
): Promise<void> {
  const to = phone.replace(/\D/g, '')
  const resp = await directusRequest<{ ok: boolean }>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({
      provider: "meta", action: "sendMedia", number: to,
      mediatype: type,
      media: mediaUrl,
      caption: type === "document" ? undefined : undefined,
      fileName: filename,
    }),
  })
  if (!(resp as any)?.ok) {
    throw new Error(`Meta sendMedia failed via proxy`)
  }
}

// Templates disponíveis
export const WA913_TEMPLATES = [
  {
    name: "handoff_notification",
    label: "Transferência para agente",
    language: "pt_PT",
    preview: "Recebeste uma nova conversa do chatbot HotelEquip que precisa de atenção humana.",
    components: [] as object[],
  },
];
