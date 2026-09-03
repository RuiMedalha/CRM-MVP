/**
 * Contact Identification Service — motor central de identificação.
 * Responde: "este número/email pertence a quem?"
 * Todos os canais (Telecof, WhatsApp, Email) devem usar este serviço.
 */

import { directusRequest } from "@/integrations/directus/client";

// ─── Types ────────────────────────────────────────────────────────────────

export interface IdentificationResult {
  kind: "contact" | "lead" | "unknown";
  record: Record<string, unknown> | null;
  matchedBy: "phone" | "mobile_phone" | "whatsapp_number" | "email" | null;
  interactionCount: number;
  openDeals: number;
  lastActivity: string | null;
  alsoLeadId?: number;
}

export interface IdentifyParams {
  phone?: string;
  email?: string;
}

export interface CreateLeadFromChannelParams {
  phone?: string;
  email?: string;
  name?: string;
  source: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Normalize phone to last 9 digits for matching */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-9);
}

/** Check if a normalized phone is valid for search (at least 9 digits) */
function isValidPhone(normalized: string): boolean {
  return normalized.length >= 9;
}

// ─── Main Functions ───────────────────────────────────────────────────────

/**
 * Identify a contact or lead by phone number and/or email.
 * Priority: contact > lead. If found in both, returns contact with alsoLeadId.
 */
export async function identifyByPhoneOrEmail(
  params: IdentifyParams,
): Promise<IdentificationResult> {
  const { phone, email } = params;
  const phoneTail = phone ? normalizePhone(phone) : "";

  // ─── Search contacts first ──────────────────────────────────────────
  if (phoneTail && isValidPhone(phoneTail)) {
    // Search across phone, mobile_phone, whatsapp_number
    const fields = ["phone", "mobile_phone", "whatsapp_number"];
    for (const field of fields) {
      try {
        const res = await directusRequest<{ data: Record<string, unknown>[] }>(
          `/items/contacts?filter[${field}][_ends_with]=${phoneTail}&filter[entity_status][_neq]=archived&limit=1&fields=*`
        );
        if (res.data?.length) {
          const contact = res.data[0];
          const enrichment = await getContactEnrichment(contact.id as number);
          const leadId = await findLeadByPhone(phoneTail);
          return {
            kind: "contact",
            record: contact,
            matchedBy: field as IdentificationResult["matchedBy"],
            ...enrichment,
            ...(leadId ? { alsoLeadId: leadId } : {}),
          };
        }
      } catch { /* continue to next field */ }
    }
  }

  if (email?.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/contacts?filter[email][_eq]=${encodeURIComponent(normalizedEmail)}&filter[entity_status][_neq]=archived&limit=1&fields=*`
      );
      if (res.data?.length) {
        const contact = res.data[0];
        const enrichment = await getContactEnrichment(contact.id as number);
        const leadId = await findLeadByEmail(normalizedEmail);
        return {
          kind: "contact",
          record: contact,
          matchedBy: "email",
          ...enrichment,
          ...(leadId ? { alsoLeadId: leadId } : {}),
        };
      }
    } catch { /* continue */ }
  }

  // ─── Search leads ───────────────────────────────────────────────────
  if (phoneTail && isValidPhone(phoneTail)) {
    for (const field of ["phone", "whatsapp_number", "contact_phone"]) {
      try {
        const res = await directusRequest<{ data: Record<string, unknown>[] }>(
          `/items/leads?filter[${field}][_ends_with]=${phoneTail}&filter[status][_neq]=discarded&limit=1&fields=*`
        );
        if (res.data?.length) {
          return {
            kind: "lead",
            record: res.data[0],
            matchedBy: field === "contact_phone" ? "phone" : field as IdentificationResult["matchedBy"],
            interactionCount: 0,
            openDeals: 0,
            lastActivity: (res.data[0].last_attempt_at as string) || null,
          };
        }
      } catch { /* continue */ }
    }
  }

  if (email?.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    for (const field of ["email", "contact_email"]) {
      try {
        const res = await directusRequest<{ data: Record<string, unknown>[] }>(
          `/items/leads?filter[${field}][_eq]=${encodeURIComponent(normalizedEmail)}&filter[status][_neq]=discarded&limit=1&fields=*`
        );
        if (res.data?.length) {
          return {
            kind: "lead",
            record: res.data[0],
            matchedBy: "email",
            interactionCount: 0,
            openDeals: 0,
            lastActivity: (res.data[0].last_attempt_at as string) || null,
          };
        }
      } catch { /* continue */ }
    }
  }

  // ─── Unknown ────────────────────────────────────────────────────────
  return {
    kind: "unknown",
    record: null,
    matchedBy: null,
    interactionCount: 0,
    openDeals: 0,
    lastActivity: null,
  };
}

/**
 * Create a new lead from an inbound channel event.
 */
export async function createLeadFromChannel(
  params: CreateLeadFromChannelParams,
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {
    status: "new",
    source: params.source,
  };
  if (params.phone) payload.phone = params.phone;
  if (params.email) payload.email = params.email;
  if (params.name) {
    payload.display_name = params.name;
    payload.contact_name = params.name;
  }

  const res = await directusRequest<{ data: Record<string, unknown> }>(
    "/items/leads",
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.data;
}

// ─── Internal helpers ─────────────────────────────────────────────────────

async function getContactEnrichment(contactId: number): Promise<{
  interactionCount: number;
  openDeals: number;
  lastActivity: string | null;
}> {
  try {
    const [interactions, deals] = await Promise.all([
      directusRequest<{ data: { count: { id: string } }[] }>(
        `/items/interactions?filter[contact_id][_eq]=${contactId}&aggregate[count]=id`
      ).catch(() => ({ data: [{ count: { id: "0" } }] })),
      directusRequest<{ data: { count: { id: string } }[] }>(
        `/items/deals?filter[customer_id][_eq]=${contactId}&filter[status][_nin]=ganho,perdido&aggregate[count]=id`
      ).catch(() => ({ data: [{ count: { id: "0" } }] })),
    ]);

    const interactionCount = Number(interactions.data?.[0]?.count?.id || 0);
    const openDeals = Number(deals.data?.[0]?.count?.id || 0);

    // Get last activity date
    let lastActivity: string | null = null;
    try {
      const lastInt = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/interactions?filter[contact_id][_eq]=${contactId}&sort=-date_created&limit=1&fields=date_created`
      );
      lastActivity = (lastInt.data?.[0]?.date_created as string) || null;
    } catch { /* ok */ }

    return { interactionCount, openDeals, lastActivity };
  } catch {
    return { interactionCount: 0, openDeals: 0, lastActivity: null };
  }
}

async function findLeadByPhone(phoneTail: string): Promise<number | undefined> {
  try {
    const res = await directusRequest<{ data: { id: number }[] }>(
      `/items/leads?filter[phone][_ends_with]=${phoneTail}&filter[status][_neq]=discarded&limit=1&fields=id`
    );
    return res.data?.[0]?.id;
  } catch {
    return undefined;
  }
}

async function findLeadByEmail(email: string): Promise<number | undefined> {
  try {
    const res = await directusRequest<{ data: { id: number }[] }>(
      `/items/leads?filter[email][_eq]=${encodeURIComponent(email)}&filter[status][_neq]=discarded&limit=1&fields=id`
    );
    return res.data?.[0]?.id;
  } catch {
    return undefined;
  }
}
