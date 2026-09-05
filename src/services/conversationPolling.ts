import { DIRECTUS_URL } from "@/integrations/directus/client"
import { getConversations, getGroupConversations } from "@/integrations/directus/hubConversations"
import { getConversationsMock } from "./directusConversations"
import { isGroupConversation } from "@/lib/inboxFilters"
import { startRealtimeMessages } from "./realtimeMessages"

import type { Conversation } from "@/types/conversation"

export const POLL_INTERVAL_MS = 10000

/**
 * Feature flag para WebSocket realtime.
 * Default OFF — só activa quando o operador a ligar via .env / runtime flag.
 * Quando OFF, comportamento é idêntico ao estado anterior (polling puro).
 * Default só passa a ON depois de validar que o /websocket do Directus responde 101.
 */
const FEATURE_REALTIME_WS = import.meta.env.VITE_FEATURE_REALTIME_WS === "true"
export function isRealtimeWsEnabled(): boolean {
  return FEATURE_REALTIME_WS
}

export type ConversationFetchResult = {
  list: Conversation[]
  ok: boolean
}

export async function fetchConversationsWithFallback(): Promise<ConversationFetchResult> {
  try {
    if (!DIRECTUS_URL) {
      return { list: getConversationsMock().filter((c) => !isGroupConversation(c)), ok: true }
    }

    const [waResult, askmeResult, emailResult] = await Promise.all([
      // WhatsApp — busca por todos os canais WhatsApp conhecidos com limite generoso
      getConversations({
        "filter[channel][_in]": "whatsapp,whatsapp_meta,whatsapp_group,whatsapp_916,whatsapp_918,whatsapp_913,waha,wa918,wa916,wa913",
      }, 0, 500).catch(() =>
        getConversations({ "filter[channel][_starts_with]": "wa" }, 0, 500).catch(() =>
          getConversations({ "filter[channel][_eq]": "whatsapp" }, 0, 500).catch(() => [] as Conversation[])
        )
      ),
      // Ask Me — só com mensagem real (não visitas vazias)
      getConversations({
        "filter[channel][_eq]": "askme",
        "filter[last_message][_nnull]": "true",
      }, 0, 100).catch(() => [] as Conversation[]),
      // Email
      getConversations({ "filter[channel][_eq]": "email" }, 0, 100)
        .catch(() => [] as Conversation[]),
    ])

    const all = [...waResult, ...askmeResult, ...emailResult].sort((a, b) => {
      const ta = Math.max(
        new Date(a.lastActivityAt || 0).getTime(),
        new Date(a.updatedAt || 0).getTime(),
        new Date(a.createdAt || 0).getTime(),
      )
      const tb = Math.max(
        new Date(b.lastActivityAt || 0).getTime(),
        new Date(b.updatedAt || 0).getTime(),
        new Date(b.createdAt || 0).getTime(),
      )
      return tb - ta
    })

    return { list: all, ok: true }
  } catch (error) {
    console.warn("[CRM] fetchConversations falhou — mantém lista anterior", error)
    return { list: [], ok: false }
  }
}

export async function fetchGroupConversationsWithFallback(): Promise<ConversationFetchResult> {
  try {
    if (!DIRECTUS_URL) {
      return {
        list: getConversationsMock().filter((c) => isGroupConversation(c)),
        ok: true,
      }
    }
    const list = await getGroupConversations()
    return { list, ok: true }
  } catch (error) {
    console.warn("[CRM] fetchGroupConversations falhou", error)
    return { list: [], ok: false }
  }
}

export function startConversationPolling(
  onIndividuals: (conversations: Conversation[]) => void,
  onGroups?: (conversations: Conversation[]) => void,
): () => void {
  let stopped = false
  let fetching = false
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null
  let stopRealtime: () => void = () => {}

  async function tick() {
    if (stopped || fetching) return
    fetching = true

    try {
      const [individualsResult, groupsResult] = await Promise.all([
        fetchConversationsWithFallback(),
        onGroups
          ? fetchGroupConversationsWithFallback()
          : Promise.resolve({ list: [] as Conversation[], ok: true }),
      ])

      if (!stopped) {
        if (individualsResult.ok) onIndividuals(individualsResult.list)
        if (onGroups && groupsResult.ok) onGroups(groupsResult.list)
      }
    } finally {
      fetching = false
    }
  }

  // Realtime WS (opt-in via flag VITE_FEATURE_REALTIME_WS=true).
  // Quando ON: cada create em `messages` chama tick() com coalesce de 300ms.
  // Quando OFF (default): no-op silencioso — polling normal.
  function onRealtimeChange() {
    if (stopped) return
    if (coalesceTimer) clearTimeout(coalesceTimer)
    coalesceTimer = setTimeout(() => {
      coalesceTimer = null
      void tick()
    }, 300)
  }

  if (isRealtimeWsEnabled()) {
    stopRealtime = startRealtimeMessages(onRealtimeChange)
  }

  void tick()

  const intervalId = setInterval(() => {
    void tick()
  }, POLL_INTERVAL_MS)

  return () => {
    stopped = true
    clearInterval(intervalId)
    if (coalesceTimer) clearTimeout(coalesceTimer)
    stopRealtime()
  }
}
