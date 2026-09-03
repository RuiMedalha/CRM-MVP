/**
 * Funções de conversa compatíveis com a arquitectura ChatHub (tipos de @/types/conversation).
 * Coexiste com conversations.ts (legacy CRM).
 */
import { directusRequest } from "./client"
import { mapDirectusConversation } from "@/services/directusConversations"
import { isWhatsAppGroupConversation } from "@/lib/whatsappConversation"
import { parseConversationTagIds } from "@/lib/quickConversationTags"
import { mergeHubMetadataIntoAttachments } from "@/lib/messageMetadata"
import { mapDirectusMessage } from "@/services/directusConversations"

import type { Conversation } from "@/types/conversation"
import type { Message, MessageDeliveryStatus, MessageHubMetadata } from "@/types/message"
import type { MessageAttachment } from "@/types/communication"
import type { DirectusConversationRow, DirectusMessageRow } from "@/types/directus"

/** @deprecated — usar user.id UUID do contexto de auth */
export const HUB_DEFAULT_AGENT = "Rui"

interface DirectusItemResponse<T> { data: T }
interface DirectusListResponse<T> { data: T[] }

function normalizeChannel(raw: unknown): string {
  if (typeof raw === "string") return raw.trim()
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (typeof o.key === "string") return o.key.trim()
    if (typeof o.id === "string") return o.id.trim()
  }
  return ""
}

function normalizeConversationRow(raw: unknown): DirectusConversationRow {
  const r = raw as Record<string, unknown>
  return {
    id: String(r.id ?? ""),
    contact_id: (r.contact_id as string | null | undefined) ?? null,
    channel: normalizeChannel(r.channel),
    status: String(r.status ?? ""),
    mode: (r.mode as string | null | undefined) ?? null,
    source: (r.source as string | null | undefined) ?? null,
    visitor_id: (r.visitor_id as string | null | undefined) ?? null,
    ai_enabled: Boolean(r.ai_enabled),
    assigned_to: (r.assigned_to as string | null | undefined) ?? null,
    customer_name: String(r.customer_name ?? ""),
    last_message: (r.last_message as string | null | undefined) ?? null,
    last_message_content_type:
      (r.last_message_content_type as string | null | undefined) ?? null,
    notes: (r.notes as string | null | undefined) ?? null,
    unread_count: Number(r.unread_count ?? 0),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
    last_activity_at: (r.last_activity_at as string | null | undefined) ?? null,
    tag_ids: r.tag_ids,
    instance_name: (r.instance_name as string | null | undefined) ?? null,
  }
}

function normalizeMessageRow(raw: unknown): DirectusMessageRow {
  const r = raw as Record<string, unknown>
  return {
    id: String(r.id ?? ""),
    conversation_id: String(r.conversation_id ?? ""),
    sender_type: String(r.sender_type ?? ""),
    sender_name: (r.sender_name as string | null | undefined) ?? null,
    content: String(r.content ?? ""),
    content_type: (r.content_type as string | null | undefined) ?? null,
    attachments: r.attachments ?? null,
    delivery_status: (r.delivery_status as string | null | undefined) ?? null,
    external_message_id: (r.external_message_id as string | null | undefined) ?? null,
    message_date: (r.message_date as string | null | undefined) ?? null,
    raw_payload: r.raw_payload ?? null,
    created_at: String(r.created_at ?? ""),
    quoted_message_id: (r.quoted_message_id as string | null | undefined) ?? null,
    quoted_thumbnail_url: (r.quoted_thumbnail_url as string | null | undefined) ?? null,
    quoted_preview_text: (r.quoted_preview_text as string | null | undefined) ?? null,
    quoted_sender_name: (r.quoted_sender_name as string | null | undefined) ?? null,
  }
}

export function isGroupConversation(conv: Conversation): boolean {
  return isWhatsAppGroupConversation(conv)
}

const PAGE_SIZE = 100

export async function getConversations(
  extraFilters?: Record<string, string>,
  offset = 0,
  limit = PAGE_SIZE,
): Promise<Conversation[]> {
  const params = new URLSearchParams()
  params.set("sort", "-last_activity_at,-created_at,id")
  params.set("limit", String(limit))
  params.set("offset", String(offset))
  params.set("filter[status][_neq]", "deleted")
  if (extraFilters) {
    for (const [key, value] of Object.entries(extraFilters)) {
      params.set(key, value)
    }
  }

  const json = await directusRequest<DirectusListResponse<unknown>>(
    `/items/conversations?${params.toString()}`,
    { cache: "no-store" },
  )

  const rows = json.data ?? []
  const conversations = rows.map((raw) => mapDirectusConversation(normalizeConversationRow(raw)))
  return conversations
    .filter((c) => !isGroupConversation(c))
}

