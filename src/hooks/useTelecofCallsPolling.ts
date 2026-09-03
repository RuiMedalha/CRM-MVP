import { useEffect } from "react"

import { DIRECTUS_URL } from "@/integrations/directus/client"
import { listTelecofQueueEvents } from "@/integrations/directus/hubCommunicationEvents"

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
  const event = useTelecofCallStore((s) =>
    s.events.find((e) => {
      if (e.operationalStatus !== "new") return false
      const created = Date.parse(e.createdAt)
      if (Number.isNaN(created)) return false
      return Date.now() - created < RECENT_MS
    }),
  )

  if (!event) return { incomingCall: null }

  return {
    incomingCall: {
      id: event.id,
      phone: event.phone,
      customer_name: event.customerName,
      channel: event.channel,
      agent_name: event.agentName,
    },
  }
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
