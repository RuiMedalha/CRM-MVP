import { directusRequest } from "./client";

/** Conversa (subset alinhado com o tipo `Conversation` do communication-hub). */
export interface Conversation {
  id: string;
  contactId?: string;
  /** Telefone do contacto (usado para mapear Chatwoot → contacto Directus). */
  contactPhone?: string;
  customerName: string;
  channel: string;
  status: string;
  lastMessage?: string;
  unreadCount: number;
  updatedAt: string;
}

interface DirectusItemResponse<T> {
  data: T;
}

interface DirectusListResponse<T> {
  data: T[];
}

function normalizeChannel(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.key === "string") return o.key.trim();
    if (typeof o.id === "string") return o.id.trim();
  }
  return "";
}

function mapConversationRow(raw: unknown): Conversation {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    contactId: (r.contact_id as string | null | undefined) ?? undefined,
    customerName: String(r.customer_name ?? ""),
    channel: normalizeChannel(r.channel),
    status: String(r.status ?? ""),
    lastMessage: (r.last_message as string | null | undefined) ?? undefined,
    unreadCount: Number(r.unread_count ?? 0),
    updatedAt: String(r.updated_at ?? r.created_at ?? ""),
  };
}

const CONVERSATION_FIELDS = [
  "id",
  "contact_id",
  "customer_name",
  "channel",
  "status",
  "last_message",
  "unread_count",
  "updated_at",
  "created_at",
] as const;

/** Lista de conversas (exclui `deleted`), ordenada por atualização desc. */
export async function getConversations(): Promise<Conversation[]> {
  const params = new URLSearchParams();
  params.set("fields", CONVERSATION_FIELDS.join(","));
  params.set("sort", "-updated_at,id");
  params.set("limit", "500");
  params.set("filter[status][_neq]", "deleted");

  const json = await directusRequest<DirectusListResponse<unknown>>(
    `/items/conversations?${params.toString()}`,
    { cache: "no-store" },
  );

  return (json.data ?? []).map(mapConversationRow);
}

/** Uma conversa por id. */
export async function getConversationById(
  id: string,
): Promise<Conversation | undefined> {
  const trimmed = id.trim();
  if (!trimmed) return undefined;

  const params = new URLSearchParams();
  params.set("fields", CONVERSATION_FIELDS.join(","));

  const json = await directusRequest<DirectusItemResponse<unknown>>(
    `/items/conversations/${encodeURIComponent(trimmed)}?${params.toString()}`,
  );

  if (!json?.data) return undefined;
  return mapConversationRow(json.data);
}
