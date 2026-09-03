import { useMemo, useState } from "react"
import {
  Download,
  ExternalLink,
  FileText,
  Image,
  Link2,
  Loader2,
  Mic,
  Phone,
  StickyNote,
  Video,
  X,
} from "lucide-react"

import {
  downloadAttachment,
  getAttachmentDownloadUrl,
  getAttachmentFilename,
  resolveAttachmentMediaUrl,
} from "@/lib/messageAttachment"
import {
  filterVisibleAttachments,
  isMediaPlaceholderContent,
} from "@/lib/messageMetadata"

import type { Message } from "@/types/message"
import type { MessageAttachment, MessageContentType } from "@/types/communication"

const TYPE_LABELS: Record<MessageContentType, string> = {
  text: "Texto",
  image: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  file: "Ficheiro",
  note: "Nota interna",
  internal_note: "Nota interna",
  call_event: "Chamada",
  meeting_link: "Reunião",
}

function TypeIcon({ type }: { type: MessageContentType }) {
  switch (type) {
    case "image": return <Image className="h-4 w-4" />
    case "audio": return <Mic className="h-4 w-4" />
    case "video": return <Video className="h-4 w-4" />
    case "file": return <FileText className="h-4 w-4" />
    case "note":
    case "internal_note": return <StickyNote className="h-4 w-4" />
    case "call_event": return <Phone className="h-4 w-4" />
    case "meeting_link": return <Link2 className="h-4 w-4" />
    default: return null
  }
}

