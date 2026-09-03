import { DIRECTUS_ADMIN_TOKEN as DIRECTUS_TOKEN } from "./client";
const DIRECTUS_URL = "https://api.hotelequip.pt";

const headers = {
  Authorization: `Bearer ${DIRECTUS_TOKEN}`,
  "Content-Type": "application/json",
};

export interface WA916Conversation {
  id: string;
  customer_name: string;
  source: string; // ex: "351916542211@s.whatsapp.net"
  last_message: string | null;
  unread_count: number;
  last_activity_at: string | null;
  updated_at: string;
  status: string;
  channel: string;
}

export interface WA916Message {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "agent" | "system";
  sender_name: string;
  content: string;
  content_type: string;
  created_at: string;
  attachments: Array<{
    type: string;
    url: string;
    mime_type?: string;
    filename?: string;
  }> | null;
}

// Conversas do canal whatsapp (916)
export async function getWA916Conversations(): Promise<WA916Conversation[]> {
  const params = new URLSearchParams({
    "filter[channel][_eq]": "whatsapp",
    "filter[source][_ncontains]": "351913866565", // excluir conversas do 913
    fields: "id,customer_name,source,last_message,last_activity_at,unread_count,updated_at,status",
    sort: "-last_activity_at",
    limit: "50",
  });
  const resp = await fetch(`${DIRECTUS_URL}/items/conversations?${params}`, { headers });
  if (!resp.ok) throw new Error(`Directus conversations ${resp.status}`);
  const data = await resp.json();
  return data.data ?? [];
}

// Mensagens de uma conversa
export async function getWA916Messages(conversationId: string): Promise<WA916Message[]> {
  const params = new URLSearchParams({
    "filter[conversation_id][_eq]": conversationId,
    fields: "id,conversation_id,sender_type,sender_name,content,content_type,created_at,attachments",
    sort: "created_at",
    limit: "100",
  });
  const resp = await fetch(`${DIRECTUS_URL}/items/messages?${params}`, { headers });
  if (!resp.ok) throw new Error(`Directus messages ${resp.status}`);
  const data = await resp.json();
  return data.data ?? [];
}

export interface OutboundAttachment {
  type: string;
  url: string;
  s3Url?: string;
  mime_type?: string;
  filename?: string;
  base64: null;
}

// Criar mensagem de saída no Directus (registo do que foi enviado)
export async function createOutboundMessage(
  conversationId: string,
  content: string,
  contentType: string = "text",
  attachments?: OutboundAttachment[] | null,
): Promise<void> {
  await fetch(`${DIRECTUS_URL}/items/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_type: "agent",
      sender_name: "Agente",
      content,
      content_type: contentType,
      delivery_status: "sent",
      attachments: attachments ?? null,
    }),
  });
}

// Marcar conversa como lida (unread_count = 0)
export async function markConversationRead(conversationId: string): Promise<void> {
  await fetch(`${DIRECTUS_URL}/items/conversations/${conversationId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ unread_count: 0 }),
  });
}

// Extrair número de telefone do JID do WhatsApp
// "351916542211@s.whatsapp.net" → "351916542211"
export function jidToPhone(source: string): string {
  return (source ?? "").replace(/@.*/, "");
}