export async function getGroupConversations(
  offset = 0,
  limit = PAGE_SIZE,
): Promise<Conversation[]> {
  const params = new URLSearchParams()
  params.set("filter[source][_ends_with]", "@g.us")
  params.set("filter[status][_neq]", "deleted")
  params.set("sort", "-updated_at,-created_at,id")
  params.set("limit", String(limit))
  params.set("offset", String(offset))

  const json = await directusRequest<DirectusListResponse<unknown>>(
    `/items/conversations?${params.toString()}`,
    { cache: "no-store" },
  )

  const rows = json.data ?? []
  return rows.map((raw) => mapDirectusConversation(normalizeConversationRow(raw)))
}

export type DirectusConversationPatch = Partial<{
  customer_name: string
  last_message: string
  ai_enabled: boolean
  assigned_to: string | null
  status: string
  channel: string
  unread_count: number
  contact_id: string
  source: string
  notes: string | null
  tag_ids: string
  mode: string | null
  updated_at: string
}>

export async function updateConversation(
  id: string,
  payload: DirectusConversationPatch,
): Promise<Conversation> {
  const json = await directusRequest<DirectusItemResponse<unknown>>(
    `/items/conversations/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  )
  return mapDirectusConversation(normalizeConversationRow(json.data))
}

/**
 * Phase 2.F3: Marcar conversa como lida POR AGENTE.
 * Usa o campo `read_by` (JSON array) para rastrear quais agentes já leram,
 * sem zerar unread_count global (para que outros agentes ainda vejam como não-lida).
 * Fallback: se read_by não existir no schema, faz unread_count=0 (comportamento anterior).
 */
export async function markConversationAsRead(
  conversationId: string,
  agentId?: string,
): Promise<Conversation> {
  if (!agentId) {
    // Fallback: sem agentId, zera globalmente (comportamento legacy)
    return updateConversation(conversationId, {
      unread_count: 0,
      updated_at: new Date().toISOString(),
    })
  }

  try {
    // Tenta usar read_by (JSON array) — se falhar, fallback para unread_count=0
    const current = await directusRequest<DirectusItemResponse<unknown>>(
      `/items/conversations/${encodeURIComponent(conversationId)}?fields=read_by`,
    )
    const row = current.data as Record<string, unknown>
    const readBy: string[] = Array.isArray(row?.read_by) ? (row.read_by as string[]) : []
    if (!readBy.includes(agentId)) {
      readBy.push(agentId)
    }
    return updateConversation(conversationId, {
      read_by: readBy as any,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // Fallback se read_by não existe no schema
    return updateConversation(conversationId, {
      unread_count: 0,
      updated_at: new Date().toISOString(),
    })
  }
}

export async function assumeConversation(
  id: string,
  assignedTo: string = HUB_DEFAULT_AGENT,
): Promise<Conversation> {
  return updateConversation(id, {
    status: "human_active",
    mode: "human",
    ai_enabled: false,
    assigned_to: assignedTo,
    updated_at: new Date().toISOString(),
  })
}

export async function closeConversation(id: string): Promise<Conversation> {
  return updateConversation(id, {
    status: "closed",
    ai_enabled: false,
    unread_count: 0,
    updated_at: new Date().toISOString(),
  })
}

export async function touchConversationOnNewMessage(
  conversationId: string,
  content: string,
  senderType: string,
): Promise<Conversation> {
  const now = new Date().toISOString()
  const patch: DirectusConversationPatch = { last_message: content, updated_at: now }
  return updateConversation(conversationId, patch)
}

export interface CreateDirectusMessagePayload {
  conversation_id: string
  sender_type: string
  sender_name?: string | null
  content: string
  content_type?: string
  attachments?: MessageAttachment[] | null
  delivery_status?: MessageDeliveryStatus | string
  external_message_id?: string | null
  hub_metadata?: MessageHubMetadata
}

const MESSAGE_FIELDS = [
  "id", "conversation_id", "sender_type", "sender_name",
  "content", "content_type", "attachments", "delivery_status",
  "external_message_id", "message_date", "created_at",
  "quoted_message_id", "quoted_thumbnail_url", "quoted_preview_text", "quoted_sender_name",
] as const

export async function getMessages(conversationId: string, before?: string): Promise<Message[]> {
  const params = new URLSearchParams()
  params.set("filter[conversation_id][_eq]", conversationId)
  if (before) params.set("filter[created_at][_lt]", before)
  params.set("fields", MESSAGE_FIELDS.join(","))
  // Ordenar por mais recente primeiro para garantir que a página buscada é
  // sempre a mais próxima do presente (ou anterior ao cursor "before"),
  // depois inverte-se para a ordem cronológica ascendente que a UI espera.
  params.set("sort", "-created_at")
  params.set("limit", "500")

  const json = await directusRequest<DirectusListResponse<unknown>>(
    `/items/messages?${params.toString()}`,
    { cache: "no-store" },
  )

  const rows = json.data ?? []
  return rows.map((raw) => mapDirectusMessage(normalizeMessageRow(raw))).reverse()
}

export async function fetchMessagesWithFallback(
  conversationId: string,
): Promise<Message[]> {
  try {
    return await getMessages(conversationId)
  } catch {
    return []
  }
}

export async function setConversationNotes(
  id: string,
  notes: string,
): Promise<{ saved: boolean; conversation?: Conversation }> {
  try {
    const conv = await updateConversation(id, { notes, updated_at: new Date().toISOString() })
    return { saved: true, conversation: conv }
  } catch {
    return { saved: false }
  }
}

export async function setConversationTagIds(
  id: string,
  tagIds: string[],
): Promise<Partial<Conversation>> {
  try {
    const conv = await updateConversation(id, {
      tag_ids: JSON.stringify(tagIds),
      updated_at: new Date().toISOString(),
    })
    return conv
  } catch {
    return { tagIds }
  }
}

export async function createMessage(payload: CreateDirectusMessagePayload): Promise<Message> {
  const { hub_metadata, ...rest } = payload
  const attachments = mergeHubMetadataIntoAttachments(
    rest.attachments ?? undefined,
    hub_metadata,
  )

  const json = await directusRequest<DirectusItemResponse<unknown>>(
    "/items/messages",
    {
      method: "POST",
      body: JSON.stringify({ ...rest, attachments: attachments ?? null }),
    },
  )

  return mapDirectusMessage(normalizeMessageRow(json.data))
}

/** Normaliza um número PT para E.164 sem "+" (ex: "912 345 678" → "351912345678") */
export function normalizeWhatsAppNumber(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "")
  const clean = digits.replace(/^00/, "").replace(/^0(?=9\d{8}$)/, "")
  if (!clean) return null
  if (/^351\d{9}$/.test(clean)) return clean
  if (/^9\d{8}$/.test(clean)) return `351${clean}`
  if (/^2\d{8}$/.test(clean)) return `351${clean}`
  if (clean.length >= 10 && clean.length <= 15) return clean // internacional
  return null
}

/** Procura conversa WhatsApp existente para um número e instância. Devolve null se não existir. */
export type WhatsAppInstance = "hotelequip-913" | "hotelequip-916" | "hotelequip-918"

export async function findWhatsAppConversationByNumber(
  e164: string,
  instanceName: WhatsAppInstance,
): Promise<Conversation | null> {
  const params = new URLSearchParams()
  params.set("filter[channel][_eq]", "whatsapp")
  params.set("filter[source][_eq]", `${e164}@s.whatsapp.net`)
  params.set("filter[instance_name][_eq]", instanceName)
  params.set("filter[status][_neq]", "deleted")
  params.set("sort", "-last_activity_at,-created_at")
  params.set("limit", "1")

  const json = await directusRequest<DirectusListResponse<unknown>>(
    `/items/conversations?${params.toString()}`,
    { cache: "no-store" },
  )
  const row = (json.data ?? [])[0]
  if (!row) return null
  return mapDirectusConversation(normalizeConversationRow(row))
}

/** Cria uma conversa WhatsApp outbound (iniciada pelo agente). */
export async function createWhatsAppConversation(input: {
  e164: string
  customerName: string
  instanceName: WhatsAppInstance
}): Promise<Conversation> {
  const now = new Date().toISOString()
  const json = await directusRequest<DirectusItemResponse<unknown>>(
    "/items/conversations",
    {
      method: "POST",
      body: JSON.stringify({
        customer_name: input.customerName || input.e164,
        channel: "whatsapp",
        status: "open",
        mode: "human",
        ai_enabled: false,
        source: `${input.e164}@s.whatsapp.net`,
        instance_name: input.instanceName,
        unread_count: 0,
        created_at: now,
        updated_at: now,
        last_activity_at: now,
      }),
    },
  )
  return mapDirectusConversation(normalizeConversationRow(json.data))
}
