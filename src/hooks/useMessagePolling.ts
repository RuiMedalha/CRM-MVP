import { useEffect } from "react"

import { fetchMessagesWithFallback } from "@/integrations/directus/hubConversations"
import { POLL_INTERVAL_MS } from "@/services/conversationPolling"

import { findStoredConversation, useConversationStore } from "@/store/conversationStore"
import { useMessageStore } from "@/store/messageStore"

export function useMessagePolling() {
  const selectedConversationId = useConversationStore((s) => s.selectedConversationId)
  const syncMessagesFromPoll = useMessageStore((s) => s.syncMessagesFromPoll)

  useEffect(() => {
    if (selectedConversationId === undefined) return

    const activeConversationId: string = selectedConversationId
    let stopped = false

    async function tick() {
      const state = useConversationStore.getState()
      const conversation = findStoredConversation(state, activeConversationId)

      const msgs = await fetchMessagesWithFallback(
        activeConversationId,
      )

      if (!stopped) {
        syncMessagesFromPoll(activeConversationId, msgs)
      }
    }

    void tick()
    const intervalId = setInterval(() => { void tick() }, POLL_INTERVAL_MS)

    return () => {
      stopped = true
      clearInterval(intervalId)
    }
  }, [selectedConversationId, syncMessagesFromPoll])
}
