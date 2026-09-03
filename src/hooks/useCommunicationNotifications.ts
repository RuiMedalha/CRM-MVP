import { useCallback, useEffect, useRef } from "react"

import {
  listNewCommunicationEvents,
  listUnhandledCommunicationEvents,
  listUnreadActiveConversations,
  patchHubCommunicationEvent,
} from "@/integrations/directus/hubCommunicationEvents"
import { DIRECTUS_URL } from "@/integrations/directus/client"

import { useInboxFilterStore } from "@/store/inboxFilterStore"
import { useConversationStore } from "@/store/conversationStore"
import { useNotificationStore } from "@/store/notificationStore"
import { useTelecofCallStore } from "@/store/telecofCallStore"

import type { NotificationToastItem } from "@/types/operationalEvent"
import type { TelecofCallEventRecord } from "@/types/telecof"

const POLL_MS = 8000

const OMNICHANNEL_EVENT_CHANNELS = new Set(["telecof", "askme", "whatsapp"])

const STALE_NEW_TO_UNHANDLED_MS = 5 * 60 * 1000

const RECENT_TOAST_WINDOW_MS = 30 * 60 * 1000

function isRecentForToast(createdAt: string): boolean {
  const t = Date.parse(createdAt)
  if (Number.isNaN(t)) return false
  return Date.now() - t < RECENT_TOAST_WINDOW_MS
}

function isOmnichannelEvent(event: TelecofCallEventRecord): boolean {
  return OMNICHANNEL_EVENT_CHANNELS.has(event.channel)
}

function shouldAutoMarkUnhandled(event: TelecofCallEventRecord): boolean {
  if (event.operationalStatus !== "new" || event.claimedAt) return false
  const created = Date.parse(event.createdAt)
  if (Number.isNaN(created)) return false
  return Date.now() - created >= STALE_NEW_TO_UNHANDLED_MS
}

function eventToastKey(event: TelecofCallEventRecord): string {
  return `event:${event.id}`
}

function conversationToastKey(conv: { id: string; updatedAt: string }): string {
  return `conversation:${conv.id}:${conv.updatedAt}`
}

export function useCommunicationNotifications(): void {
  const setBadgeCounts = useNotificationStore((s) => s.setBadgeCounts)
  const pushToast = useNotificationStore((s) => s.pushToast)
  const notificationsEnabled = useNotificationStore((s) => s.notificationsEnabled)
  const browserPermissionRequested = useNotificationStore(
    (s) => s.browserPermissionRequested,
  )
  const setBrowserPermissionRequested = useNotificationStore(
    (s) => s.setBrowserPermissionRequested,
  )

  const seenToastKeysRef = useRef<Set<string>>(new Set())
  const unhandledPatchInFlightRef = useRef<Set<string>>(new Set())

  const notifyItem = useCallback(
    (item: NotificationToastItem) => {
      if (seenToastKeysRef.current.has(item.key)) return
      if (!isRecentForToast(item.createdAt)) return
      seenToastKeysRef.current.add(item.key)
      pushToast(item)
    },
    [pushToast],
  )

  const poll = useCallback(async () => {
    if (!DIRECTUS_URL) return

    const [newEvents, unhandledEvents, unreadConversations] = await Promise.all([
      listNewCommunicationEvents(80),
      listUnhandledCommunicationEvents(80),
      listUnreadActiveConversations(80),
    ])

    const omnichannelNew = newEvents.filter(isOmnichannelEvent)

    for (const event of omnichannelNew) {
      if (shouldAutoMarkUnhandled(event)) {
        if (!unhandledPatchInFlightRef.current.has(event.id)) {
          unhandledPatchInFlightRef.current.add(event.id)
          void patchHubCommunicationEvent(event.id, { status: "unhandled" })
            .then((patched) => {
              useTelecofCallStore.getState().mergeEvent(patched)
            })
            .finally(() => {
              unhandledPatchInFlightRef.current.delete(event.id)
            })
        }
      }
    }

    // Secção 2: só contar itens dos últimos 7 dias para o badge
    const RECENT_BADGE_MS = 7 * 24 * 60 * 60 * 1000
    const isRecentForBadge = (createdAt: string) => {
      const t = Date.parse(createdAt)
      return !Number.isNaN(t) && Date.now() - t < RECENT_BADGE_MS
    }

    const newCount = omnichannelNew.filter((e) => isRecentForBadge(e.createdAt)).length
    const unhandledCount = unhandledEvents.filter((e) => isOmnichannelEvent(e) && isRecentForBadge(e.createdAt)).length
    const unreadCount = unreadConversations.reduce(
      (sum, c) => sum + (c.unreadCount ?? 0),
      0,
    )

    setBadgeCounts({ newCount, unhandledCount, unreadCount })

    for (const event of omnichannelNew) {
      notifyItem({
        key: eventToastKey(event),
        kind: "event",
        channel: event.channel,
        title: `Chamada ${event.channel === "telecof" ? "Telecof" : event.channel} — ${event.phone || event.normalizedPhone}`,
        subtitle: event.customerName ?? event.phone,
        createdAt: event.createdAt,
        eventId: event.id,
      })
    }

    const selectedConversationId = useConversationStore.getState().selectedConversationId
    for (const conversation of unreadConversations) {
      if (!OMNICHANNEL_EVENT_CHANNELS.has(conversation.channel)) continue
      if (selectedConversationId && conversation.id === selectedConversationId) continue
      notifyItem({
        key: conversationToastKey(conversation),
        kind: "conversation",
        channel: conversation.channel,
        title: conversation.customerName,
        subtitle: `${conversation.unreadCount} mensagem(ns) não lida(s)`,
        createdAt: conversation.updatedAt,
        conversationId: conversation.id,
      })
    }
  }, [notifyItem, setBadgeCounts])

  useEffect(() => {
    if (!browserPermissionRequested) {
      setBrowserPermissionRequested(true)
      if ("Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission()
      }
    }
  }, [browserPermissionRequested, setBrowserPermissionRequested])

  useEffect(() => {
    if (!DIRECTUS_URL) return

    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    const tick = () => {
      if (!active) return
      void poll()
    }

    const schedule = () => {
      if (timer) clearInterval(timer)
      if (!active) return
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      tick()
      timer = setInterval(tick, POLL_MS)
    }

    schedule()
    window.addEventListener("visibilitychange", schedule)
    window.addEventListener("focus", schedule)

    return () => {
      active = false
      if (timer) clearInterval(timer)
      window.removeEventListener("visibilitychange", schedule)
      window.removeEventListener("focus", schedule)
    }
  }, [poll])
}
