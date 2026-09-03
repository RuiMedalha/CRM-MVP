export type { TelecofCallEventRecord as OperationalCommunicationEvent } from "./telecof"

export interface NotificationToastItem {
  key: string
  kind: "event" | "conversation"
  channel: string
  title: string
  subtitle: string
  createdAt: string
  eventId?: string
  conversationId?: string
}
