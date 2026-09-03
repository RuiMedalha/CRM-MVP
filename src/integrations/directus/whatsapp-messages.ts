import { directusRequest } from "./client";
import { createActivity } from "./activities";
import type {
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
  WhatsAppMediaType,
} from "@/services/whatsapp/types";

const LOCAL_STORAGE_KEY = "crm_whatsapp_messages_log_v1";

function getLocalMessages(): WhatsAppMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Failed to load local WhatsApp messages:", e);
  }
  return [];
}

function saveLocalMessages(messages: WhatsAppMessage[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages.slice(0, 500)));
  } catch (e) {
    console.warn("Failed to save local WhatsApp messages:", e);
  }
}

export async function recordWhatsAppMessage(
  payload: Partial<WhatsAppMessage> & {
    instance_id: string;
    direction: WhatsAppMessageDirection;
    from_number: string;
    to_number: string;
    body: string;
    whatsapp_id: string;
  },
): Promise<WhatsAppMessage> {
  const newId =
    payload.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);

  const record: WhatsAppMessage = {
    id: newId,
    instance_id: payload.instance_id,
    direction: payload.direction,
    from_number: payload.from_number,
    to_number: payload.to_number,
    body: payload.body,
    media_url: payload.media_url || null,
    media_type: payload.media_type || null,
    whatsapp_id: payload.whatsapp_id,
    lead_id: payload.lead_id || null,
    conversation_id: payload.conversation_id || null,
    status: payload.status || (payload.direction === "outbound" ? "sent" : "delivered"),
    timestamp: payload.timestamp || new Date().toISOString(),
    raw_payload: payload.raw_payload || null,
    date_created: new Date().toISOString(),
  };

  try {
    await directusRequest("/items/whatsapp_messages", {
      method: "POST",
      body: JSON.stringify(record),
    });
  } catch (err) {
    console.warn("Directus /items/whatsapp_messages save failed, persisting locally:", err);
  }

  // Dual-write ao activity ledger existente (activity) sem criar novas coleções
  createActivity({
    type: "whatsapp",
    channel: (payload.raw_payload as any)?.provider === "meta" ? "meta" : "evolution",
    direction: payload.direction === "inbound" ? "in" : "out",
    status: record.status,
    summary: payload.body ? payload.body.slice(0, 255) : "Mensagem WhatsApp",
    occurred_at: record.timestamp,
    lead_id: payload.lead_id ? String(payload.lead_id) : null,
    contact_id: payload.lead_id ? String(payload.lead_id) : null,
    conversation_id: payload.conversation_id ? String(payload.conversation_id) : null,
    source_collection: "whatsapp_messages",
    source_id: record.id,
    payload: {
      whatsapp_id: record.whatsapp_id,
      from: record.from_number,
      to: record.to_number,
      media_type: record.media_type,
      media_url: record.media_url,
    },
  }).catch(() => {});

  const list = getLocalMessages();
  list.unshift(record);
  saveLocalMessages(list);

  return record;
}

export async function fetchWhatsAppMessages(params?: {
  instanceId?: string;
  leadId?: string | number;
  limit?: number;
}): Promise<WhatsAppMessage[]> {
  try {
    const query = new URLSearchParams();
    query.set("sort", "-timestamp");
    query.set("limit", String(params?.limit || 50));

    if (params?.instanceId) {
      query.set("filter[instance_id][_eq]", params.instanceId);
    }
    if (params?.leadId) {
      query.set("filter[lead_id][_eq]", String(params.leadId));
    }

    const res = await directusRequest<{ data: any[] }>(`/items/whatsapp_messages?${query.toString()}`);
    if (res?.data && Array.isArray(res.data)) {
      return res.data;
    }
  } catch (err) {
    console.warn("Directus /items/whatsapp_messages fetch failed, using local messages:", err);
  }

  const list = getLocalMessages();
  return list.filter((m) => {
    if (params?.instanceId && m.instance_id !== params.instanceId) return false;
    if (params?.leadId && String(m.lead_id) !== String(params.leadId)) return false;
    return true;
  });
}

export async function updateWhatsAppMessageStatus(
  whatsappId: string,
  status: WhatsAppMessageStatus,
): Promise<void> {
  try {
    // Busca id correspondente ou atualiza direto
    await directusRequest(`/items/whatsapp_messages`, {
      method: "PATCH",
      body: JSON.stringify({
        filter: { whatsapp_id: { _eq: whatsappId } },
        data: { status },
      }),
    });
  } catch (err) {
    console.warn("Directus /items/whatsapp_messages status update failed:", err);
  }

  const list = getLocalMessages();
  const target = list.find((m) => m.whatsapp_id === whatsappId);
  if (target) {
    target.status = status;
    saveLocalMessages(list);
  }
}
