import { useCallback, useState } from "react"

import { DIRECTUS_URL } from "@/integrations/directus/client"
import {
  assumeConversation,
  closeConversation,
  HUB_DEFAULT_AGENT,
  updateConversation,
} from "@/integrations/directus/hubConversations"
import { isSiteChatChannel, siteChatTakeover, siteChatRelease } from "@/integrations/directus/siteChat"

import { useConversationStore } from "@/store/conversationStore"
import type { Conversation } from "@/types/conversation"

function optimisticPatch(
  conversation: Conversation,
  patch: Partial<Conversation>,
): Conversation {
  return { ...conversation, ...patch, updatedAt: new Date().toISOString() }
}

export function useConversationOperations(conversation: Conversation | undefined) {
  const assignConversation = useConversationStore((s) => s.assignConversation)
  const toggleAi = useConversationStore((s) => s.toggleAi)
  const mergeConversation = useConversationStore((s) => s.mergeConversation)

  const [busy, setBusy] = useState(false)

  const runRemote = useCallback(
    async (
      localApply: () => void,
      remote: () => Promise<Conversation>,
      logLabel: string,
    ) => {
      if (!conversation) return
      localApply()
      if (!DIRECTUS_URL) return
      setBusy(true)
      try {
        const updated = await remote()
        mergeConversation(updated)
        console.log(logLabel)
      } catch (error) {
        console.warn(`${logLabel} failed`, error)
      } finally {
        setBusy(false)
      }
    },
    [conversation, mergeConversation],
  )

  const assume = useCallback(() => {
    if (!conversation) return
    void runRemote(
      () => {
        assignConversation(conversation.id, HUB_DEFAULT_AGENT)
        mergeConversation(
          optimisticPatch(conversation, {
            status: "human_active",
            mode: "human",
            aiEnabled: false,
            assignedTo: HUB_DEFAULT_AGENT,
          }),
        )
      },
      async () => {
        const updated = await assumeConversation(conversation.id, HUB_DEFAULT_AGENT)
        if (isSiteChatChannel(conversation.channel)) {
          await siteChatTakeover(conversation.source || "", HUB_DEFAULT_AGENT).catch(() => {})
        }
        return updated
      },
      "[Directus] conversation assigned",
    )
  }, [conversation, assignConversation, mergeConversation, runRemote])

  const reactivate = useCallback(() => {
    if (!conversation) return
    void runRemote(
      () => {
        toggleAi(conversation.id)
        mergeConversation(
          optimisticPatch(conversation, {
            status: "ai_active",
            mode: "bot",
            aiEnabled: true,
            assignedTo: undefined,
          }),
        )
      },
      async () => {
        const updated = await updateConversation(conversation.id, {
          status: "ai_active",
          mode: "bot",
          ai_enabled: true,
          assigned_to: null,
        } as never)
        if (isSiteChatChannel(conversation.channel)) {
          await siteChatRelease(conversation.source || "").catch(() => {})
        }
        return updated
      },
      "[Directus] AI reactivated",
    )
  }, [conversation, toggleAi, mergeConversation, runRemote])

  const close = useCallback(() => {
    if (!conversation) return
    void runRemote(
      () =>
        mergeConversation(
          optimisticPatch(conversation, {
            status: "closed",
            aiEnabled: false,
            unreadCount: 0,
          }),
        ),
      () => closeConversation(conversation.id),
      "[Directus] conversation closed",
    )
  }, [conversation, mergeConversation, runRemote])

  const reopen = useCallback(() => {
    if (!conversation) return
    void runRemote(
      () =>
        mergeConversation(
          optimisticPatch(conversation, {
            status: "ai_active",
            mode: "bot",
            aiEnabled: true,
            assignedTo: undefined,
            unreadCount: 1,
          }),
        ),
      () =>
        updateConversation(conversation.id, {
          status: "ai_active",
          mode: "bot",
          ai_enabled: true,
          assigned_to: null,
        } as never),
      "[Directus] conversation reopened",
    )
  }, [conversation, mergeConversation, runRemote])

  const transfer = useCallback(
    (agentName: string) => {
      if (!conversation || !agentName.trim()) return
      const name = agentName.trim()
      void runRemote(
        () => {
          assignConversation(conversation.id, name)
          mergeConversation(
            optimisticPatch(conversation, {
              status: "human_active",
              mode: "human",
              aiEnabled: false,
              assignedTo: name,
            }),
          )
        },
        () =>
          updateConversation(conversation.id, {
            status: "human_active",
            mode: "human",
            ai_enabled: false,
            assigned_to: name,
          } as never),
        "[Directus] conversation transferred",
      )
    },
    [conversation, assignConversation, mergeConversation, runRemote],
  )

  return {
    busy,
    assume,
    reactivate,
    close,
    reopen,
    transfer,
    canAssume:
      !!conversation &&
      (conversation.status === "ai_active" ||
       conversation.status === "handoff" ||
       (conversation.mode === "bot" && conversation.status !== "closed")),
    canReactivate:
      !!conversation &&
      (conversation.status === "human_active" ||
       conversation.mode === "human"),
    canClose: !!conversation && conversation.status !== "closed",
    canReopen: !!conversation && conversation.status === "closed",
    canTransfer: !!conversation && conversation.status !== "closed",
  }
}

export { HUB_DEFAULT_AGENT as HUB_AGENT_NAME }
