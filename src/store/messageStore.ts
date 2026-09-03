import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Message, MessageSenderType } from "@/types/message"

interface MessageState {
  messages: Message[]
  syncMessagesFromPoll: (conversationId: string, remote: Message[]) => void
  prependMessages: (conversationId: string, older: Message[]) => void
  upsertMessage: (message: Message) => void
  addMessage: (payload: {
    conversationId: string
    content: string
    senderType?: MessageSenderType
    senderName?: string
    id?: string
    createdAt?: string
  }) => void
}

const DEDUPE_WINDOW_MS = 15_000

function isLikelySameMessage(a: Message, b: Message): boolean {
  if (a.id === b.id) return true
  return (
    a.conversationId === b.conversationId &&
    a.senderType === b.senderType &&
    a.content.trim() === b.content.trim() &&
    Math.abs(
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ) < DEDUPE_WINDOW_MS
  )
}

function isShadowedByRemote(local: Message, remote: Message[]): boolean {
  return remote.some((r) => isLikelySameMessage(local, r))
}

function newMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set) => ({
      messages: [],

      syncMessagesFromPoll: (conversationId, remote) =>
        set((state) => {
          if (remote.length === 0) return state
          const incomingIds = new Set(remote.map((m) => m.id))
          const otherConversations = state.messages.filter(
            (m) => m.conversationId !== conversationId,
          )
          const localOnlyForConv = state.messages.filter(
            (m) =>
              m.conversationId === conversationId &&
              !incomingIds.has(m.id) &&
              !isShadowedByRemote(m, remote),
          )
          return { messages: [...otherConversations, ...remote, ...localOnlyForConv] }
        }),

      prependMessages: (conversationId, older) =>
        set((state) => {
          if (older.length === 0) return state
          const existingIds = new Set(state.messages.map((m) => m.id))
          const newOnes = older.filter((m) => !existingIds.has(m.id))
          if (newOnes.length === 0) return state
          const others = state.messages.filter((m) => m.conversationId !== conversationId)
          const current = state.messages.filter((m) => m.conversationId === conversationId)
          return { messages: [...others, ...newOnes, ...current] }
        }),

      upsertMessage: (message) =>
        set((state) => {
          const index = state.messages.findIndex((m) => m.id === message.id)
          if (index >= 0) {
            const messages = [...state.messages]
            messages[index] = message
            return { messages }
          }
          const withoutShadow = state.messages.filter(
            (m) => !isLikelySameMessage(m, message),
          )
          return { messages: [...withoutShadow, message] }
        }),

      addMessage: ({ conversationId, content, senderType = "agent", senderName, id, createdAt }) =>
        set((state) => {
          const message: Message = {
            id: id ?? newMessageId(),
            conversationId,
            senderType,
            senderName,
            content: content.trim(),
            createdAt: createdAt ?? new Date().toISOString(),
          }
          const withoutShadow = state.messages.filter(
            (m) => !isLikelySameMessage(m, message),
          )
          const index = withoutShadow.findIndex((m) => m.id === message.id)
          if (index >= 0) {
            const messages = [...withoutShadow]
            messages[index] = message
            return { messages }
          }
          return { messages: [...withoutShadow, message] }
        }),
    }),
    {
      name: "crm-messages",
      partialize: (state) => ({ messages: state.messages.slice(-500) }),
    },
  ),
)
