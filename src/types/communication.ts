export type CommunicationChannel =
  | "askme"
  | "whatsapp"
  | "whatsapp_group"
  | "telecof"
  | "facebook"
  | "instagram"
  | "telegram"
  | "chatwoot"
  | "reddit"
  | "email"
  | "manual"
  | "phone"

export type CommunicationProvider =
  | "ask_me"
  | "whatsapp_meta"
  | "whatsapp_ycloud"
  | "whatsapp_evolution"
  | "facebook_messenger"
  | "instagram_dm"
  | "telegram_bot"
  | "reddit"
  | "chatwoot"
  | "telecof"
  | "email_smtp"
  | "manual"

export type AgentStatus = "available" | "busy" | "away" | "offline"

export type AgentRole = "admin" | "supervisor" | "agent"

export type ConversationStatus =
  | "open"
  | "ai_active"
  | "handoff"
  | "human_active"
  | "waiting_client"
  | "closed"
  | "archived"

export type MessageContentType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "note"
  | "internal_note"
  | "call_event"
  | "meeting_link"

export interface MessageAttachment {
  id?: string
  type: "image" | "audio" | "video" | "file"
  url?: string
  s3Url?: string
  mediaUrl?: string
  base64?: string
  file?: string
  filename?: string
  mimeType?: string
  mime_type?: string
  sizeBytes?: number
  placeholder?: boolean
}

export type CommunicationEventType =
  | "call_incoming"
  | "call_missed"
  | "call_answered"
  | "message_received"
  | "handoff_requested"

export interface CommunicationEvent {
  id: string
  type: CommunicationEventType
  channel: CommunicationChannel
  conversationId?: string
  contactId?: string
  phoneNumber?: string
  createdAt: string
  payload?: Record<string, unknown>
}

export interface ProviderAccount {
  id: string
  provider: CommunicationProvider
  name: string
  enabled: boolean
  externalAccountId?: string
}

export interface ChannelSettings {
  id: string
  key: CommunicationChannel
  name: string
  provider: CommunicationProvider
  enabled: boolean
  color: string
  icon: string
  logoUrl?: string
  badgeLabel?: string
  autoTags: string[]
  priority: number
  notify: boolean
  inboxVisible: boolean
  sortOrder: number
}

export interface ConversationTag {
  id: string
  name: string
  color: string
  icon: string
  description?: string
  enabled: boolean
}

export interface ConversationTagLink {
  id: string
  conversationId: string
  tagId: string
}

export interface HubAgent {
  id: string
  name: string
  status: AgentStatus
  role: AgentRole
  notificationsEnabled: boolean
  autoAssignEnabled: boolean
  email?: string
}

export type ConversationPriority = "low" | "normal" | "high" | "urgent"

export type InboxStatusFilter =
  | "all_open"
  | "mine"
  | "unassigned"
  | "closed"
  | "ai_active"
  | "human"

export type TelecofQueueFilter =
  | "open"
  | "unhandled"
  | "in_progress"
  | "resolved"
  | "spam"
  | "deleted"
  | "all"
