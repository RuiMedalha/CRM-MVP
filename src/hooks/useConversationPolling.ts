import { useEffect } from "react"
import { startConversationPolling } from "@/services/conversationPolling"
import { useConversationStore } from "@/store/conversationStore"
import type { Conversation } from "@/types/conversation"

function mergeConversationsByRecency(
  incoming: Conversation[],
  previous: Conversation[],
): Conversation[] {
  const prevById = new Map(previous.map((c) => [c.id, c]))
  return incoming.map((inc) => {
    const cur = prevById.get(inc.id)
    if (!cur) return inc
    const incTime = new Date(inc.updatedAt).getTime()
    const curTime = new Date(cur.updatedAt).getTime()
    return incTime > curTime ? inc : cur
  })
}

export function useConversationPolling() {
  useEffect(() => {
    const stop = startConversationPolling(
      (incoming) => {
        if (incoming.length === 0) return
        useConversationStore.setState((state) => ({
          conversations: mergeConversationsByRecency(incoming, state.conversations),
        }))
      },
      (groups) => {
        if (groups.length === 0) return
        useConversationStore.setState((state) => ({
          groupConversations: mergeConversationsByRecency(groups, state.groupConversations),
        }))
      },
    )
    return stop
  }, [])
}
