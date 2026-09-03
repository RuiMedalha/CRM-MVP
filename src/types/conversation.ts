import type {
  CommunicationChannel,
  ConversationPriority,
  ConversationStatus,
} from "./communication"

export type { CommunicationChannel as ConversationChannel }
export type { ConversationStatus }

export interface Conversation {
  id: string
  contactId?: string
  customerName: string
  customerAvatar?: string
  channel: CommunicationChannel | string
  status: ConversationStatus
  mode?: string
  source?: string
  visitorId?: string
  instanceName?: string
  lastMessage?: string
  lastMessageContentType?: string
  notes?: string
  assignedTo?: string
  aiEnabled: boolean
  unreadCount: number
  tagIds?: string[]
  priority?: ConversationPriority
  createdAt: string
  updatedAt: string
  lastActivityAt?: string
}
