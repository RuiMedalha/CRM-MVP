import { CHATWOOT_ACCOUNT_ID, chatwootRequest } from "./client";
import { cleanChatwootContent } from "./messages";
import type { Conversation } from "@/integrations/directus/conversations";

interface ChatwootListResponse {
  data?: { payload?: unknown[] };
}

/** Mapeia uma conversa Chatwoot → `Conversation` (mesmo tipo do Directus). */
function mapChatwootConversation(raw: unknown): Conversation {
  const c = (raw ?? {}) as Record<string, any>;
  const sender = (c.meta?.sender ?? {}) as Record<string, any>;
  const lastActivity = Number(c.last_activity_at ?? 0);
  return {
    id: String(c.id ?? ""),
    contactId: sender.id != null ? String(sender.id) : undefined,
    contactPhone: sender.phone_number ?? undefined,
    customerName: sender.name ?? "Desconhecido",
    channel: "whatsapp",
    status: String(c.status ?? ""),
    lastMessage: cleanChatwootContent(c.last_non_activity_message?.content ?? ""),
    unreadCount: Number(c.unread_count ?? 0),
    updatedAt: lastActivity ? new Date(lastActivity * 1000).toISOString() : "",
  };
}

/**
 * Conversas Chatwoot abertas, agregadas das inboxes configuradas (default 6,7,8),
 * em paralelo, deduplicadas por id e ordenadas por last_activity_at desc.
 * Nunca rebenta → [].
 */
export async function getChatwootConversations(): Promise<Conversation[]> {
  const rawIds = (import.meta.env.VITE_CHATWOOT_INBOX_IDS as string | undefined) ?? "6,7,8";
  const inboxIds = rawIds
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  // Um pedido por inbox, em paralelo. try/catch por pedido → uma inbox a falhar
  // não bloqueia as restantes.
  const results = await Promise.all(
    inboxIds.map(async (inboxId) => {
      try {
        const res = await chatwootRequest<ChatwootListResponse>(
          `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations?inbox_id=${encodeURIComponent(inboxId)}&status=open&page=1`,
        );
        return res?.data?.payload ?? [];
      } catch {
        return [];
      }
    }),
  );

  const byId = new Map<string, Conversation>();
  for (const payload of results) {
    for (const raw of payload) {
      const conv = mapChatwootConversation(raw);
      if (conv.id && !byId.has(conv.id)) byId.set(conv.id, conv);
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
}

/** Uma conversa Chatwoot por id. Nunca rebenta → undefined. */
export async function getChatwootConversationById(
  id: string,
): Promise<Conversation | undefined> {
  const convId = id.trim();
  if (!convId) return undefined;
  try {
    const res = await chatwootRequest<unknown>(
      `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${encodeURIComponent(convId)}`,
    );
    return mapChatwootConversation(res);
  } catch {
    return undefined;
  }
}
