import { useState } from "react"
import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react"

import { getGroupParticipantLabel } from "@/lib/groupParticipant"

import { findStoredConversation, useConversationStore } from "@/store/conversationStore"
import { useMessageComposerStore } from "@/store/messageComposerStore"
import { useMessageStore } from "@/store/messageStore"

import { MessageActionsMenu } from "./MessageActionsMenu"
import { MessageContent } from "./MessageContent"

import type { Message } from "@/types/message"

const HUB_AGENT_LABEL = "Agente"

interface MessageBubbleProps {
  message: Message
  isGroup: boolean
  conversationId: string
  quotedLookup?: Message | null
}

function DeliveryStatusIcon({ status, inverted }: { status?: Message["deliveryStatus"]; inverted?: boolean }) {
  const className = inverted ? "text-blue-200/90" : "text-muted-foreground"
  switch (status) {
    case "pending": return <Clock className={`h-3.5 w-3.5 ${className}`} aria-label="A enviar" />
    case "sent": return <Check className={`h-3.5 w-3.5 ${className}`} aria-label="Enviada" />
    case "delivered": return <CheckCheck className={`h-3.5 w-3.5 ${className}`} aria-label="Entregue" />
    case "failed": return <AlertCircle className="h-3.5 w-3.5 text-red-400" aria-label="Falhou" />
    default: return null
  }
}

function ReactionsRow({ message, inverted }: { message: Message; inverted?: boolean }) {
  const reactions = message.reactions ?? message.hubMeta?.reactions
  if (!reactions?.length) return null
  return (
    <div className={`mt-1 flex flex-wrap gap-1 ${inverted ? "justify-end" : "justify-start"}`}>
      {reactions.map((r, i) => (
        <span key={`${r.emoji}-${r.agent}-${i}`} className={`rounded-full px-1.5 py-0.5 text-xs ${inverted ? "bg-white/20" : "bg-muted"}`} title={r.agent}>
          {r.emoji}
        </span>
      ))}
    </div>
  )
}

function BubbleTime({ createdAt, inverted }: { createdAt: string; inverted?: boolean }) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  const time = date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  return (
    <p
      className={`mt-1 select-none text-right text-[10px] leading-none ${
        inverted ? "text-white/60" : "text-muted-foreground/70"
      }`}
      title={date.toLocaleString("pt-PT")}
    >
      {time}
    </p>
  )
}

function MessageDetailsDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-foreground">Detalhes da mensagem</h3>
        <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
          <div>
            <dt className="font-medium text-muted-foreground">ID</dt>
            <dd className="break-all font-mono">{message.id}</dd>
          </div>
          {message.externalMessageId && (
            <div>
              <dt className="font-medium text-muted-foreground">External ID</dt>
              <dd className="break-all font-mono">{message.externalMessageId}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-muted-foreground">Enviada</dt>
            <dd>{new Date(message.createdAt).toLocaleString("pt-PT")}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Estado</dt>
            <dd>{message.deliveryStatus ?? "—"}</dd>
          </div>
        </dl>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-foreground py-2 text-sm font-medium text-white">
          Fechar
        </button>
      </div>
    </div>
  )
}

