import { useEffect, useRef, useState } from "react"
import {
  Image as ImageIcon,
  Mic,
  Paperclip,
  Square,
  Video,
  FileText,
  X,
} from "lucide-react"

import { sendAgentMessage, sendAgentMedia } from "@/services/whatsappOutboundMessage"
import { isSiteChatChannel, sendSiteChatReply } from "@/integrations/directus/siteChat"
import { inferMediaTypeFromFile, mediaTypeIconLabel } from "@/lib/fileMedia"

import { findStoredConversation, useConversationStore } from "@/store/conversationStore"
import { useMessageComposerStore } from "@/store/messageComposerStore"
import { useMessageStore } from "@/store/messageStore"
import { useAuth } from "@/contexts/AuthContext"

import { QuotedReplyBar } from "./QuotedReplyBar"
import { MessageTemplatesPopover, BUILT_IN_SNIPPETS } from "./MessageTemplatesPopover"
import { cn } from "@/lib/utils"
const FILE_ACCEPT = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"

function PendingPreviewIcon({ mediaType }: { mediaType: string }) {
  switch (mediaType) {
    case "image": return <ImageIcon className="h-5 w-5 text-primary" />
    case "video": return <Video className="h-5 w-5 text-primary" />
    case "audio": return <Mic className="h-5 w-5 text-primary" />
    default: return <FileText className="h-5 w-5 text-primary" />
  }
}

