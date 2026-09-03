import { DIRECTUS_ADMIN_TOKEN } from "@/integrations/directus/client";

/* ════════════════════════════════════════════════════════════════════════
   Resposta do operador para o chat do SITE (WP Flow), canal "askme".
   O operador escreve no CRM → POST /campaign-api/chat-reply (proxy same-origin
   que guarda o Bearer token do WP Flow) → o visitante vê a resposta no chat.
   A mensagem é persistida no Directus pelo próprio CRM (sendAgentMessage);
   o bridge do WP já NÃO a re-espelha (evita duplicado).
════════════════════════════════════════════════════════════════════════ */

/** Canal (Directus conversations.channel) do chat do site. Ver option WP heq_crm_bridge_channel. */
export const SITE_CHAT_CHANNEL = "askme";

export function isSiteChatChannel(channel?: string | null): boolean {
  return (channel || "").trim().toLowerCase() === SITE_CHAT_CHANNEL;
}

export interface SiteChatReplyResult {
  ok: boolean;
  reason?: string;
}

/**
 * Entrega a resposta do operador ao visitante do site.
 * @param sessionId  conversation.source (id de sessão do WP Flow)
 * @param text       corpo da mensagem
 * @param agentName  nome do operador (mostrado como "agente externo")
 */
export async function sendSiteChatReply(
  sessionId: string,
  text: string,
  agentName?: string,
): Promise<SiteChatReplyResult> {
  const sid = (sessionId || "").trim();
  const body = (text || "").trim();
  if (!sid) return { ok: false, reason: "Sessão do chat não encontrada na conversa" };
  if (!body) return { ok: false, reason: "Mensagem vazia" };

  try {
    const res = await fetch(`/campaign-api/chat-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-directus-token": DIRECTUS_ADMIN_TOKEN },
      body: JSON.stringify({ session_id: sid, text: body, agent_name: agentName || "" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, reason: (j as any)?.error || `Falha ao entregar (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Falha de rede ao entregar" };
  }
}

/**
 * Pausar a IA do chat e assumir a conversa (takeover).
 */
export async function siteChatTakeover(
  sessionId: string,
  agentName?: string,
): Promise<SiteChatReplyResult> {
  const sid = (sessionId || "").trim();
  if (!sid) return { ok: false, reason: "Sessão do chat não encontrada" };

  try {
    const res = await fetch(`/campaign-api/chat-takeover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-directus-token": DIRECTUS_ADMIN_TOKEN },
      body: JSON.stringify({ session_id: sid, agent_name: agentName || "" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, reason: (j as any)?.error || `Falha no takeover (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Falha de rede" };
  }
}

/**
 * Devolver a conversa à IA (release).
 */
export async function siteChatRelease(
  sessionId: string,
): Promise<SiteChatReplyResult> {
  const sid = (sessionId || "").trim();
  if (!sid) return { ok: false, reason: "Sessão do chat não encontrada" };

  try {
    const res = await fetch(`/campaign-api/chat-release`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-directus-token": DIRECTUS_ADMIN_TOKEN },
      body: JSON.stringify({ session_id: sid }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, reason: (j as any)?.error || `Falha no release (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Falha de rede" };
  }
}
