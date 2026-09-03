import type { ContactItem } from "@/integrations/directus/contacts";

/** Campos editáveis no Card 360 (keys do frontend / Directus quando iguais). */
export const CONTACT_FORM_FIELDS = [
  "company_name",
  "contact_name",
  "nif",
  "phone",
  "email",
  "whatsapp_number",
  "whatsapp_opt_in",
  "address",
  "postal_code",
  "city",
  "website",
  "contact_person",
  "contact_phone",
  "contact_email",
  "notes",
  "internal_notes",
  "commercial_notes",
  "logistics_notes",
  "tags",
  "quick_notes",
  "sku_history",
  "delivery_addresses",
  "assigned_employee_id",
  "assigned_by_employee_id",
  "assigned_at",
  "accept_newsletter",
  "newsletter_welcome_sent",
  "newsletter_consent_at",
  "newsletter_consent_source",
  "newsletter_consent_user_agent",
  "newsletter_consent_version",
  "newsletter_unsubscribed_at",
  "source",
  "source_call_id",
  "moloni_client_id",
] as const;

export type ContactFormField = (typeof CONTACT_FORM_FIELDS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s =
    typeof value === "object" && value !== null && "id" in value
      ? String((value as { id?: unknown }).id ?? "").trim()
      : String(value).trim();
  if (!s) return false;
  return UUID_RE.test(s);
}

/** Devolve o UUID se válido; caso contrário `undefined` (nunca enviar integer em campo UUID). */
export function normalizeRelationUuid(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const raw =
    typeof value === "object" && value !== null && "id" in value
      ? (value as { id?: unknown }).id
      : value;
  if (raw === null || raw === undefined || raw === "") return undefined;
  const s = String(raw).trim();
  return isUuid(s) ? s : undefined;
}

/**
 * Remove campos de atribuição do PATCH quando o valor não é UUID válido.
 */
export function stripInvalidUuidAssignmentFields(payload: Record<string, unknown>): {
  payload: Record<string, unknown>;
  ignored: string[];
} {
  const out = { ...payload };
  const ignored: string[] = [];

  for (const key of ["assigned_employee_id", "assigned_by_employee_id"] as const) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
    const v = out[key];
    if (v === null || v === "") {
      out[key] = null;
      continue;
    }
    const uuid = normalizeRelationUuid(v);
    if (uuid) {
      out[key] = uuid;
    } else {
      ignored.push(key);
      delete out[key];
    }
  }

  if (Object.prototype.hasOwnProperty.call(out, "assigned_at")) {
    const hasAssignee =
      normalizeRelationUuid(out.assigned_employee_id) !== undefined ||
      isUuid(out.assigned_employee_id);
    if (!hasAssignee) {
      ignored.push("assigned_at");
      delete out.assigned_at;
    }
  }

  return { payload: out, ignored };
}

/** contact_id em interactions vs contacts.id (integer vs uuid). */
export function contactIdMatchesFieldType(contactId: unknown, fieldType?: string): boolean {
  const s = String(contactId ?? "").trim();
  if (!s) return false;
  const t = String(fieldType || "").toLowerCase();
  if (t.includes("uuid")) return isUuid(s);
  if (t.includes("int")) return /^\d+$/.test(s);
  // Sem metadados: id numérico não pode filtrar campo UUID típico em interactions
  if (/^\d+$/.test(s) && !isUuid(s)) return false;
  return isUuid(s) || /^\d+$/.test(s);
}

/** contacts.id em produção é integer; na rota vem como string ("40"). */
export function normalizeContactId(id: string | number | null | undefined): string | number {
  const s = String(id ?? "").trim();
  if (!s) throw new Error("ID de contacto em falta");
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

export function extractRelationId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object" && value !== null && "id" in value) {
    const raw = (value as { id?: unknown }).id;
    if (raw === null || raw === undefined || raw === "") return null;
    return String(raw);
  }
  return String(value);
}

/** Para UI: só expõe relação se o id for UUID (campos M2O UUID no Directus). */
export function extractRelationUuid(value: unknown): string | null {
  return normalizeRelationUuid(value) ?? null;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
      } catch {
        // fall through
      }
    }
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeContactRecord(contact: ContactItem | null): ContactItem | null {
  if (!contact) return null;
  const out: ContactItem = { ...contact };
  if (out.id != null) out.id = normalizeContactId(out.id);
  out.assigned_employee_id = extractRelationUuid(out.assigned_employee_id);
  out.assigned_by_employee_id = extractRelationUuid(out.assigned_by_employee_id);
  out.tags = normalizeTags(out.tags);
  out.quick_notes = normalizeJsonArray(out.quick_notes);
  out.sku_history = normalizeJsonArray(out.sku_history);
  out.delivery_addresses = normalizeJsonArray(out.delivery_addresses);
  return out;
}

export function contactToFormValues(contact: ContactItem | null): Record<string, unknown> {
  const c = contact || {};
  const values: Record<string, unknown> = {};
  for (const key of CONTACT_FORM_FIELDS) {
    if (key === "tags") {
      values[key] = normalizeTags(c.tags);
      continue;
    }
    if (key === "quick_notes" || key === "sku_history" || key === "delivery_addresses") {
      values[key] = normalizeJsonArray(c[key]);
      continue;
    }
    if (key === "assigned_employee_id" || key === "assigned_by_employee_id") {
      values[key] = extractRelationUuid(c[key]) ?? "";
      continue;
    }
    if (key === "accept_newsletter" || key === "whatsapp_opt_in" || key === "newsletter_welcome_sent") {
      values[key] = !!c[key];
      continue;
    }
    const raw = c[key];
    values[key] = raw === null || raw === undefined ? "" : raw;
  }
  return values;
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

/** Devolve apenas campos alterados face ao estado inicial (para PATCH incremental). */
export function diffContactForm(
  current: Record<string, unknown>,
  initial: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of CONTACT_FORM_FIELDS) {
    const cur = current[key];
    const init = initial[key];
    if (stableJson(cur) !== stableJson(init)) {
      patch[key] = cur;
    }
  }
  return patch;
}

export function getDirectusErrorMessage(error: unknown, fallback = "Erro desconhecido"): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}
