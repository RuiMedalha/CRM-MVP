import { directusRequest } from "@/integrations/directus/client";
import { getIncomingLeadsCutoffIso, isLeadEligibleForIncomingPopup } from "@/lib/leads-popup";

const DIRECTUS_LEADS_COLLECTION = import.meta.env.VITE_DIRECTUS_LEADS_COLLECTION || "leads";

export type LeadSource =
  | "phone"
  | "central"
  | "whatsapp"
  | "typebot"
  | "chatwoot"
  | "email"
  | "web"
  | string;

export type LeadStatus = "incoming" | "ongoing" | "missed" | "rejected" | "spam" | "discarded" | "processed" | string;

export interface LeadAttempt {
  at: string; // ISO
  source?: LeadSource;
  note?: string;
}

export interface LeadItem {
  id: string;
  // Directus system fields
  date_created?: string | null;
  date_updated?: string | null;
  status?: LeadStatus | null;
  source?: LeadSource | null;
  /** Opcional (ex.: Telecof via n8n) — usado para excluir popup quando type=call */
  type?: string | null;
  /** Opcional — momento do evento; preferido a date_created no popup */
  occurred_at?: string | null;
  /**
   * Optional id to trace the external event that generated this lead
   * (ex: Supabase calls.id, Chatwoot conversation id, etc.).
   */
  source_event_id?: string | null;
  /**
   * Stores the full Card360 data when saving as Lead (same ficha, different “bucket”).
   * This lets you keep one UI while you decide when to convert to `contacts`.
   */
  lead_data?: { occurred_at?: string; type?: string; [key: string]: unknown } | null;
  phone?: string | null;
  email?: string | null;
  display_name?: string | null;
  nif?: string | null;
  dedupe_key?: string | null;
  attempt_count?: number | null;
  attempt_log?: LeadAttempt[] | null;
  first_attempt_at?: string | null;
  last_attempt_at?: string | null;
  contact_id?: string | null;
  notes?: string | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  discarded_at?: string | null;
}

function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-9);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function computeDedupeKey(input: { phone?: string | null; email?: string | null }) {
  const phone = input.phone ? normalizePhone(input.phone) : "";
  if (phone && phone.length >= 6) return `phone:${phone}`;
  const email = input.email ? normalizeEmail(input.email) : "";
  if (email) return `email:${email}`;
  return "";
}

/**
 * Último lead incoming elegível para popup (recente, fonte não migrada para HubChat).
 * Leads antigos em status incoming não são devolvidos.
 */
export async function fetchLatestIncomingLead(): Promise<LeadItem | null> {
  const cutoff = getIncomingLeadsCutoffIso();

  const res = await directusRequest<{ data: LeadItem[] }>(
    `/items/${DIRECTUS_LEADS_COLLECTION}${qs({
      limit: 10,
      sort: "-date_created",
      fields: "*",
      "filter[status][_eq]": "incoming",
      "filter[date_created][_gte]": cutoff,
      "filter[source][_nin]": "central",
    })}`,
  );

  const items = res?.data || [];
  for (const lead of items) {
    if (isLeadEligibleForIncomingPopup(lead)) return lead;
  }
  return null;
}

/**
 * Converte uma Lead num Contacto (Lead → Contacto).
 *
 * Comportamento:
 *  1. Se o lead já tem contact_id, devolve esse ID (idempotente).
 *  2. Caso contrário, cria um Contacto novo (campos do override têm prioridade).
 *  3. Faz PATCH do lead com { status: "processed", contact_id }.
 *  4. (best-effort) PATCH do contacto com { source_lead_id } — campo opcional,
 *     tolerado se o schema não tiver.
 *
 * NÃO cria registos em `interactions` — isso é responsabilidade do caller
 * (ex.: useCustomerDossier.convertLeadToContact que também regista type=conversion).
 *
 * Devolve o contactId final.
 */
export async function convertLeadToContact(
  lead: Pick<LeadItem, "id" | "display_name" | "phone" | "email" | "contact_id" | "notes">,
  overrides?: {
    company_name?: string;
    contact_name?: string;
    nif?: string;
    email?: string;
  },
): Promise<{ contactId: string }> {
  let contactId = lead.contact_id ? String(lead.contact_id) : "";

  if (!contactId) {
    const fallbackName =
      overrides?.company_name || lead.display_name || "Lead Telecof";
    // Import dinâmico para evitar ciclo de imports (contacts.ts já importa leads.ts)
    const { createContact } = await import("./contacts");
    const created = await createContact({
      company_name: fallbackName,
      contact_name: overrides?.contact_name || fallbackName,
      phone: lead.phone || undefined,
      email: overrides?.email || lead.email || undefined,
      nif: overrides?.nif || undefined,
      source: "telecof",
      notes: lead.notes || "Lead promovido a Contacto",
    } as any);
    contactId = String((created as { id?: string | number })?.id ?? "");
    if (!contactId) throw new Error("Falha a criar contacto a partir da lead");
  }

  await patchLead(lead.id, {
    status: "processed",
    contact_id: contactId,
  } as Partial<LeadItem>);

  // Tenta ligar a lead ao contacto (best-effort — campo source_lead_id pode não existir)
  try {
    const { patchContact } = await import("./contacts");
    await patchContact(contactId, {
      // @ts-expect-error: campo opcional não garantido pelo schema
      source_lead_id: lead.id,
    });
  } catch {
    /* silencioso */
  }

  return { contactId };
}

