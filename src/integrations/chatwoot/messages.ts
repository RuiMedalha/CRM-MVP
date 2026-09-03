import { CHATWOOT_ACCOUNT_ID, chatwootRequest } from "./client";
import type { Message } from "@/integrations/directus/messages";

interface ChatwootMessagesResponse {
  payload?: unknown[];
}

/** Remove o prefixo "**+351XXX - Nome:**" / "**Nome:**" que o Chatwoot mete no content. */
export function cleanChatwootContent(content: string): string {
  if (!content) return "";
  return content.replace(/^\*\*[^*]+\*\*:?\s*/m, "").trim();
}

/** message_type Chatwoot: 0 = incoming (cliente); restantes = outbound (agente/bot). */
function mapChatwootMessage(raw: unknown, conversationId: string): Message {
  const m = (raw ?? {}) as Record<string, any>;
  return {
    id: String(m.id ?? ""),
    conversationId,
    content: cleanChatwootContent(m.content ?? ""),
    direction: m.message_type === 0 ? "inbound" : "outbound",
    contentType: m.content_type ?? "text",
    createdAt: m.created_at ? new Date(Number(m.created_at) * 1000).toISOString() : "",
  };
}

/** Mensagens de uma conversa Chatwoot, sem activity messages, ordenadas asc. Nunca rebenta → []. */
export async function getChatwootMessages(conversationId: string): Promise<Message[]> {
  const convId = conversationId.trim();
  if (!convId) return [];
  try {
    const res = await chatwootRequest<ChatwootMessagesResponse>(
      `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${encodeURIComponent(convId)}/messages`,
    );
    return (res?.payload ?? [])
      .map((m) => mapChatwootMessage(m, convId))
      .filter((m) => m.content.trim().length > 0)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

/** Envia mensagem outgoing pública via Chatwoot. PATCH silencioso. */
export async function sendChatwootMessage(
  conversationId: string,
  content: string,
): Promise<void> {
  const convId = conversationId.trim();
  const text = content.trim();
  if (!convId || !text) return;
  try {
    await chatwootRequest<unknown>(
      `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${encodeURIComponent(convId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content: text, message_type: "outgoing", private: false }),
      },
    );
  } catch {
    // silencioso
  }
}
