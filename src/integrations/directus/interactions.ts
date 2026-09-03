import { directusRequest } from "@/integrations/directus/client";
import { contactIdMatchesFieldType, isUuid, normalizeRelationUuid } from "@/lib/contact-form";
import { qs } from "@/integrations/directus/utils";

export const DIRECTUS_INTERACTIONS_COLLECTION =
  import.meta.env.VITE_DIRECTUS_INTERACTIONS_COLLECTION || "interactions";

type FieldInfo = { field: string; type?: string; schema?: { data_type?: string } };

let cachedFieldType: Record<string, string> | null = null;

async function getFieldTypes(): Promise<Record<string, string> | null> {
  if (cachedFieldType) return cachedFieldType;
  try {
    const res = await directusRequest<{ data: FieldInfo[] }>(
      `/fields/${encodeURIComponent(DIRECTUS_INTERACTIONS_COLLECTION)}`,
    );
    const map: Record<string, string> = {};
    for (const row of res?.data || []) {
      const f = String((row as FieldInfo)?.field || "").trim();
      if (!f) continue;
      const t = String((row as FieldInfo)?.type || (row as FieldInfo)?.schema?.data_type || "")
        .trim()
        .toLowerCase();
      if (t) map[f] = t;
    }
    cachedFieldType = map;
    return map;
  } catch {
    return null;
  }
}

function unwrapRelationId(value: unknown): unknown {
  if (value && typeof value === "object" && "id" in value) {
    return (value as { id?: unknown }).id;
  }
  return value;
}

function normalizeInteractionContactId(value: unknown, fieldType?: string): string | number | null {
  const raw = unwrapRelationId(value);
  if (raw === null || raw === undefined || raw === "") return null;

  const s = String(raw).trim();
  const t = String(fieldType || "").toLowerCase();

  if (t.includes("uuid")) {
    return isUuid(s) ? s : null;
  }
  if (t.includes("int")) {
    return /^\d+$/.test(s) ? Number(s) : null;
  }

  if (isUuid(s)) return s;
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

export type InteractionType = "call" | "email" | "whatsapp" | "note" | string;
export type InteractionDirection = "in" | "out" | string;
export type InteractionStatus = "open" | "done" | "failed" | string;

export interface InteractionRow {
  id: string;
  type?: InteractionType | null;
  direction?: InteractionDirection | null;
  status?: InteractionStatus | null;
  source?: string | null;
  external_id?: string | null;
  occurred_at?: string | null;
  phone?: string | null;
  email?: string | null;
  display_name?: string | null;
  summary?: string | null;
  payload?: any;
  contact_id?: any;
  lead_id?: any;
  date_created?: string | null;
  date_updated?: string | null;
}

export async function listInteractions(params?: {
  contactId?: string;
  email?: string;
  phone?: string;
  limit?: number;
  page?: number;
}): Promise<InteractionRow[]> {
  const types = await getFieldTypes().catch(() => null);
  const contactFieldType = types?.contact_id;

  if (params?.contactId && !contactIdMatchesFieldType(params.contactId, contactFieldType)) {
    console.warn(
      "[interactions] filtro contact_id omitido — id do contacto incompatível com o schema",
      { contactId: params.contactId, fieldType: contactFieldType },
    );
    return [];
  }

  const q: Record<string, unknown> = {
    limit: params?.limit ?? 200,
    page: params?.page ?? 1,
    sort: "-occurred_at,-date_created",
    fields:
      "id,type,direction,status,source,external_id,occurred_at,summary,display_name,phone,email,payload,contact_id.id,lead_id.id,date_created,date_updated",
  };

  if (params?.contactId) {
    const normalized = normalizeInteractionContactId(params.contactId, contactFieldType);
    if (normalized === null) {
      console.warn("[interactions] filtro contact_id omitido — valor normalizado inválido", {
        contactId: params.contactId,
        fieldType: contactFieldType,
      });
      return [];
    }
    q["filter[contact_id][_eq]"] = normalized;
  }

  if (params?.email && params.email.trim()) {
    q["filter[email][_eq]"] = params.email.trim();
  }

  if (params?.phone && params.phone.trim()) {
    q["filter[phone][_eq]"] = params.phone.trim();
  }

  const res = await directusRequest<{ data: InteractionRow[] }>(
    `/items/${DIRECTUS_INTERACTIONS_COLLECTION}${qs(q)}`,
  );
  return res.data || [];
}

export async function createInteraction(payload: Partial<InteractionRow>) {
  const types = await getFieldTypes().catch(() => null);
  const normalized: Record<string, unknown> = { ...(payload || {}) };

  if ("contact_id" in normalized && normalized.contact_id != null && normalized.contact_id !== "") {
    const fieldType = types?.contact_id;
    if (!contactIdMatchesFieldType(normalized.contact_id, fieldType)) {
      console.warn(
        "[interactions] contact_id omitido no POST — id do contacto incompatível com o schema",
        { contactId: normalized.contact_id, fieldType },
      );
      delete normalized.contact_id;
    } else {
      const next = normalizeInteractionContactId(normalized.contact_id, fieldType);
      if (next === null) {
        console.warn("[interactions] contact_id omitido no POST — normalização falhou", {
          contactId: normalized.contact_id,
          fieldType,
        });
        delete normalized.contact_id;
      } else {
        normalized.contact_id = next;
      }
    }
  }

  if ("lead_id" in normalized && normalized.lead_id != null && normalized.lead_id !== "") {
    const fieldType = types?.lead_id;
    const uuid = normalizeRelationUuid(normalized.lead_id);
    if (fieldType?.includes("uuid") && !uuid) {
      console.warn("[interactions] lead_id omitido no POST — valor não é UUID válido", {
        leadId: normalized.lead_id,
      });
      delete normalized.lead_id;
    } else if (uuid) {
      normalized.lead_id = uuid;
    }
  }

  const res = await directusRequest<{ data: InteractionRow }>(
    `/items/${DIRECTUS_INTERACTIONS_COLLECTION}`,
    {
      method: "POST",
      body: JSON.stringify(normalized),
    },
  );

  // Activity Ledger — dual-write (fire-and-forget)
  if (res.data?.id) {
    import("./activities").then(({ createActivity }) =>
      createActivity({
        type: (normalized.type as string) || "note",
        channel: (normalized.source as string) || "crm",
        direction: (normalized.direction as string) || null,
        status: (normalized.status as string) || null,
        summary: (normalized.summary as string) || null,
        occurred_at: (normalized.occurred_at as string) || undefined,
        contact_id: normalized.contact_id as any,
        lead_id: (normalized.lead_id as string) || null,
        source_collection: "interactions",
        source_id: res.data.id,
      }).catch(() => {})
    ).catch(() => {});
  }

  return res.data;
}
