/**
 * Integração Directus para communication_events — compatível com tipos ChatHub.
 * Coexiste com communicationEvents.ts (legacy CRM).
 */
import { directusRequest } from "./client"
import { isOperationallyUnhandled } from "@/lib/telecofQueue"
import { TELECOF_ALL_STATUSES } from "@/types/telecof"

import type {
  TelecofCallEventRecord,
  TelecofOperationalStatus,
} from "@/types/telecof"

interface DirectusItemResponse<T> { data: T }
interface DirectusListResponse<T> { data: T[] }

function pickString(r: Record<string, unknown>, key: string): string | undefined {
  const v = r[key]
  if (v === null || v === undefined || v === "") return undefined
  return String(v)
}

function pickInt(r: Record<string, unknown>, key: string): number | undefined {
  const v = r[key]
  if (v === null || v === undefined || v === "") return undefined
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10)
  return Number.isFinite(n) ? n : undefined
}

export function normalizeCommunicationEventRow(raw: unknown): TelecofCallEventRecord {
  const r = raw as Record<string, unknown>
  const operationalStatus = String(r.status ?? "new") as TelecofOperationalStatus

  return {
    id: String(r.id ?? ""),
    phone: String(r.phone ?? ""),
    normalizedPhone: String(r.normalized_phone ?? r.phone ?? ""),
    direction: pickString(r, "direction") as TelecofCallEventRecord["direction"],
    operationalStatus,
    callStatus: pickString(r, "call_status") as TelecofCallEventRecord["callStatus"],
    startedAt: pickString(r, "started_at"),
    endedAt: pickString(r, "ended_at"),
    durationSeconds:
      r.duration !== undefined && r.duration !== null
        ? Number(r.duration)
        : undefined,
    recordingUrl: pickString(r, "recording_url"),
    agentName: pickString(r, "agent_name"),
    assignedTo: pickString(r, "assigned_to"),
    claimedAt: pickString(r, "claimed_at"),
    resolvedAt: pickString(r, "resolved_at"),
    resolutionNote: pickString(r, "resolution_note"),
    customerName:
      pickString(r, "customer_name") ?? pickString(r, "contact_name"),
    shortMessage:
      pickString(r, "short_message") ??
      pickString(r, "message") ??
      pickString(r, "summary"),
    provider: pickString(r, "provider"),
    contactId: pickString(r, "contact_id"),
    contactIntId: pickInt(r, "contact_int_id"),
    conversationId: pickString(r, "conversation_id"),
    channel: String(r.channel ?? "telecof"),
    eventType: String(r.event_type ?? r.type ?? "call_event"),
    rawPayload:
      typeof r.raw_payload === "object" && r.raw_payload !== null
        ? (r.raw_payload as Record<string, unknown>)
        : undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }
}

export interface CreateCommunicationEventBody {
  phone?: string
  normalized_phone?: string
  direction?: string
  status?: string
  event_type: string
  channel?: string
  provider?: string
  customer_name?: string
  short_message?: string
  started_at?: string
  ended_at?: string
  duration?: number
  recording_url?: string
  agent_name?: string
  assigned_to?: string
  claimed_at?: string
  resolved_at?: string
  resolution_note?: string
  contact_id?: string
  contact_int_id?: number
  conversation_id?: string
  raw_payload?: Record<string, unknown>
}

export type PatchCommunicationEventBody = Partial<{
  status: string
  assigned_to: string | null
  claimed_at: string | null
  resolved_at: string | null
  resolution_note: string | null
  contact_id: string
  contact_int_id: number
  conversation_id: string
  agent_name: string
  customer_name: string
  raw_payload: Record<string, unknown>
}>

export async function createHubCommunicationEvent(
  body: CreateCommunicationEventBody,
): Promise<TelecofCallEventRecord> {
  const json = await directusRequest<DirectusItemResponse<unknown>>(
    "/items/communication_events",
    {
      method: "POST",
      body: JSON.stringify({ status: "new", channel: body.channel ?? "telecof", ...body }),
    },
  )
  const record = normalizeCommunicationEventRow(json.data)

  // Activity Ledger — dual-write (fire-and-forget)
  if (record.id) {
    import("./activities").then(({ createActivity }) =>
      createActivity({
        type: body.event_type || "call",
        channel: body.channel || "telecof",
        direction: body.direction || null,
        status: "new",
        summary: body.short_message || body.customer_name || body.phone || null,
        occurred_at: body.started_at || undefined,
        contact_id: body.contact_int_id ?? null,
        conversation_id: body.conversation_id || null,
        source_collection: "communication_events",
        source_id: record.id,
        payload: body.raw_payload || null,
      }).catch(() => {})
    ).catch(() => {});
  }

  return record
}

