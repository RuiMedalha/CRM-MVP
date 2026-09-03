import { directusRequest } from "./client";

export type MessageDirection = "inbound" | "outbound";

/** Anexo de mensagem (ex.: media recebida no WA·916 via n8n/Directus). */
export interface MessageAttachment {
  /** ID do asset no Directus (usado para construir URL de fallback). */
  id?: string;
  type?: string;
  url?: string;
  /** URL alternativa permanente (quando o n8n já fez upload). */
  s3Url?: string;
  mime_type?: string;
  filename?: string;
  base64?: string | null;
  /** metadados internos do hub — quando presente, o anexo não deve ser renderizado. */
  __hub_meta__?: unknown;
}

/** Mensagem (subset alinhado com o `Message` do communication-hub). */
export interface Message {
  id: string;
  conversationId: string;
  content: string;
  /** inbound = cliente; outbound = agente/ai/sistema. Derivado de `sender_type`. */
  direction: MessageDirection;
  contentType?: string;
  createdAt: string;
  attachments?: MessageAttachment[] | null;
}

interface DirectusListResponse<T> {
  data: T[];
}

/** `sender_type` do Directus → direção. `customer` é inbound; o resto é outbound. */
function directionFromSenderType(senderType: string): MessageDirection {
  return senderType.trim().toLowerCase() === "customer" ? "inbound" : "outbound";
}

function mapMessageRow(raw: unknown): Message {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    conversationId: String(r.conversation_id ?? ""),
    content: String(r.content ?? ""),
    direction: directionFromSenderType(String(r.sender_type ?? "")),
    contentType: (r.content_type as string | null | undefined) ?? undefined,
    createdAt: String(r.created_at ?? r.message_date ?? ""),
  };
}

const MESSAGE_FIELDS = [
  "id",
  "conversation_id",
  "sender_type",
  "content",
  "content_type",
  "created_at",
] as const;

/** Mensagens de uma conversa, ordenadas por data ascendente. */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const id = conversationId.trim();
  if (!id) return [];

  const params = new URLSearchParams();
  params.set("filter[conversation_id][_eq]", id);
  params.set("fields", MESSAGE_FIELDS.join(","));
  params.set("sort", "created_at");
  params.set("limit", "500");

  const json = await directusRequest<DirectusListResponse<unknown>>(
    `/items/messages?${params.toString()}`,
    { cache: "no-store" },
  );

  return (json.data ?? []).map(mapMessageRow);
}

const EVOLUTION_SEND_URL = (
  import.meta.env.VITE_N8N_EVOLUTION_SEND_URL as string | undefined
)?.trim();

export type SendMessageResult = {
  /** mensagem criada no Directus */
  saved: boolean;
  /** webhook n8n/Evolution respondeu OK */
  delivered: boolean;
  /** VITE_N8N_EVOLUTION_SEND_URL está definido */
  waConfigured: boolean;
};

/**
 * Envia uma mensagem WhatsApp do agente:
 *  1) cria a mensagem no Directus (sender_type=agent, delivery_status=sent);
 *  2) chama o webhook n8n/Evolution para entrega real.
 * Nunca lança — devolve o estado para a UI decidir o toast.
 */
export async function sendWhatsAppMessage(
  conversationId: string,
  content: string,
  phone: string,
): Promise<SendMessageResult> {
  const convId = conversationId.trim();
  const text = content.trim();
  const result: SendMessageResult = {
    saved: false,
    delivered: false,
    waConfigured: Boolean(EVOLUTION_SEND_URL),
  };
  if (!convId || !text) return result;

  // 1a — guardar no Directus (fonte de verdade)
  try {
    await directusRequest("/items/messages", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: convId,
        sender_type: "agent",
        content: text,
        content_type: "text",
        delivery_status: "sent",
      }),
    });
    result.saved = true;
  } catch {
    // não rebenta a UI; result.saved fica false
  }

  // 1b — entrega via n8n/Evolution (só se configurado)
  if (EVOLUTION_SEND_URL) {
    try {
      const res = await fetch(EVOLUTION_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message: text, conversationId: convId }),
      });
      result.delivered = res.ok;
    } catch {
      result.delivered = false;
    }
  }

  return result;
}
