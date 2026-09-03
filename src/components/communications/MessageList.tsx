import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"

import { formatMessageDayLabel, messageDayKey } from "@/lib/formatConversationTime"
import { isWhatsAppGroupConversation } from "@/lib/whatsappConversation"

import { findStoredConversation, useConversationStore } from "@/store/conversationStore"
import { useMessageStore } from "@/store/messageStore"
import { getMessages } from "@/integrations/directus/hubConversations"

import { MessageBubble } from "./MessageBubble"

import type { Message } from "@/types/message"

const NEAR_BOTTOM_THRESHOLD_PX = 120
const MESSAGES_PER_PAGE = 500

type TimelineItem =
  | { type: "day"; key: string; label: string }
  | { type: "message"; message: Message }

function buildTimeline(messages: Message[]): TimelineItem[] {
  const items: TimelineItem[] = []
  let lastDay = ""
  for (const message of messages) {
    const day = messageDayKey(message.createdAt)
    if (day !== lastDay) {
      items.push({ type: "day", key: `day-${day}`, label: formatMessageDayLabel(message.createdAt) })
      lastDay = day
    }
    items.push({ type: "message", message })
  }
  return items
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border dark:bg-border" />
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border dark:bg-border" />
    </div>
  )
}

export function MessageList() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const prevConversationIdRef = useRef<string | undefined>(undefined)
  const prevLastMessageIdRef = useRef<string | undefined>(undefined)

  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [historyExhausted, setHistoryExhausted] = useState(false)

  const selectedConversationId = useConversationStore((s) => s.selectedConversationId)
  const conversation = useConversationStore((s) =>
    findStoredConversation(s, selectedConversationId),
  )

  const messages = useMessageStore((s) => s.messages)
  const prependMessages = useMessageStore((s) => s.prependMessages)
  const isGroup = conversation ? isWhatsAppGroupConversation(conversation) : false

  const conversationMessages = useMemo(() => {
    if (!selectedConversationId) return []
    return messages
      .filter((m) => m.conversationId === selectedConversationId)
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [messages, selectedConversationId])

  const messageById = useMemo(() => {
    const map = new Map<string, Message>()
    for (const m of conversationMessages) map.set(m.id, m)
    return map
  }, [conversationMessages])

  const timeline = useMemo(() => {
    if (!selectedConversationId) return []
    return buildTimeline(conversationMessages)
  }, [conversationMessages, selectedConversationId])

  const lastMessageId = conversationMessages[conversationMessages.length - 1]?.id

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" })
  }, [])

  const handleScroll = useCallback(() => {
    if (isNearBottom()) {
      stickToBottomRef.current = true
      setShowJumpToBottom(false)
    } else {
      stickToBottomRef.current = false
    }
  }, [isNearBottom])

  // Reset ao mudar de conversa
  useEffect(() => {
    setHistoryExhausted(false)
  }, [selectedConversationId])

  async function handleLoadOlder() {
    if (!selectedConversationId || loadingOlder || historyExhausted) return
    setLoadingOlder(true)
    try {
      const oldestLoaded = conversationMessages[0]?.createdAt
      if (!oldestLoaded) {
        setHistoryExhausted(true)
        return
      }
      const older = await getMessages(selectedConversationId, oldestLoaded)
      if (older.length === 0) {
        setHistoryExhausted(true)
      } else {
        prependMessages(selectedConversationId, older)
        if (older.length < MESSAGES_PER_PAGE) setHistoryExhausted(true)
      }
    } catch {
      // silencioso
    } finally {
      setLoadingOlder(false)
    }
  }

  useEffect(() => {
    const convChanged = prevConversationIdRef.current !== selectedConversationId
    prevConversationIdRef.current = selectedConversationId

    const messageChanged =
      lastMessageId !== undefined && lastMessageId !== prevLastMessageIdRef.current
    prevLastMessageIdRef.current = lastMessageId

    if (!selectedConversationId) {
      setShowJumpToBottom(false)
      return
    }

    if (convChanged) {
      stickToBottomRef.current = true
      setShowJumpToBottom(false)
      requestAnimationFrame(() => scrollToBottom("auto"))
      return
    }

    if (messageChanged) {
      if (stickToBottomRef.current || isNearBottom()) {
        stickToBottomRef.current = true
        setShowJumpToBottom(false)
        requestAnimationFrame(() => scrollToBottom("smooth"))
      } else {
        setShowJumpToBottom(true)
      }
    }
  }, [selectedConversationId, lastMessageId, scrollToBottom, isNearBottom])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="crm-message-list flex-1 space-y-3 overflow-y-auto bg-muted dark:bg-background p-4"
      >
        {!selectedConversationId && (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            Seleccione uma conversa para ver as mensagens.
          </p>
        )}

        {/* Botão carregar mensagens anteriores */}
        {selectedConversationId && !historyExhausted && (
          <div className="flex justify-center pb-2 pt-1">
            <button
              type="button"
              onClick={() => void handleLoadOlder()}
              disabled={loadingOlder}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition hover:bg-muted disabled:opacity-50"
            >
              {loadingOlder ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
              {loadingOlder ? "A carregar…" : "Carregar mensagens anteriores"}
            </button>
          </div>
        )}
        {selectedConversationId && historyExhausted && (
          <p className="pb-2 pt-1 text-center text-xs text-muted-foreground/60">
            Histórico completo carregado
          </p>
        )}

        {selectedConversationId &&
          timeline.map((item) => {
            if (item.type === "day") {
              return <DaySeparator key={item.key} label={item.label} />
            }

            const message = item.message
            const quotedId = message.quotedMessageId ?? message.hubMeta?.quotedMessageId
            const quotedLookup = quotedId ? messageById.get(quotedId) : null

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isGroup={isGroup}
                conversationId={selectedConversationId}
                quotedLookup={quotedLookup ?? null}
              />
            )
          })}

        <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
      </div>

      {showJumpToBottom && selectedConversationId ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              stickToBottomRef.current = true
              setShowJumpToBottom(false)
              scrollToBottom("smooth")
            }}
            className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md hover:opacity-90"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Ir para última mensagem
          </button>
        </div>
      ) : null}
    </div>
  )
}