export function MessageBubble({ message, isGroup, conversationId, quotedLookup }: MessageBubbleProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const setQuotedMessage = useMessageComposerStore((s) => s.setQuotedMessage)
  const upsertMessage = useMessageStore((s) => s.upsertMessage)
  const conversation = useConversationStore((s) => findStoredConversation(s, conversationId))

  const participantLabel =
    isGroup && message.senderType === "customer" ? getGroupParticipantLabel(message) : undefined

  function handleReact(_emoji: string) {
    // Reactions via hub API not yet wired – silently ignore
    void upsertMessage
    void conversation
  }

  const actions = (
    <MessageActionsMenu
      message={message}
      tone={message.senderType === "agent" || message.senderType === "ai" ? "dark" : "light"}
      onReply={() => setQuotedMessage(message)}
      onReact={(emoji) => handleReact(emoji)}
      onShowDetails={() => setDetailsOpen(true)}
    />
  )

  // Miniatura: prioriza a extraída diretamente da citação (sempre disponível,
  // mesmo que a mensagem original não esteja na nossa BD); em alternativa usa
  // o primeiro anexo de imagem da mensagem original, se for encontrada.
  const quotedThumbUrl =
    message.quotedThumbnailUrl ||
    quotedLookup?.attachments?.find((a) => a.type === "image")?.url

  const quotedSenderLabel =
    quotedLookup?.senderName ||
    (isGroup && quotedLookup ? getGroupParticipantLabel(quotedLookup) : null) ||
    message.quotedSenderNameFallback ||
    (quotedLookup || quotedThumbUrl || message.quotedPreviewText ? "Mensagem" : null)

  const quotedText = quotedLookup
    ? quotedLookup.content.trim().slice(0, 120)
    : message.quotedPreviewText?.trim().slice(0, 120)

  const quotedPreview = quotedLookup || quotedThumbUrl || quotedText ? (
    <div className="mb-2 flex gap-2 rounded border-l-2 border-current/30 pl-2 text-xs opacity-80">
      {quotedThumbUrl && (
        <img
          src={quotedThumbUrl}
          alt="Miniatura da mensagem citada"
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      )}
      <div className="min-w-0">
        {quotedSenderLabel && <p className="font-medium">{quotedSenderLabel}</p>}
        {quotedText && <p className="line-clamp-2">{quotedText}</p>}
      </div>
    </div>
  ) : null

  if (message.senderType === "system") {
    return (
      <div className="group flex justify-center">
        <div className="relative max-w-md rounded-2xl bg-muted px-4 py-2 text-center text-sm text-foreground shadow-sm">
          {actions}
          <MessageContent message={message} />
        </div>
      </div>
    )
  }

  if (message.senderType === "customer") {
    return (
      <>
        <div className="group flex justify-start gap-1">
          <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-card px-4 py-3 text-foreground shadow-sm sm:max-w-md">
            <div className="mb-1 flex items-start justify-between gap-2">
              {participantLabel ? (
                <p className="text-xs font-semibold text-emerald-800">{participantLabel}</p>
              ) : <span />}
              <span className="opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">{actions}</span>
            </div>
            {quotedPreview}
            <MessageContent message={message} />
            <ReactionsRow message={message} />
            <BubbleTime createdAt={message.createdAt} />
          </div>
        </div>
        {detailsOpen && <MessageDetailsDialog message={message} onClose={() => setDetailsOpen(false)} />}
      </>
    )
  }

  if (message.senderType === "ai") {
    return (
      <div className="group flex justify-end gap-1">
        <span className="self-center opacity-0 transition group-hover:opacity-100">{actions}</span>
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-sky-500 px-4 py-3 text-white shadow-sm sm:max-w-md">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-100">IA</p>
          {quotedPreview}
          <MessageContent message={message} inverted />
          <ReactionsRow message={message} inverted />
          <BubbleTime createdAt={message.createdAt} inverted />
        </div>
      </div>
    )
  }

  if (message.senderType === "note" || message.contentType === "note") {
    const label = message.senderName?.trim() || HUB_AGENT_LABEL
    return (
      <div className="group flex justify-center">
        <div className="relative max-w-[90%] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:max-w-md">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Nota interna · {label}
          </p>
          <MessageContent message={message} />
          <BubbleTime createdAt={message.createdAt} />
        </div>
      </div>
    )
  }

  if (message.senderType === "agent") {
    const label = message.senderName?.trim() || HUB_AGENT_LABEL
    const deliveryHint =
      message.deliveryStatus === "failed" ? "Falha no envio" :
      message.deliveryStatus === "pending" ? "A enviar…" :
      message.deliveryStatus === "sent" ? "Enviada" :
      message.deliveryStatus === "delivered" ? "Entregue" : null

    return (
      <>
        <div className="group flex justify-end gap-1">
          <span className="self-center opacity-0 transition group-hover:opacity-100">{actions}</span>
          <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-blue-900 px-4 py-3 text-white shadow-sm sm:max-w-md">
            <p className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
              <span>{label}</span>
              <span className="flex items-center gap-1.5 font-normal normal-case">
                <DeliveryStatusIcon status={message.deliveryStatus} inverted />
                {deliveryHint && (
                  <span className={message.deliveryStatus === "failed" ? "text-red-300" : "text-blue-300/80"}>
                    {deliveryHint}
                  </span>
                )}
              </span>
            </p>
            {quotedPreview}
            <MessageContent message={message} inverted />
            <ReactionsRow message={message} inverted />
            <BubbleTime createdAt={message.createdAt} inverted />
          </div>
        </div>
        {detailsOpen && <MessageDetailsDialog message={message} onClose={() => setDetailsOpen(false)} />}
      </>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-md rounded-2xl bg-card px-4 py-3 shadow-sm">
        <MessageContent message={message} />
      </div>
    </div>
  )
}
