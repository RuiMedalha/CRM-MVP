import { create } from "zustand"
import type { Message } from "@/types/message"

interface MessageComposerState {
  quotedMessage: Message | null
  setQuotedMessage: (message: Message | null) => void
  clearQuotedMessage: () => void
}

export const useMessageComposerStore = create<MessageComposerState>((set) => ({
  quotedMessage: null,
  setQuotedMessage: (quotedMessage) => set({ quotedMessage }),
  clearQuotedMessage: () => set({ quotedMessage: null }),
}))