export async function patchHubCommunicationEvent(
  id: string,
  body: PatchCommunicationEventBody,
): Promise<TelecofCallEventRecord> {
  const json = await directusRequest<DirectusItemResponse<unknown>>(
    `/items/communication_events/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  )
  return normalizeCommunicationEventRow(json.data)
}

export async function listNewCommunicationEvents(
  limit = 50,
): Promise<TelecofCallEventRecord[]> {
  const search = new URLSearchParams()
  search.set("sort", "-created_at")
  search.set("limit", String(limit))
  search.set("filter[status][_eq]", "new")
  try {
    const json = await directusRequest<DirectusListResponse<unknown>>(
      `/items/communication_events?${search.toString()}`,
    )
    return (json.data ?? []).map(normalizeCommunicationEventRow)
  } catch { return [] }
}

export async function listUnhandledCommunicationEvents(
  limit = 100,
): Promise<TelecofCallEventRecord[]> {
  const search = new URLSearchParams()
  search.set("sort", "-created_at")
  search.set("limit", String(limit))
  search.set("filter[status][_in]", "new,unhandled")
  try {
    const json = await directusRequest<DirectusListResponse<unknown>>(
      `/items/communication_events?${search.toString()}`,
    )
    return (json.data ?? [])
      .map(normalizeCommunicationEventRow)
      .filter(
        (e) => e.operationalStatus === "unhandled" || isOperationallyUnhandled(e),
      )
  } catch { return [] }
}

export async function listTelecofQueueEvents(
  limit = 200,
): Promise<TelecofCallEventRecord[]> {
  const search = new URLSearchParams()
  search.set("sort", "-created_at")
  search.set("limit", String(limit))
  search.set("filter[channel][_in]", "telecof,wavoip")
  search.set("filter[status][_in]", TELECOF_ALL_STATUSES.join(","))
  try {
    const json = await directusRequest<DirectusListResponse<unknown>>(
      `/items/communication_events?${search.toString()}`,
    )
    return (json.data ?? []).map(normalizeCommunicationEventRow)
  } catch { return [] }
}

export async function listCommunicationEvents(params: {
  conversationId?: string
  contactId?: string
  contactIntId?: number
  channel?: string
  limit?: number
}): Promise<TelecofCallEventRecord[]> {
  const search = new URLSearchParams()
  search.set("sort", "-created_at")
  search.set("limit", String(params.limit ?? 20))
  if (params.channel) search.set("filter[channel][_eq]", params.channel)

  if (params.conversationId) {
    search.set("filter[conversation_id][_eq]", params.conversationId)
  } else if (params.contactIntId !== undefined) {
    search.set("filter[contact_int_id][_eq]", String(params.contactIntId))
  } else if (params.contactId) {
    search.set("filter[contact_id][_eq]", params.contactId)
  } else {
    return []
  }

  try {
    const json = await directusRequest<DirectusListResponse<unknown>>(
      `/items/communication_events?${search.toString()}`,
    )
    return (json.data ?? []).map(normalizeCommunicationEventRow)
  } catch { return [] }
}

export async function listUnreadActiveConversations(limit = 80) {
  const params = new URLSearchParams()
  params.set("filter[unread_count][_gt]", "0")
  params.set("filter[status][_in]", "open,ai_active,human_active,handoff,waiting_client")
  params.set("sort", "-updated_at")
  params.set("limit", String(limit))
  params.set("fields", "id,channel,customer_name,unread_count,updated_at")

  try {
    const json = await directusRequest<{ data: unknown[] }>(
      `/items/conversations?${params.toString()}`,
    )
    return (json.data ?? []).map((raw) => {
      const r = raw as Record<string, unknown>
      return {
        id: String(r.id ?? ""),
        channel: String(r.channel ?? ""),
        customerName: String(r.customer_name ?? ""),
        unreadCount: Number(r.unread_count ?? 0),
        updatedAt: String(r.updated_at ?? ""),
      }
    })
  } catch { return [] }
}
