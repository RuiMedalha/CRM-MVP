import { applyMetadataToMessage } from "@/lib/messageMetadata"
import { parseConversationTagIds } from "@/lib/quickConversationTags"

import type {
  Conversation,
  ConversationChannel,
  ConversationStatus,
} from "@/types/conversation"
import type { MessageAttachment, MessageContentType } from "@/types/communication"
import type { DirectusConversationRow, DirectusMessageRow } from "@/types/directus"
import type { Message, MessageSenderType } from "@/types/message"

function parseMessageAttachments(raw: unknown): MessageAttachment[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  if (typeof raw[0] === "string") return undefined

  return raw.map((item, index) => {
    const att = item as Record<string, unknown>
    return {
      id: att.id ? String(att.id) : `att-${index}`,
      type: (att.type as MessageAttachment["type"]) ?? "file",
      url: att.url ? String(att.url) : undefined,
      s3Url: att.s3Url
        ? String(att.s3Url)
        : att.s3_url
          ? String(att.s3_url)
          : undefined,
      mediaUrl: att.mediaUrl
        ? String(att.mediaUrl)
        : att.media_url
          ? String(att.media_url)
          : undefined,
      base64: att.base64 ? String(att.base64) : undefined,
      file: att.file ? String(att.file) : undefined,
      filename: att.filename ? String(att.filename) : undefined,
      mimeType: att.mimeType
        ? String(att.mimeType)
        : att.mime_type
          ? String(att.mime_type)
          : undefined,
      sizeBytes:
        typeof att.sizeBytes === "number"
          ? att.sizeBytes
          : typeof att.size_bytes === "number"
            ? att.size_bytes
            : undefined,
      placeholder: att.placeholder === true,
    }
  })
}

function parseLegacyAttachments(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  if (typeof raw[0] !== "string") return undefined
  return raw as string[]
}

export function mapDirectusConversation(row: DirectusConversationRow): Conversation {
  return {
    id: row.id,
    contactId: row.contact_id ?? undefined,
    customerName: row.customer_name,
    channel: row.channel as ConversationChannel,
    status: row.status as ConversationStatus,
    mode: row.mode ?? undefined,
    source: row.source ?? undefined,
    visitorId: row.visitor_id ?? undefined,
    lastMessage: row.last_message ?? undefined,
    lastMessageContentType: row.last_message_content_type ?? undefined,
    notes: row.notes ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    aiEnabled: row.ai_enabled,
    unreadCount: row.unread_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActivityAt: row.last_activity_at ?? undefined,
    tagIds: parseConversationTagIds(row.tag_ids),
    instanceName: row.instance_name ?? undefined,
  }
}

export function mapDirectusMessage(row: DirectusMessageRow): Message {
  const base: Message = {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type as MessageSenderType,
    senderName: row.sender_name ?? undefined,
    content: row.content,
    contentType: row.content_type ? (row.content_type as MessageContentType) : undefined,
    attachments: parseMessageAttachments(row.attachments),
    legacyAttachments: parseLegacyAttachments(row.attachments),
    deliveryStatus: row.delivery_status
      ? (row.delivery_status as Message["deliveryStatus"])
      : undefined,
    externalMessageId: row.external_message_id ?? undefined,
    rawPayload:
      row.raw_payload && typeof row.raw_payload === "object"
        ? (row.raw_payload as Record<string, unknown>)
        : undefined,
    createdAt: row.message_date || row.created_at || "",
    quotedMessageId: row.quoted_message_id ?? undefined,
    quotedThumbnailUrl: row.quoted_thumbnail_url ?? undefined,
    quotedPreviewText: row.quoted_preview_text ?? undefined,
    quotedSenderNameFallback: row.quoted_sender_name ?? undefined,
  }

  return applyMetadataToMessage(base)
}

export function getConversationsMock(): Conversation[] {
  return []
}

export function getMessagesMock(): Message[] {
  return []
}
