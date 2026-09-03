export type TelecofCallDirection = "inbound" | "outbound" | string

export type TelecofCallTechnicalStatus =
  | "ringing"
  | "answered"
  | "missed"
  | "busy"
  | "failed"
  | "completed"
  | string

export type TelecofOperationalStatus =
  | "new"
  | "unhandled"
  | "in_progress"
  | "resolved"
  | "treated"
  | "spam"
  | "advertising"
  | "callback"
  | string

export const TELECOF_OPEN_STATUSES: TelecofOperationalStatus[] = [
  "new",
  "unhandled",
  "in_progress",
]

export const TELECOF_ALL_STATUSES: TelecofOperationalStatus[] = [
  "new",
  "unhandled",
  "in_progress",
  "resolved",
  "treated",
  "spam",
  "advertising",
  "callback",
  "deleted",
]

/** @deprecated Use TELECOF_OPEN_STATUSES */
export const TELECOF_QUEUE_STATUSES = TELECOF_OPEN_STATUSES

export interface TelecofCallEventInput {
  phone: string
  direction?: TelecofCallDirection
  status: TelecofCallTechnicalStatus | TelecofOperationalStatus
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  recordingUrl?: string
  agentName?: string
  conversationId?: string
  contactId?: string
  rawPayload?: Record<string, unknown>
}

export interface TelecofCallEventRecord {
  id: string
  phone: string
  normalizedPhone: string
  direction?: TelecofCallDirection
  operationalStatus: TelecofOperationalStatus
  callStatus?: TelecofCallTechnicalStatus
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  recordingUrl?: string
  agentName?: string
  assignedTo?: string
  claimedAt?: string
  resolvedAt?: string
  resolutionNote?: string
  customerName?: string
  shortMessage?: string
  provider?: string
  contactId?: string
  contactIntId?: number
  conversationId?: string
  channel: string
  eventType: string
  rawPayload?: Record<string, unknown>
  createdAt: string
}

export interface TelecofIngestResult {
  event: TelecofCallEventRecord
  contactId: string
  conversationId: string
  contactCreated: boolean
  conversationCreated: boolean
}
