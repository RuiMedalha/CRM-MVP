import type { MessageAttachment, MessageContentType } from "./communication"

export interface MessageReaction {
  emoji: string
  agent: string
  createdAt: string
}

export interface MessageHubMetadata {
  quotedMessageId?: string
  quotedPreview?: string
  quotedSenderName?: string
  reactions?: MessageReaction[]
  forwardedFromMessageId?: string
  forwardedFromConversationId?: string
  participant?: string
  participantJid?: string
  participantName?: string
  pushName?: string
}

export type MessageSenderType =
  | "customer"
  | "agent"
  | "ai"
  | "system"
  | "note"

export type MessageDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped"
  | "internal"

export interface Message {
  id: string
  conversationId: string
  senderType: MessageSenderType
  senderName?: string
  content: string
  contentType?: MessageContentType
  attachments?: MessageAttachment[]
  legacyAttachments?: string[]
  deliveryStatus?: MessageDeliveryStatus
  externalMessageId?: string
  createdAt: string
  rawPayload?: Record<string, unknown>
  hubMeta?: MessageHubMetadata
  quotedMessageId?: string
  quotedThumbnailUrl?: string
  quotedPreviewText?: string
  quotedSenderNameFallback?: string
  reactions?: MessageReaction[]
}
