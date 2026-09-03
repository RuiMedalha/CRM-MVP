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

import { useQuery } from "@tanstack/react-query";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Normalize phone to last 9 digits for matching */
export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.slice(-9);
}

/** Check if a normalized phone is valid for search (at least 6 digits) */
export function isValidPhone(normalized: string): boolean {
  return (normalized || "").length >= 6;
}

/**
 * Generate all common formatting variations for a phone number
 * (e.g., +351917226585, 917226585, 917 226 585, +351 917 226 585, 917-226-585)
 */
export function getPhoneSearchVariations(raw: string): string[] {
  if (!raw) return [];
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return [raw.trim()];

  const tail9 = digits.slice(-9);
  const set = new Set<string>();

  set.add(raw.trim());
  set.add(tail9);

  if (tail9.length === 9) {
    const p1 = tail9.slice(0, 3);
    const p2 = tail9.slice(3, 6);
    const p3 = tail9.slice(6, 9);
    // 3-3-3
    set.add(`${p1} ${p2} ${p3}`);
    set.add(`${p1}-${p2}-${p3}`);
    // 3-2-2-2
    set.add(`${p1} ${tail9.slice(3, 5)} ${tail9.slice(5, 7)} ${tail9.slice(7, 9)}`);
    // with country code +351
    set.add(`+351${tail9}`);
    set.add(`+351 ${tail9}`);
    set.add(`+351 ${p1} ${p2} ${p3}`);
    set.add(`(+351) ${p1} ${p2} ${p3}`);
    set.add(`(+351) ${tail9}`);
    set.add(`00351${tail9}`);
    set.add(`00351 ${p1} ${p2} ${p3}`);
  }

  // Fixed lines (21, 22...)
  if (tail9.length === 9 && (tail9.startsWith("21") || tail9.startsWith("22"))) {
    const f1 = tail9.slice(0, 2);
    const f2 = tail9.slice(2, 5);
    const f3 = tail9.slice(5, 9);
    set.add(`${f1} ${f2} ${f3}`);
    set.add(`+351 ${f1} ${f2} ${f3}`);
  }

  return Array.from(set).filter(Boolean);
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
  const variations = phone ? getPhoneSearchVariations(phone) : [];
  const phoneTail = phone ? normalizePhone(phone) : "";

  // ─── Search contacts first ──────────────────────────────────────────
  if (phoneTail && isValidPhone(phoneTail)) {
    const contactFields = ["phone", "mobile_phone", "contact_phone", "whatsapp_number"];

    // 1. Fast match: _ends_with with 9-digit tail on all phone fields
    for (const field of contactFields) {
      try {
        const res = await directusRequest<{ data: Record<string, unknown>[] }>(
          `/items/contacts?filter[${field}][_ends_with]=${encodeURIComponent(phoneTail)}&limit=1&fields=*`
        );
        if (res?.data?.length) {
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
      } catch { /* continue */ }
    }

    // 2. Formatted match: _icontains with phone variations (e.g. "917 226 585", "+351 917 226 585")
    for (const variant of variations) {
      if (variant === phoneTail) continue;
      for (const field of contactFields) {
        try {
          const res = await directusRequest<{ data: Record<string, unknown>[] }>(
            `/items/contacts?filter[${field}][_icontains]=${encodeURIComponent(variant)}&limit=1&fields=*`
          );
          if (res?.data?.length) {
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
        } catch { /* continue */ }
      }
    }
  }

  if (email?.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    for (const field of ["email", "contact_email"]) {
      try {
        const res = await directusRequest<{ data: Record<string, unknown>[] }>(
          `/items/contacts?filter[${field}][_eq]=${encodeURIComponent(normalizedEmail)}&limit=1&fields=*`
        );
        if (res?.data?.length) {
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
  }

  // ─── Search leads ───────────────────────────────────────────────────
  if (phoneTail && isValidPhone(phoneTail)) {
    const leadFields = ["phone", "whatsapp_number", "contact_phone"];

    // 1. Fast match on leads
    for (const field of leadFields) {
      try {
        const res = await directusRequest<{ data: Record<string, unknown>[] }>(
          `/items/leads?filter[${field}][_ends_with]=${encodeURIComponent(phoneTail)}&limit=1&fields=*`
        );
        if (res?.data?.length) {
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

    // 2. Formatted match on leads
    for (const variant of variations) {
      if (variant === phoneTail) continue;
      for (const field of leadFields) {
        try {
          const res = await directusRequest<{ data: Record<string, unknown>[] }>(
            `/items/leads?filter[${field}][_icontains]=${encodeURIComponent(variant)}&limit=1&fields=*`
          );
          if (res?.data?.length) {
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
  }

  if (email?.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    for (const field of ["email", "contact_email"]) {
      try {
        const res = await directusRequest<{ data: Record<string, unknown>[] }>(
          `/items/leads?filter[${field}][_eq]=${encodeURIComponent(normalizedEmail)}&limit=1&fields=*`
        );
        if (res?.data?.length) {
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
 * Hook to quickly resolve the caller's display name from phone number with caching.
 */
export function useContactNameForPhone(phone: string | undefined): { name: string | null; contactId: string | null; loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["contact-name-for-phone", phone],
    queryFn: async () => {
      if (!phone) return null;
      const res = await identifyByPhoneOrEmail({ phone });
      if (res.kind === "contact" && res.record) {
        const name = String(res.record.company_name || res.record.contact_name || res.record.name || "").trim();
        return { name: name || null, contactId: String(res.record.id || "") };
      }
      if (res.kind === "lead" && res.record) {
        const name = String(res.record.display_name || res.record.contact_name || "").trim();
        return { name: name || null, contactId: null };
      }
      return null;
    },
    enabled: Boolean(phone && phone.trim()),
    staleTime: 60000,
  });

  return {
    name: data?.name || null,
    contactId: data?.contactId || null,
    loading: isLoading,
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