export async function fetchMissedLeads(): Promise<LeadItem[]> {
  const res = await directusRequest<{ data: LeadItem[] }>(
    `/items/${DIRECTUS_LEADS_COLLECTION}${qs({
      limit: 200,
      sort: "-last_attempt_at,-date_created",
      fields: "*",
      "filter[status][_eq]": "missed",
    })}`
  );
  return res?.data || [];
}

export async function fetchRecentLeads(limit = 200): Promise<LeadItem[]> {
  const res = await directusRequest<{ data: LeadItem[] }>(
    `/items/${DIRECTUS_LEADS_COLLECTION}${qs({
      limit,
      sort: "-date_created",
      fields: "id,date_created,status,source,phone,email,display_name,last_attempt_at,attempt_count,attempt_log",
      // ignore discarded/spam by default
      "filter[status][_nin]": "discarded,spam",
    })}`
  );
  return res?.data || [];
}

const VALID_LEAD_KEYS = new Set([
  "id",
  "status",
  "source",
  "source_event_id",
  "lead_data",
  "phone",
  "email",
  "display_name",
  "nif",
  "dedupe_key",
  "attempt_count",
  "attempt_log",
  "first_attempt_at",
  "last_attempt_at",
  "contact_id",
  "notes",
  "claimed_by",
  "claimed_at",
  "discarded_at",
  "score",
  "score_factors",
  "score_computed_at",
  "score_model_version",
]);

export function sanitizeLeadPayload(input: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const extraLeadData: Record<string, unknown> = {
    ...(typeof input.lead_data === "object" && input.lead_data !== null ? (input.lead_data as Record<string, unknown>) : {}),
  };

  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (VALID_LEAD_KEYS.has(k)) {
      if (k !== "lead_data") {
        safe[k] = v;
      }
    } else {
      extraLeadData[k] = v;
    }
  }

  // Dedupe key fallback
  if (!safe.dedupe_key && (safe.phone || safe.email)) {
    const dk = computeDedupeKey({ phone: safe.phone as string, email: safe.email as string });
    if (dk) safe.dedupe_key = dk;
  }

  if (Object.keys(extraLeadData).length > 0) {
    safe.lead_data = extraLeadData;
  }

  return safe;
}

export async function createLead(payload: Partial<LeadItem> & Record<string, unknown>): Promise<LeadItem> {
  const safePayload = sanitizeLeadPayload(payload as Record<string, unknown>);
  const res = await directusRequest<{ data: LeadItem }>(`/items/${DIRECTUS_LEADS_COLLECTION}`, {
    method: "POST",
    body: JSON.stringify(safePayload),
  });
  return res.data;
}

export async function patchLead(id: string, patch: Partial<LeadItem> & Record<string, unknown>): Promise<LeadItem> {
  const safePatch = sanitizeLeadPayload(patch as Record<string, unknown>);
  const res = await directusRequest<{ data: LeadItem }>(`/items/${DIRECTUS_LEADS_COLLECTION}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(safePatch),
  });
  return res.data;
}

export async function deleteLead(id: string): Promise<void> {
  await directusRequest(`/items/${DIRECTUS_LEADS_COLLECTION}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function markLeadMissedWithAggregation(lead: LeadItem): Promise<{ keptId: string }> {
  const now = new Date().toISOString();
  const dedupe_key = lead.dedupe_key || computeDedupeKey({ phone: lead.phone, email: lead.email });

  // If we can't dedupe, just mark missed on the same record
  if (!dedupe_key) {
    await patchLead(lead.id, {
      status: "missed",
      last_attempt_at: now,
      first_attempt_at: lead.first_attempt_at || lead.date_created || now,
      attempt_count: Math.max(lead.attempt_count || 0, 1),
      attempt_log: Array.isArray(lead.attempt_log) && lead.attempt_log.length > 0 ? lead.attempt_log : [{ at: now, source: lead.source || undefined }],
    });
    return { keptId: lead.id };
  }

  // Try to find an existing missed record with same dedupe_key (the “single card” rule)
  const search = await directusRequest<{ data: LeadItem[] }>(
    `/items/${DIRECTUS_LEADS_COLLECTION}${qs({
      limit: 1,
      sort: "-last_attempt_at,-date_created",
      fields: "id,attempt_count,attempt_log,first_attempt_at,date_created",
      "filter[status][_eq]": "missed",
      "filter[dedupe_key][_eq]": dedupe_key,
    })}`
  );
  const existing = search?.data?.[0] || null;

  if (existing && existing.id && existing.id !== lead.id) {
    const prevCount = existing.attempt_count || 1;
    const prevLog = Array.isArray(existing.attempt_log) ? existing.attempt_log : [];
    const nextLog: LeadAttempt[] = [{ at: now, source: lead.source || undefined }, ...prevLog].slice(0, 30);

    await patchLead(existing.id, {
      attempt_count: prevCount + 1,
      attempt_log: nextLog,
      last_attempt_at: now,
      first_attempt_at: existing.first_attempt_at || existing.date_created || now,
    });

    // Remove the duplicate record (optional; matches your “não cria vários cards” requirement)
    await deleteLead(lead.id);

    return { keptId: existing.id };
  }

  // No existing missed lead → mark this one as missed
  const prevLog = Array.isArray(lead.attempt_log) ? lead.attempt_log : [];
  const nextLog: LeadAttempt[] = [{ at: now, source: lead.source || undefined }, ...prevLog].slice(0, 30);

  await patchLead(lead.id, {
    status: "missed",
    dedupe_key,
    attempt_count: Math.max(lead.attempt_count || 0, 1),
    attempt_log: nextLog,
    last_attempt_at: now,
    first_attempt_at: lead.first_attempt_at || lead.date_created || now,
  });

  return { keptId: lead.id };
}

