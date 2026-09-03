/**
 * Activity Ledger — tabela única append-only para todas as actividades do CRM.
 *
 * Cada módulo (Telecof, Email, WhatsApp, Customer360) escreve aqui em paralelo
 * (dual-write) via os helpers existentes. A timeline do Customer360 lê daqui.
 *
 * Dedup: source_collection + source_id garante que não há duplicados.
 */

import { directusRequest } from "./client";

export const DIRECTUS_ACTIVITY_COLLECTION =
  import.meta.env.VITE_DIRECTUS_ACTIVITY_COLLECTION || "activity";

export type ActivityType =
  | "call"
  | "email"
  | "whatsapp"
  | "note"
  | "task"
  | "visit"
  | "assistance"
  | "proposal_sent"
  | "follow_up"
  | "contact_created"
  | "deal_created"
  | string;

export type ActivityChannel =
  | "telecof"
  | "wavoip"
  | "3cx"
  | "evolution"
  | "meta"
  | "email"
  | "manual"
  | "crm"
  | "system"
  | string;

export interface ActivityRow {
  id: string;
  date_created?: string | null;
  type?: ActivityType | null;
  channel?: ActivityChannel | null;
  direction?: "in" | "out" | string | null;
  status?: string | null;
  summary?: string | null;
  occurred_at?: string | null;
  contact_id?: string | number | null;
  lead_id?: string | null;
  deal_id?: string | null;
  quotation_id?: string | number | null;
  conversation_id?: string | null;
  source_collection?: string | null;
  source_id?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Cria uma entrada no activity ledger.
 * Fire-and-forget nos callers (.catch(() => {})).
 */
export async function createActivity(
  payload: Partial<Omit<ActivityRow, "id">>,
): Promise<ActivityRow | null> {
  try {
    const body: Record<string, unknown> = {
      type: payload.type || "note",
      channel: payload.channel || "crm",
      direction: payload.direction || null,
      status: payload.status || null,
      summary: payload.summary || null,
      occurred_at: payload.occurred_at || new Date().toISOString(),
      contact_id: payload.contact_id ?? null,
      lead_id: payload.lead_id || null,
      deal_id: payload.deal_id || null,
      quotation_id: payload.quotation_id ?? null,
      conversation_id: payload.conversation_id || null,
      source_collection: payload.source_collection || null,
      source_id: payload.source_id || null,
      payload: payload.payload || null,
    };

    const res = await directusRequest<{ data: ActivityRow }>(
      `/items/${DIRECTUS_ACTIVITY_COLLECTION}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    return res.data ?? null;
  } catch (err) {
    // Activity ledger é best-effort — nunca bloqueia o fluxo principal
    console.warn("[activity-ledger] falhou ao gravar actividade", err);
    return null;
  }
}

/**
 * Lista actividades de um contacto (para timeline unificada).
 */
export async function listActivities(params?: {
  contactId?: string | number;
  limit?: number;
  page?: number;
  type?: string;
}): Promise<ActivityRow[]> {
  const q: Record<string, string> = {
    limit: String(params?.limit ?? 50),
    page: String(params?.page ?? 1),
    sort: "-occurred_at,-date_created",
    fields: "id,type,channel,direction,status,summary,occurred_at,contact_id,deal_id,quotation_id,conversation_id,source_collection,source_id,payload,date_created",
  };

  if (params?.contactId !== undefined) {
    q["filter[contact_id][_eq]"] = String(params.contactId);
  }
  if (params?.type) {
    q["filter[type][_eq]"] = params.type;
  }

  const search = new URLSearchParams(q).toString();

  try {
    const res = await directusRequest<{ data: ActivityRow[] }>(
      `/items/${DIRECTUS_ACTIVITY_COLLECTION}?${search}`,
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}
