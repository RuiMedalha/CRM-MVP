import { directusRequest } from "./client";

export interface CommunicationEvent {
  id: string;
  channel: string;
  event_type: string;
  phone: string;
  normalized_phone?: string;
  direction: string;
  status: string;
  customer_name?: string;
  contact_id?: string;
  conversation_id?: string;
  started_at?: string;
  duration_seconds?: number;
  agent_name?: string;
  raw_payload?: unknown;
  created_at: string;
}

interface DirectusListResponse<T> {
  data: T[];
}

function str(r: Record<string, unknown>, key: string): string | undefined {
  const v = r[key];
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
}

function normalizeEventRow(raw: unknown): CommunicationEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const duration = r.duration_seconds ?? r.duration;
  return {
    id: String(r.id ?? ""),
    channel: String(r.channel ?? "telecof"),
    event_type: String(r.event_type ?? r.type ?? "call_event"),
    phone: String(r.phone ?? ""),
    normalized_phone: str(r, "normalized_phone") ?? str(r, "phone"),
    direction: String(r.direction ?? "inbound"),
    status: String(r.status ?? "new"),
    customer_name: str(r, "customer_name") ?? str(r, "contact_name"),
    contact_id: str(r, "contact_id"),
    conversation_id: str(r, "conversation_id"),
    started_at: str(r, "started_at"),
    duration_seconds:
      duration === null || duration === undefined || duration === ""
        ? undefined
        : Number(duration),
    agent_name: str(r, "agent_name"),
    raw_payload:
      typeof r.raw_payload === "object" && r.raw_payload !== null
        ? r.raw_payload
        : undefined,
    created_at: String(r.created_at ?? ""),
  };
}

/** Canais de chamada recebida que alimentam o banner global. */
export const INCOMING_CALL_CHANNELS = ["telecof", "3cx", "wavoip"] as const;

/**
 * Chamadas a entrar com status=new (mais recentes) nos canais de voz
 * (telecof, 3cx, wavoip). Nunca rebenta → [].
 */
export async function listNewIncomingCalls(): Promise<CommunicationEvent[]> {
  const params = new URLSearchParams();
  params.set("filter[channel][_in]", INCOMING_CALL_CHANNELS.join(","));
  params.set("filter[status][_eq]", "new");
  params.set("sort", "-created_at");
  params.set("limit", "5");

  try {
    const json = await directusRequest<DirectusListResponse<unknown>>(
      `/items/communication_events?${params.toString()}`,
      { cache: "no-store" },
    );
    return (json.data ?? []).map(normalizeEventRow);
  } catch {
    return [];
  }
}

/**
 * Alias retrocompatível do BLOCO B. Mantido para não partir imports antigos;
 * agora cobre telecof + 3cx + wavoip.
 * @deprecated usar `listNewIncomingCalls`.
 */
export const listNewTelecofEvents = listNewIncomingCalls;

export type CommunicationEventPatch = Partial<{
  status: string;
  assigned_to: string | null;
  agent_name: string;
  contact_id: string;
  conversation_id: string;
}>;

/** PATCH silencioso de um communication_event (não bloqueia a UI). */
export async function patchCommunicationEvent(
  id: string,
  patch: CommunicationEventPatch,
): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;
  try {
    await directusRequest(
      `/items/communication_events/${encodeURIComponent(trimmed)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
  } catch {
    // silencioso
  }
}

export type CreateCommunicationEventBody = {
  channel: string;
  event_type: string;
  phone: string;
  direction?: string;
  status?: string;
  normalized_phone?: string;
  customer_name?: string;
  contact_id?: string;
  conversation_id?: string;
  agent_name?: string;
};

/** Cria um communication_event (fire-and-forget; devolve null em erro). */
export async function createCommunicationEvent(
  body: CreateCommunicationEventBody,
): Promise<CommunicationEvent | null> {
  try {
    const json = await directusRequest<{ data: unknown }>(
      "/items/communication_events",
      { method: "POST", body: JSON.stringify(body) },
    );
    const record = normalizeEventRow(json?.data);

    // Activity Ledger — dual-write (fire-and-forget)
    if (record?.id) {
      import("./activities").then(({ createActivity }) =>
        createActivity({
          type: (body as any).event_type || "call",
          channel: (body as any).channel || "telecof",
          direction: (body as any).direction || null,
          summary: (body as any).short_message || (body as any).phone || null,
          contact_id: (body as any).contact_int_id ?? null,
          source_collection: "communication_events",
          source_id: record.id,
        }).catch(() => {})
      ).catch(() => {});
    }

    return record;
  } catch {
    return null;
  }
}
