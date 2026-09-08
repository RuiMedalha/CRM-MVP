// Local type fork for the Sprint C Inbox Unificado.
// Avoids touching existing Directus types in `src/types/*`.

import type { Conversation } from "@/types/conversation";
import type { EmailThread } from "@/hooks/useEmailThreads";
import type { TelecofCallEventRecord } from "@/types/telecof";

export type InboxChannelKey = "whatsapp" | "email" | "call";
export type InboxStatusKey = "all" | "unread" | "mine" | "sla_breached";

export interface UnifiedInboxItem {
  id: string;
  channel: InboxChannelKey;
  /** Display title — usually customer name / phone / subject. */
  title: string;
  /** Short preview (last message / summary). */
  subtitle: string;
  /** Best contact string (phone, email, name). */
  contact: string;
  /** ISO date string for last update. */
  date: string;
  urgency: "low" | "normal" | "high" | "critical";
  status: "open" | "assigned" | "closed";
  assignedTo: string | number | null;
  /** ISO date string when SLA expires (or null if none). */
  slaAt: string | null;
  /** True if a conversation is currently waiting for an agent reply. */
  unread: boolean;
  /** True when this item belongs to the current logged-in employee. */
  ownedByCurrentUser: (currentEmployeeId?: string | number | null) => boolean;
  raw: EmailThread | Conversation | TelecofCallEventRecord;
}

export type UnifiedInboxSource =
  | { kind: "email"; thread: EmailThread }
  | { kind: "whatsapp"; conversation: Conversation }
  | { kind: "call"; event: TelecofCallEventRecord };
