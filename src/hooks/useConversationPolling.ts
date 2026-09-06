import { useEffect } from "react"
import { startConversationPolling } from "@/services/conversationPolling"
import { useConversationStore } from "@/store/conversationStore"
import type { Conversation } from "@/types/conversation"

function mergeConversationsByRecency(
  incoming: Conversation[],
  previous: Conversation[],
): Conversation[] {
  const mergedMap = new Map<string, Conversation>()

  for (const prev of previous) {
    mergedMap.set(prev.id, prev)
  }

  for (const inc of incoming) {
    const cur = mergedMap.get(inc.id)
    if (!cur) {
      mergedMap.set(inc.id, inc)
      continue
    }

    const incTime = Math.max(
      new Date(inc.lastActivityAt || 0).getTime(),
      new Date(inc.updatedAt || 0).getTime(),
      new Date(inc.createdAt || 0).getTime(),
    )
    const curTime = Math.max(
      new Date(cur.lastActivityAt || 0).getTime(),
      new Date(cur.updatedAt || 0).getTime(),
      new Date(cur.createdAt || 0).getTime(),
    )

    if (incTime >= curTime) {
      mergedMap.set(inc.id, inc)
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => {
    const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : new Date(a.createdAt || 0).getTime()
    const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : new Date(b.createdAt || 0).getTime()
    return tb - ta
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