function DownloadMediaButton({
  att, messageId, index, inverted,
}: {
  att: MessageAttachment; messageId: string; index: number; inverted?: boolean
}) {
  const href = getAttachmentDownloadUrl(att, messageId)
  if (!href && att.placeholder) return null

  return (
    <button
      type="button"
      onClick={() => void downloadAttachment(att, messageId, index)}
      disabled={!href}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
        inverted
          ? "bg-white/15 text-white hover:bg-white/25 disabled:opacity-40"
          : "bg-muted text-foreground hover:bg-muted disabled:opacity-40"
      }`}
    >
      <Download className="h-3.5 w-3.5" />
      Guardar
    </button>
  )
}

function AttachmentPlaceholder({ att }: { att: MessageAttachment }) {
  if (att.placeholder) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-current/30 bg-black/5 px-3 py-4 text-xs" aria-busy="true">
        <Loader2 className="h-4 w-4 animate-spin opacity-70" />
        <span>A carregar {att.filename ?? att.type}…</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-current/20 bg-black/5 px-3 py-2 text-xs opacity-80">
      <TypeIcon type={att.type as MessageContentType} />
      <span>{att.filename ?? att.type}</span>
      <span className="ml-auto opacity-60">✓ Enviado</span>
    </div>
  )
}

function ImageAttachment({ att, messageId, index, inverted }: {
  att: MessageAttachment; messageId: string; index: number; inverted?: boolean
}) {
  const [lightbox, setLightbox] = useState(false)
  const src = useMemo(() => resolveAttachmentMediaUrl(att, messageId), [att, messageId])

  if (!src) return <AttachmentPlaceholder att={att} />

  return (
    <>
      <div className="space-y-2">
        <button type="button" onClick={() => setLightbox(true)} className="block overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50">
          <img src={src} alt={att.filename ?? "Imagem"} className="max-w-xs rounded-lg object-cover" />
        </button>
        <DownloadMediaButton att={att} messageId={messageId} index={index} inverted={inverted} />
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Fechar" onClick={() => setLightbox(false)}>
            <X className="h-6 w-6" />
          </button>
          <img src={src} alt={att.filename ?? "Imagem"} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          <button type="button" onClick={() => void downloadAttachment(att, messageId, index)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground">
            <Download className="h-4 w-4" />
            {getAttachmentFilename(att, messageId, index)}
          </button>
        </div>
      )}
    </>
  )
}

function AttachmentView({ att, messageId, index, inverted, forceImage = false }: {
  att: MessageAttachment; messageId: string; index: number; inverted?: boolean; forceImage?: boolean
}) {
  if (att.placeholder) return <AttachmentPlaceholder att={att} />
  const src = resolveAttachmentMediaUrl(att, messageId)
  if (!src) return <AttachmentPlaceholder att={att} />

  const mediaType = forceImage || att.type === "image" ? "image" : att.type

  switch (mediaType) {
    case "image":
      return <ImageAttachment att={att} messageId={messageId} index={index} inverted={inverted} />
    case "audio":
      return (
        <div className="space-y-2">
          <audio controls src={src} className="w-full max-w-sm" preload="metadata"><track kind="captions" /></audio>
          <DownloadMediaButton att={att} messageId={messageId} index={index} inverted={inverted} />
        </div>
      )
    case "video":
      return (
        <div className="space-y-2">
          <video controls src={src} className="max-w-xs rounded-lg" preload="metadata"><track kind="captions" /></video>
          <DownloadMediaButton att={att} messageId={messageId} index={index} inverted={inverted} />
        </div>
      )
    default:
      return (
        <div className="flex flex-wrap items-center gap-2">
          <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-current/20 bg-black/5 px-3 py-2 text-sm underline-offset-2 hover:underline">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="max-w-[12rem] truncate">{att.filename ?? "Ficheiro"}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </a>
          <DownloadMediaButton att={att} messageId={messageId} index={index} inverted={inverted} />
        </div>
      )
  }
}

function QuotedBlock({ message }: { message: Message }) {
  const quotedId = message.quotedMessageId?.trim() || message.hubMeta?.quotedMessageId?.trim()
  if (!quotedId) return null
  const preview = message.hubMeta?.quotedPreview?.trim() ?? ""
  if (!preview || isMediaPlaceholderContent(preview)) {
    return (
      <div className="mb-2 rounded-lg border-l-4 border-current/40 bg-black/5 px-3 py-2 text-xs opacity-90">
        <p className="font-semibold">{message.hubMeta?.quotedSenderName?.trim() || "Citação"}</p>
      </div>
    )
  }
  return (
    <div className="mb-2 rounded-lg border-l-4 border-current/40 bg-black/5 px-3 py-2 text-xs opacity-90">
      <p className="font-semibold">{message.hubMeta?.quotedSenderName?.trim() || "Citação"}</p>
      <p className="truncate">{preview}</p>
    </div>
  )
}

export function MessageContent({ message, inverted = false }: { message: Message; inverted?: boolean }) {
  const type = message.contentType ?? "text"
  const visibleAttachments = filterVisibleAttachments(message.attachments)
  const hasStructuredAttachments = visibleAttachments.length > 0
  const primaryMedia = (() => {
    if (type === "image") return visibleAttachments.find((a) => a.type === "image") ?? visibleAttachments.find((a) => Boolean(resolveAttachmentMediaUrl(a, message.id)))
    if (type === "video") return visibleAttachments.find((a) => a.type === "video")
    if (type === "audio") return visibleAttachments.find((a) => a.type === "audio")
    return undefined
  })()
  const showTextContent = Boolean(message.content?.trim()) && !isMediaPlaceholderContent(message.content)

  if (
    (type === "text" || !message.contentType) &&
    !hasStructuredAttachments &&
    message.senderType !== "note" &&
    type !== "note" &&
    !message.quotedMessageId &&
    !message.hubMeta?.quotedMessageId
  ) {
    return <p className="whitespace-pre-wrap break-words">{message.content}</p>
  }

  if (type === "image" && primaryMedia) {
    return (
      <div className="space-y-2">
        <QuotedBlock message={message} />
        {message.hubMeta?.forwardedFromMessageId ? <p className="text-xs font-medium opacity-75">↪ Reencaminhada</p> : null}
        <ImageAttachment att={primaryMedia} messageId={message.id} index={0} inverted={inverted} />
        {showTextContent && <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <QuotedBlock message={message} />
      {message.hubMeta?.forwardedFromMessageId ? <p className="text-xs font-medium opacity-75">↪ Reencaminhada</p> : null}
      {message.contentType && message.contentType !== "text" && !primaryMedia ? (
        <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
          <TypeIcon type={type} />
          <span>{TYPE_LABELS[type]}</span>
        </div>
      ) : null}
      {showTextContent && <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>}
      {visibleAttachments.map((att, i) => (
        <div key={att.id ?? `${att.type}-${i}`}>
          <AttachmentView att={att} messageId={message.id} index={i} inverted={inverted} forceImage={type === "image"} />
        </div>
      ))}
    </div>
  )
}
