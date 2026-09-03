import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

import { DIRECTUS_URL } from "@/integrations/directus/client"
import { listTelecofQueueEvents } from "@/integrations/directus/hubCommunicationEvents"
import { listNewIncomingCalls } from "@/integrations/directus/communicationEvents"

import { useInboxFilterStore } from "@/store/inboxFilterStore"
import { useTelecofCallStore } from "@/store/telecofCallStore"

/** Formato que TelecofBanner.tsx espera (snake_case legacy). */
interface IncomingCallShape {
  id: string
  phone: string
  customer_name?: string
  channel: string
  agent_name?: string
}

/** Devolve a chamada mais recente com estado "new" (se existir) — só dos últimos 5 minutos. */
export function useIncomingTelecofCall(): { incomingCall: IncomingCallShape | null } {
  const RECENT_MS = 5 * 60 * 1000 // 5 minutos

  // 1. Polling autónomo global para chamadas a entrar (funciona em qualquer página do CRM)
  const { data: directCalls } = useQuery({
    queryKey: ["incoming-telecof-calls-global"],
    queryFn: async () => {
      const calls = await listNewIncomingCalls();
      return calls;
    },
    refetchInterval: 3000,
    staleTime: 2000,
  });

  const freshDirectCall = (directCalls || []).find((c) => {
    if (c.status !== "new") return false;
    const created = Date.parse(c.created_at || c.started_at || "");
    if (Number.isNaN(created)) return true;
    return Date.now() - created < RECENT_MS;
  });

  if (freshDirectCall) {
    return {
      incomingCall: {
        id: freshDirectCall.id,
        phone: freshDirectCall.phone,
        customer_name: freshDirectCall.customer_name,
        channel: freshDirectCall.channel,
        agent_name: freshDirectCall.agent_name,
      },
    };
  }

  // 2. Fallback para a store se carregada
  const event = useTelecofCallStore.getState().events.find((e) => {
    if (e.operationalStatus !== "new") return false;
    const created = Date.parse(e.createdAt);
    if (Number.isNaN(created)) return false;
    return Date.now() - created < RECENT_MS;
  });

  if (!event) return { incomingCall: null };

  return {
    incomingCall: {
      id: event.id,
      phone: event.phone,
      customer_name: event.customerName,
      channel: event.channel,
      agent_name: event.agentName,
    },
  };
}

const POLL_MS = 4000

export function useTelecofCallsPolling(): void {
  const inboxViewMode = useInboxFilterStore((s) => s.inboxViewMode)
  const { setEvents, setLoading, events } = useTelecofCallStore()

  useEffect(() => {
    if (inboxViewMode !== "telecof_calls") return

    let cancelled = false

    async function tick() {
      if (!DIRECTUS_URL) {
        if (!cancelled) {
          setEvents([])
          setLoading(false)
        }
        return
      }

      setLoading(true)

      try {
        const rows = await listTelecofQueueEvents(200)
        if (!cancelled) setEvents(rows)
      } catch {
        if (!cancelled && events.length === 0) setEvents([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void tick()
    const id = window.setInterval(() => { void tick() }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [inboxViewMode, setEvents, setLoading, events.length])
}
