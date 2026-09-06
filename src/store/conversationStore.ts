import { create } from "zustand"
import type { Conversation } from "@/types/conversation"

interface ConversationState {
  conversations: Conversation[]
  groupConversations: Conversation[]
  selectedConversationId?: string

  setConversations: (conversations: Conversation[]) => void
  setGroupConversations: (conversations: Conversation[]) => void
  selectConversation: (id?: string) => void
  toggleAi: (conversationId: string) => void
  assignConversation: (conversationId: string, agentName: string) => void
  mergeConversation: (conversation: Conversation) => void
  recordConversationMessageActivity: (
    conversationId: string,
    content: string,
    options?: { incrementUnread?: boolean },
  ) => void
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  groupConversations: [],
  selectedConversationId: undefined,

  setConversations: (conversations) => set({ conversations }),

  setGroupConversations: (groupConversations) =>
    set({ groupConversations }),

  selectConversation: (id) => set({ selectedConversationId: id }),

  toggleAi: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              aiEnabled: true,
              assignedTo: undefined,
              status: "ai_active",
              mode: "bot",
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    })),

  assignConversation: (conversationId, agentName) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              aiEnabled: false,
              assignedTo: agentName,
              status: "human_active",
              mode: "human",
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    })),

  mergeConversation: (conversation) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversation.id ? { ...c, ...conversation } : c,
      ),
      groupConversations: state.groupConversations.map((c) =>
        c.id === conversation.id ? { ...c, ...conversation } : c,
      ),
    })),

  recordConversationMessageActivity: (conversationId, content, options) =>
    set((state) => {
      const patch = (c: Conversation) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: content,
              lastActivityAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              unreadCount: options?.incrementUnread
                ? c.unreadCount + 1
                : c.unreadCount,
            }
          : c

      return {
        conversations: state.conversations.map(patch),
        groupConversations: state.groupConversations.map(patch),
      }
    }),
}))

export function findStoredConversation(
  state: Pick<ConversationState, "conversations" | "groupConversations">,
  id?: string,
): Conversation | undefined {
  if (!id) return undefined
  return (
    state.conversations.find((c) => c.id === id) ??
    state.groupConversations.find((c) => c.id === id)
  )
}
