import type { MessageAttachment } from "@/types/communication"
import type { Message, MessageHubMetadata, MessageReaction } from "@/types/message"

export const HUB_META_MARKER = "__hub_meta__"

export type { MessageHubMetadata }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export function parseRawPayload(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw === "string") {
    try {
      return asRecord(JSON.parse(raw))
    } catch {
      return undefined
    }
  }
  return asRecord(raw)
}

function hubMetaFromRecord(record: Record<string, unknown>): MessageHubMetadata {
  const reactionsRaw = record.reactions
  let reactions: MessageReaction[] | undefined

  if (Array.isArray(reactionsRaw)) {
    reactions = reactionsRaw
      .map((item) => {
        const r = asRecord(item)
        if (!r?.emoji) return undefined
        return {
          emoji: String(r.emoji),
          agent: String(r.agent ?? r.agent_name ?? "agent"),
          createdAt: String(r.created_at ?? r.createdAt ?? ""),
        }
      })
      .filter((r): r is MessageReaction => Boolean(r))
  }

  return {
    quotedMessageId: record.quoted_message_id
      ? String(record.quoted_message_id)
      : record.quotedMessageId
        ? String(record.quotedMessageId)
        : undefined,
    quotedPreview: record.quoted_preview
      ? String(record.quoted_preview)
      : record.quotedPreview
        ? String(record.quotedPreview)
        : undefined,
    quotedSenderName: record.quoted_sender_name
      ? String(record.quoted_sender_name)
      : undefined,
    reactions,
    forwardedFromMessageId: record.forwarded_from_message_id
      ? String(record.forwarded_from_message_id)
      : undefined,
    forwardedFromConversationId: record.forwarded_from_conversation_id
      ? String(record.forwarded_from_conversation_id)
      : undefined,
    participant: record.participant ? String(record.participant) : undefined,
    participantJid: record.participantJid
      ? String(record.participantJid)
      : record.participant_jid
        ? String(record.participant_jid)
        : undefined,
    participantName: record.participantName
      ? String(record.participantName)
      : record.participant_name
        ? String(record.participant_name)
        : undefined,
    pushName: record.pushName
      ? String(record.pushName)
      : record.push_name
        ? String(record.push_name)
        : undefined,
  }
}

export function extractHubMetadata(
  attachments?: MessageAttachment[] | null,
  rawPayload?: unknown,
): MessageHubMetadata | undefined {
  const fromRaw = parseRawPayload(rawPayload)
  let meta = fromRaw ? hubMetaFromRecord(fromRaw) : {}

  if (fromRaw?.key && typeof fromRaw.key === "object") {
    const key = fromRaw.key as Record<string, unknown>
    if (key.participant) meta.participantJid = String(key.participant)
  }

  for (const att of attachments ?? []) {
    const record = asRecord(att)
    if (!record) continue
    if (record[HUB_META_MARKER] === true || record.hubMeta) {
      const hub = asRecord(record.hubMeta) ?? record
      meta = { ...meta, ...hubMetaFromRecord(hub) }
    }
  }

  const hasData = Object.values(meta).some(
    (v) => v !== undefined && (!Array.isArray(v) || v.length > 0),
  )

  return hasData ? meta : undefined
}

const CONTENT_TYPE_PREVIEW: Record<string, string> = {
  image: "📷 Imagem",
  audio: "🎵 Áudio",
  video: "🎥 Vídeo",
  file: "📎 Ficheiro",
  document: "📎 Ficheiro",
}

const PLACEHOLDER_PREVIEW: Record<string, string> = {
  "[imagem]": "📷 Imagem",
  "[image]": "📷 Imagem",
  "[áudio]": "🎵 Áudio",
  "[audio]": "🎵 Áudio",
  "[vídeo]": "🎥 Vídeo",
  "[video]": "🎥 Vídeo",
  "[documento]": "📎 Ficheiro",
  "[ficheiro]": "📎 Ficheiro",
  "[file]": "📎 Ficheiro",
  "[mensagem]": "📎 Mensagem",
}

export function contentTypePreviewLabel(contentType?: string | null): string {
  if (!contentType?.trim()) return ""
  return CONTENT_TYPE_PREVIEW[contentType.trim().toLowerCase()] ?? ""
}

export function filterVisibleAttachments(
  attachments?: MessageAttachment[],
): MessageAttachment[] {
  return (attachments ?? []).filter((att) => {
    const a = att as MessageAttachment & {
      __hub_meta__?: boolean
      hubMeta?: unknown
    }
    const record = att as MessageAttachment & Record<string, unknown>
    if (
      a.id === HUB_META_MARKER ||
      a.filename === HUB_META_MARKER ||
      a.__hub_meta__ ||
      record[HUB_META_MARKER] === true ||
      a.hubMeta
    ) {
      return false
    }
    return true
  })
}

export function stripHubMetaAttachments(
  attachments?: MessageAttachment[],
): MessageAttachment[] | undefined {
  const filtered = filterVisibleAttachments(attachments)
  return filtered.length > 0 ? filtered : undefined
}

export function isMediaPlaceholderContent(content?: string | null): boolean {
  const c = content?.trim().toLowerCase() ?? ""
  if (!c) return true
  if (c === HUB_META_MARKER.toLowerCase() || c.startsWith("__hub")) return true
  if (
    c === "[mensagem]" || c === "[imagem]" || c === "[áudio]" ||
    c === "[audio]" || c === "[vídeo]" || c === "[video]" ||
    c === "[documento]" || c === "[ficheiro]"
  ) return true
  if (c.startsWith("citação") || c.startsWith("citacao")) return true
  return Boolean(PLACEHOLDER_PREVIEW[c])
}

export function formatLastMessagePreview(
  lastMessage?: string | null,
  contentType?: string | null,
): string {
  const text = lastMessage?.trim() ?? ""
  const typeLabel = contentTypePreviewLabel(contentType)

  if (!text || text === HUB_META_MARKER || text.startsWith("__hub")) return typeLabel
  if (text === "[mensagem]") return typeLabel || PLACEHOLDER_PREVIEW["[mensagem]"]

  const placeholder = PLACEHOLDER_PREVIEW[text.toLowerCase()]
  if (placeholder) return placeholder

  return lastMessage ?? ""
}

export function mergeHubMetadataIntoAttachments(
  attachments: MessageAttachment[] | undefined,
  meta: MessageHubMetadata | undefined,
): MessageAttachment[] | undefined {
  if (!meta || Object.keys(meta).length === 0) return attachments
  const withoutMeta = stripHubMetaAttachments(attachments) ?? []
  const metaEntry = {
    id: HUB_META_MARKER,
    type: "file" as const,
    filename: HUB_META_MARKER,
    [HUB_META_MARKER]: true,
    hubMeta: meta,
  } as MessageAttachment
  return [...withoutMeta, metaEntry]
}

export function applyMetadataToMessage(message: Message): Message {
  const hubMeta = extractHubMetadata(message.attachments, message.rawPayload)
  if (!hubMeta) return message
  const senderName =
    message.senderName || hubMeta.participantName || hubMeta.pushName || undefined
  return {
    ...message,
    hubMeta,
    senderName,
    attachments: stripHubMetaAttachments(message.attachments),
    quotedMessageId: message.quotedMessageId ?? hubMeta.quotedMessageId,
    reactions: message.reactions ?? hubMeta.reactions,
  }
}