export function MessageInput() {
  const { user } = useAuth()
  const agentName = user?.first_name ?? user?.email?.split("@")[0] ?? "Agente"

  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingAudio, setPendingAudio] = useState<Blob | null>(null)
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const recordStreamRef = useRef<MediaStream | null>(null)

  const selectedConversationId = useConversationStore((s) => s.selectedConversationId)
  const conversation = useConversationStore((s) =>
    findStoredConversation(s, selectedConversationId),
  )

  const quotedMessage = useMessageComposerStore((s) => s.quotedMessage)
  const clearQuotedMessage = useMessageComposerStore((s) => s.clearQuotedMessage)

  const upsertMessage = useMessageStore((s) => s.upsertMessage)
  const recordConversationMessageActivity = useConversationStore(
    (s) => s.recordConversationMessageActivity,
  )

  const isWhatsApp =
    conversation?.channel === "whatsapp" || conversation?.channel === "whatsapp_group"
  const hasPendingMedia = Boolean(pendingFile || pendingAudio)

  // Slash commands rápidos (/iban, /fatura, /nif, /recuperar, /horario, /envio)
  const [slashIndex, setSlashIndex] = useState(0)

  const SNIPPET_SHORTCUTS = useMemo(
    () => [
      { key: "/iban", name: "IBAN & Transferência", text: BUILT_IN_SNIPPETS[1]?.content || "" },
      { key: "/fatura", name: "Dados de Faturação", text: BUILT_IN_SNIPPETS[2]?.content || "" },
      { key: "/nif", name: "Pedido de NIF", text: BUILT_IN_SNIPPETS[2]?.content || "" },
      { key: "/recuperar", name: "Recuperação de Chamada", text: BUILT_IN_SNIPPETS[0]?.content || "" },
      { key: "/horario", name: "Horário & Morada", text: BUILT_IN_SNIPPETS[3]?.content || "" },
      { key: "/envio", name: "Envio & Tracking", text: BUILT_IN_SNIPPETS[4]?.content || "" },
    ],
    []
  )

  const isSlashMode = text.startsWith("/") && !text.includes("\n") && text.length <= 15
  const matchingSlashCommands = useMemo(() => {
    if (!isSlashMode) return []
    const query = text.toLowerCase()
    return SNIPPET_SHORTCUTS.filter(
      (s) => s.key.startsWith(query) || s.name.toLowerCase().includes(query.slice(1))
    )
  }, [isSlashMode, text, SNIPPET_SHORTCUTS])

  function insertSnippet(content: string) {
    setText(content)
    setSlashIndex(0)
  }

  useEffect(() => {
    if (!pendingAudio) { setPendingAudioUrl(null); return }
    const url = URL.createObjectURL(pendingAudio)
    setPendingAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingAudio])

  useEffect(() => {
    return () => { recordStreamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  function clearPendingMedia() {
    setPendingFile(null)
    setPendingAudio(null)
  }

  async function startRecording() {
    setSendError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStreamRef.current = stream
      recordChunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : ""
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        recordStreamRef.current = null
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" })
        if (blob.size > 0) { setPendingFile(null); setPendingAudio(blob) }
        setIsRecording(false)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Não foi possível aceder ao microfone")
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    } else {
      setIsRecording(false)
    }
  }

  async function handleSend() {
    if (!selectedConversationId || sending || !conversation) return

    const ch = String(conversation.channel || "").toLowerCase()

    // Site chat (askme) — grava sempre no Directus + tenta entregar ao WordPress
    if (isSiteChatChannel(ch)) {
      if (hasPendingMedia) {
        setSendError("O chat do site não suporta envio de ficheiros. Envie apenas texto.")
        return
      }
      const trimmed = text.trim()
      if (!trimmed) return
      setSending(true)
      setSendError(null)
      try {
        // 1. Gravar sempre no Directus (sendAgentMessage skips Evolution para askme)
        const persistResult = await sendAgentMessage(conversation, trimmed, agentName)
        upsertMessage(persistResult.message)
        recordConversationMessageActivity(selectedConversationId, trimmed)

        // 2. Tentar entregar ao WordPress (não bloqueia — mensagem já está gravada)
        const sessionId = conversation.source || ""
        const deliveryResult = await sendSiteChatReply(sessionId, trimmed, agentName)
        if (!deliveryResult.ok) {
          setSendError(`Mensagem gravada, mas falha ao entregar ao chat do site: ${deliveryResult.reason || ""}`)
        }

        setText("")
        clearQuotedMessage()
      } catch (error) {
        setSendError(error instanceof Error ? error.message : "Erro ao enviar mensagem")
      } finally {
        setSending(false)
      }
      return
    }

    // Bloquear envio em canais não suportados (exceto WhatsApp e askme)
    if (!ch.startsWith("whatsapp")) {
      setSendError(`Envio não suportado para canal "${conversation.channel}". Use a funcionalidade nativa do canal.`)
      return
    }

    if (hasPendingMedia) {
      await handleSendMedia()
      return
    }

    const trimmed = text.trim()
    if (!trimmed) return

    setSending(true)
    setSendError(null)

    try {
      const result = await sendAgentMessage(conversation, trimmed, agentName)
      upsertMessage(result.message)
      recordConversationMessageActivity(result.message.conversationId, trimmed)

      if (!result.evolution.ok && !result.evolution.skipped) {
        setSendError(result.evolution.reason ?? "Mensagem gravada; falha ao enviar via Evolution")
      } else {
        setText("")
        clearQuotedMessage()
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Erro ao enviar mensagem")
    } finally {
      setSending(false)
    }
  }

  async function handleSendMedia() {
    if (!conversation || !selectedConversationId || sending) return
    const file = pendingFile ?? (pendingAudio
      ? new File([pendingAudio], `audio-${Date.now()}.webm`, { type: pendingAudio.type || "audio/webm" })
      : null)
    if (!file) return

    setSending(true)
    setSendError(null)

    const mediaType = inferMediaTypeFromFile(file, file.name)
    const caption = text.trim()

    try {
      const result = await sendAgentMedia(conversation, file, file.name, caption || undefined, agentName)
      upsertMessage(result.message)
      recordConversationMessageActivity(result.message.conversationId, caption || file.name)

      if (!result.evolution.ok && !result.evolution.skipped) {
        setSendError(result.evolution.reason ?? "Multimédia gravada; falha ao enviar via Evolution")
      } else {
        setText("")
        clearPendingMedia()
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Erro ao enviar multimédia")
    } finally {
      setSending(false)
    }
  }

  const pendingPreview = pendingFile
    ? { name: pendingFile.name, mediaType: inferMediaTypeFromFile(pendingFile, pendingFile.name) }
    : pendingAudio
      ? { name: "Gravação de áudio.webm", mediaType: "audio" as const }
      : null

  const canSend = !sending && Boolean(hasPendingMedia || text.trim().length > 0)
  const isClosed = conversation?.status === "closed"

  if (isClosed) {
    return (
      <div className="border-t border-border bg-card px-4 py-3">
        <p className="text-center text-sm text-muted-foreground">
          Conversa fechada — reabrir para responder.
        </p>
      </div>
    )
  }

  return (
    <div className="crm-message-input relative z-50 min-w-[240px] border-t border-border bg-card p-4 shrink-0">
      <QuotedReplyBar />

      {sendError ? (
        <p className="mb-2 text-xs text-destructive" role="alert">{sendError}</p>
      ) : null}

      {pendingPreview ? (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
          <PendingPreviewIcon mediaType={pendingPreview.mediaType} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{pendingPreview.name}</p>
            <p className="text-xs text-muted-foreground">
              {mediaTypeIconLabel(pendingPreview.mediaType)}
              {text.trim() ? " · legenda no envio" : ""}
            </p>
            {pendingAudioUrl ? (
              <audio controls src={pendingAudioUrl} className="mt-2 h-8 w-full max-w-xs" />
            ) : null}
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={clearPendingMedia}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
            aria-label="Remover ficheiro"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          if (f) { setPendingAudio(null); setPendingFile(f) }
          e.target.value = ""
        }}
      />

      {/* Flex row com min-w-0 garante que o input do composer não colapsa
          para 32px em master-detail split (1024x600 thread ~296px). Blocker #5
          do F-MOBILE-VALIDATION: o container herdava shrink-0 do pai + flex-1
          no input sem min-w-0, esmagando tudo para 33px. */}
      <div className="relative flex min-w-0 items-end gap-2">
        {/* Menu flutuante de Slash Commands (/iban, /fatura, etc.) */}
        {isSlashMode && matchingSlashCommands.length > 0 && (
          <div className="absolute bottom-full mb-2 left-0 right-0 z-50 rounded-xl border border-border bg-popover/95 p-1.5 shadow-xl backdrop-blur-md max-w-md animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1 flex items-center justify-between">
              <span>Snippets Rápidos (Tab ou Enter)</span>
              <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono">Esc fecha</span>
            </div>
            <div className="space-y-0.5">
              {matchingSlashCommands.map((item, idx) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => insertSnippet(item.text)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition",
                    idx === slashIndex
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-bold text-[11px] rounded bg-muted/60 px-1 py-0.5 text-foreground">{item.key}</span>
                    <span className="font-medium text-xs truncate">{item.name}</span>
                  </div>
                  <span className="text-[10px] opacity-70 truncate max-w-[140px] ml-2">
                    {item.text.slice(0, 30)}…
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Botão de templates (disponível em todos os canais) */}
        <MessageTemplatesPopover
          channel={conversation?.channel}
          onSelect={(content) => setText((prev) => prev ? `${prev} ${content}` : content)}
        />

        {isWhatsApp ? (
          <>
            <button
              type="button"
              disabled={sending || isRecording}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-50"
              title="Anexar ficheiro"
              aria-label="Anexar ficheiro"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={() => { if (isRecording) stopRecording(); else void startRecording() }}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50 ${
                isRecording
                  ? "border-red-200 bg-red-50 text-red-600 animate-pulse dark:border-red-800 dark:bg-red-950/30"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              title={isRecording ? "Parar gravação" : "Gravar áudio"}
              aria-label={isRecording ? "Parar gravação" : "Gravar áudio"}
            >
              {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
            </button>
          </>
        ) : null}

        <input
          type="text"
          value={text}
          disabled={sending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (isSlashMode && matchingSlashCommands.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setSlashIndex((prev) => (prev + 1) % matchingSlashCommands.length)
                return
              }
              if (e.key === "ArrowUp") {
                e.preventDefault()
                setSlashIndex((prev) => (prev - 1 + matchingSlashCommands.length) % matchingSlashCommands.length)
                return
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault()
                insertSnippet(matchingSlashCommands[slashIndex]?.text || "")
                return
              }
              if (e.key === "Escape") {
                setText("")
                return
              }
            }
            if (e.key === "Enter" && !e.shiftKey) void handleSend()
          }}
          placeholder={
            hasPendingMedia
              ? "Legenda opcional…"
              : isWhatsApp
                ? "Responder via WhatsApp (digite / para snippets)…"
                : "Escrever mensagem (digite / para snippets)…"
          }
          aria-label={hasPendingMedia ? "Legenda do anexo" : "Escrever mensagem"} /* S1 BLOCKER a11y */
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />

        <button
          type="button"
          disabled={!canSend}
          onClick={() => void handleSend()}
          className="shrink-0 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "A enviar…" : hasPendingMedia ? "Enviar media" : "Enviar"}
        </button>
      </div>
    </div>
  )
}
