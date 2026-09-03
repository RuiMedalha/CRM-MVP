import { X } from "lucide-react"

import { getGroupParticipantLabel } from "@/lib/groupParticipant"
import { useMessageComposerStore } from "@/store/messageComposerStore"
import type { Message } from "@/types/message"

function quoteLabel(message: Message): string {
  return (
    message.hubMeta?.quotedSenderName?.trim() ||
    getGroupParticipantLabel(message) ||
    message.senderName?.trim() ||
    "Mensagem"
  )
}

export function QuotedReplyBar() {
  const quotedMessage = useMessageComposerStore((s) => s.quotedMessage)
  const clearQuotedMessage = useMessageComposerStore((s) => s.clearQuotedMessage)

  if (!quotedMessage) return null

  const preview =
    quotedMessage.hubMeta?.quotedPreview?.trim() ||
    quotedMessage.content.trim().slice(0, 120) ||
    "Media"

  return (
    <div className="mb-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-950 dark:text-blue-100">
      <div className="min-w-0 flex-1 border-l-2 border-blue-500 pl-2">
        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
          A responder · {quoteLabel(quotedMessage)}
        </p>
        <p className="truncate text-xs text-blue-900/90 dark:text-blue-200/80">{preview}</p>
      </div>
      <button
        type="button"
        onClick={clearQuotedMessage}
        className="shrink-0 rounded p-1 text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
        aria-label="Cancelar resposta"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
