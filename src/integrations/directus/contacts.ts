import { directusRequest, DIRECTUS_ADMIN_TOKEN } from "@/integrations/directus/client";
import {
  extractRelationUuid,
  normalizeContactId,
  stripInvalidUuidAssignmentFields,
} from "@/lib/contact-form";

/**
 * Contacts access layer for Directus.
 *
 * Goals:
 * - Keep existing frontend keys (company_name, nif, phone, etc.)
 * - Avoid “Payload Invalid” by:
 *   - optional env field-map
 *   - filtering payload to existing Directus fields (schema discovery)
 */

type FieldMap = Record<string, string>;

export interface ContactItem {
  id: string;
  // Common fields (may vary by field map)
  company_name?: string | null;
  contact_name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  full_name?: string | null;
  nif?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp_number?: string | null;
  whatsapp_opt_in?: boolean | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  website?: string | null;
  date_created?: string | null;
  tags?: unknown;
  quick_notes?: unknown;
  sku_history?: unknown;
  notes?: string | null;
  internal_notes?: string | null;
  source?: string | null;
  source_call_id?: string | null;
  moloni_client_id?: string | null;
  accept_newsletter?: boolean | null;
  newsletter_welcome_sent?: boolean | null;
  newsletter_consent_at?: string | null;
  newsletter_consent_source?: string | null;
  newsletter_consent_user_agent?: string | null;
  newsletter_consent_version?: string | null;
  newsletter_unsubscribed_at?: string | null;
  coupon_code?: string | null;
  coupon_used?: boolean | null;
  coupon_wc_id?: number | null;
  coupon_expires_at?: string | null;
  mautic_contact_id?: number | null;
  chatwoot_contact_id?: number | null;
  newsletter_source?: string | null;
  subscribed_at?: string | null;
  status?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  newsletter_notes?: string | null;
  delivery_addresses?: unknown;
  logistics_notes?: string | null;
  commercial_notes?: string | null;

  // assignments
  assigned_employee_id?: any;
  assigned_by_employee_id?: any;
  assigned_at?: string | null;

  // Allow future fields without breaking types
  [k: string]: unknown;
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const DIRECTUS_CONTACTS_COLLECTION =
  import.meta.env.VITE_DIRECTUS_CONTACTS_COLLECTION || "contacts";

export const DIRECTUS_CONTACT_FIELD_MAP: FieldMap = safeJsonParse<FieldMap>(
  import.meta.env.VITE_DIRECTUS_CONTACT_FIELD_MAP,
  {
    phone: "phone",
    whatsapp_number: "whatsapp_number",
    contact_phone: "contact_phone",
    email: "email",
    name: "contact_name",
    company_name: "company_name",
    nif: "nif",
    address: "address",
    postal_code: "postal_code",
    city: "city",
  }
);

/** Campos editáveis no Card 360 (keys do frontend). */
export const CONTACT_EDITABLE_FIELDS = [
  "company_name",
  "contact_name",
  "nif",
  "phone",
  "email",
  "whatsapp_number",
  "contact_person",
  "contact_phone",
  "contact_email",
  "address",
  "postal_code",
  "city",
  "website",
  "tags",
  "quick_notes",
  "notes",
  "internal_notes",
  "delivery_addresses",
  "logistics_notes",
  "commercial_notes",
  "sku_history",
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
] as const;

export {
  normalizeContactId,
  extractRelationId,
  isUuid,
  normalizeRelationUuid,
} from "@/lib/contact-form";

export function directusKeyForContactField(frontendKey: string): string {
  return DIRECTUS_CONTACT_FIELD_MAP[frontendKey] || frontendKey;
}

export function listUnsupportedContactFields(
  patch: Record<string, unknown>,
  allowed: Set<string>,
): string[] {
  return Object.keys(patch).filter((k) => !allowed.has(directusKeyForContactField(k)));
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

function invertMap(map: FieldMap) {
  return Object.entries(map).reduce<Record<string, string>>((acc, [frontendKey, directusKey]) => {
    acc[directusKey] = frontendKey;
    return acc;
  }, {});
}

export function mapToDirectusPayload(frontendPatch: Record<string, unknown>, allowedFields?: Set<string>) {
  const payload: Record<string, unknown> = {};
  Object.entries(frontendPatch || {}).forEach(([k, v]) => {
    const directusKey = DIRECTUS_CONTACT_FIELD_MAP[k] || k;
    if (allowedFields && !allowedFields.has(directusKey)) return;
    payload[directusKey] = v;
  });
  return payload;
}

export function mapFromDirectusItem(item: any): ContactItem | null {
  if (!item) return null;
  const inverse = invertMap(DIRECTUS_CONTACT_FIELD_MAP);
  const out: any = { ...item };
  Object.keys(inverse).forEach((directusKey) => {
    if (directusKey in out) {
      const feKey = inverse[directusKey];
      out[feKey] = out[directusKey];
      if (feKey !== directusKey) delete out[directusKey];
    }
  });
  return out as ContactItem;
}

let fieldsCache: Record<string, { at: number; fields: Set<string> }> = {};
const FIELDS_CACHE_TTL_MS = 60_000;

const DEFAULT_CONTACT_FIELDS = new Set<string>([
  "id",
  "date_created",
  "company_name",
  "contact_name",
  "firstname",
  "lastname",
  "full_name",
  "nif",
  "phone",
  "email",
  "whatsapp_number",
  "whatsapp_opt_in",
  "address",
  "postal_code",
  "city",
  "website",
  "accept_newsletter",
  "newsletter_welcome_sent",
  "newsletter_consent_at",
  "newsletter_consent_source",
  "newsletter_consent_user_agent",
  "newsletter_consent_version",
  "newsletter_unsubscribed_at",
  "coupon_code",
  "coupon_used",
  "coupon_wc_id",
  "coupon_expires_at",
  "mautic_contact_id",
  "chatwoot_contact_id",
  "newsletter_source",
  "subscribed_at",
  "status",
  "created_at",
  "last_seen_at",
  "newsletter_notes",
  "tags",
  "quick_notes",
  "sku_history",
  "contact_person",
  "contact_phone",
  "contact_email",
  "internal_notes",
  "notes",
  "delivery_addresses",
  "logistics_notes",
  "commercial_notes",
  "assigned_employee_id",
  "assigned_by_employee_id",
  "assigned_at",
  "moloni_client_id",
  "source",
  "source_call_id",
]);

export async function getCollectionFields(collection = DIRECTUS_CONTACTS_COLLECTION): Promise<Set<string>> {
  const key = collection;
  const now = Date.now();
  const cached = fieldsCache[key];
  if (cached && now - cached.at < FIELDS_CACHE_TTL_MS) return cached.fields;

  try {
    // Directus endpoint: GET /fields/{collection}
    const res = await directusRequest<{ data: Array<{ field: string }> }>(`/fields/${encodeURIComponent(collection)}`);
    const set = new Set<string>((res?.data || []).map((f) => f.field).filter(Boolean));
    fieldsCache[key] = { at: now, fields: set };
    return set;
  } catch {
    // Fallback: still allow saving the known CRM fields (works even if /fields is restricted).
    fieldsCache[key] = { at: now, fields: DEFAULT_CONTACT_FIELDS };
    return DEFAULT_CONTACT_FIELDS;
  }
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function directusFieldListForContacts(): string {
  /**
   * IMPORTANT:
   * For collections where Directus field keys differ from frontend keys (ex: telefone vs phone),
   * requesting unknown fields can trigger 403. So here we only request:
   * - id
   * - mapped Directus field keys (values of VITE_DIRECTUS_CONTACT_FIELD_MAP)
   */
  const mapped = Object.values(DIRECTUS_CONTACT_FIELD_MAP || {}).filter(Boolean);
  // If no mapping is provided, request a safe set of known CRM fields.
  const base = mapped.length ? mapped : Array.from(DEFAULT_CONTACT_FIELDS);
  const fields = unique(["id", "date_created", ...base]).filter(Boolean);
  return fields.join(",") || "id";
}

export async function getContactById(id: string | number): Promise<ContactItem | null> {
  const normalizedId = normalizeContactId(id);
  const res = await directusRequest<{ data: ContactItem }>(
    `/items/${DIRECTUS_CONTACTS_COLLECTION}/${encodeURIComponent(String(normalizedId))}${qs({ fields: "*" })}`,
  );
  const mapped = mapFromDirectusItem(res?.data);
  if (!mapped?.id) return null;

  mapped.id = String(mapped.id);
  mapped.assigned_employee_id = extractRelationUuid(mapped.assigned_employee_id);
  mapped.assigned_by_employee_id = extractRelationUuid(mapped.assigned_by_employee_id);
  return mapped;
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-9);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findDuplicateContact(input: {
  nif?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<ContactItem | null> {
  const cleanNif = (input.nif || "").trim();
  const cleanPhone = (input.phone || "").trim();
  const cleanEmail = (input.email || "").trim();

  // Prefer NIF (more reliable)
  if (cleanNif && cleanNif.length >= 9) {
    const nifKey = DIRECTUS_CONTACT_FIELD_MAP.nif || "nif";
    const res = await directusRequest<{ data: ContactItem[] }>(
      `/items/${DIRECTUS_CONTACTS_COLLECTION}${qs({
        limit: 1,
        fields: "*",
        [`filter[${nifKey}][_eq]`]: cleanNif,
      })}`
    );
    const item = res?.data?.[0];
    return item ? mapFromDirectusItem(item) : null;
  }

  // Then phone across keys
  if (cleanPhone && cleanPhone.length >= 6) {
    const phoneKey = DIRECTUS_CONTACT_FIELD_MAP.phone || "phone";
    const waKey = DIRECTUS_CONTACT_FIELD_MAP.whatsapp_number || "whatsapp_number";
    const contactPhoneKey = DIRECTUS_CONTACT_FIELD_MAP.contact_phone || "contact_phone";
    const normalized = normalizePhone(cleanPhone);
    const filter = JSON.stringify({
      _or: [
        { [phoneKey]: { _ends_with: normalized } },
        { [waKey]: { _ends_with: normalized } },
        { [contactPhoneKey]: { _ends_with: normalized } },
      ],
    });
    const rawRes = await fetch(
      `https://api.hotelequip.pt/items/${DIRECTUS_CONTACTS_COLLECTION}?filter=${encodeURIComponent(filter)}&limit=1&fields=*`,
      { headers: { Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}` } },
    );
    const res = await rawRes.json() as { data: ContactItem[] };
    const item = res?.data?.[0];
    return item ? mapFromDirectusItem(item) : null;
  }

  // Then email
  if (cleanEmail) {
    const emailKey = DIRECTUS_CONTACT_FIELD_MAP.email || "email";
    const res = await directusRequest<{ data: ContactItem[] }>(
      `/items/${DIRECTUS_CONTACTS_COLLECTION}${qs({
        limit: 1,
        fields: "*",
        [`filter[${emailKey}][_eq]`]: normalizeEmail(cleanEmail),
      })}`
    );
    const item = res?.data?.[0];
    return item ? mapFromDirectusItem(item) : null;
  }

  return null;
}

function compactPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(patch || {}).forEach(([k, v]) => {
    if (v === undefined) {
      return;
    }
    out[k] = v;
  });
  return out;
}

export async function patchContact(
  id: string | number,
  patch: Record<string, unknown>,
): Promise<ContactItem> {
  const normalizedId = normalizeContactId(id);
  const clean = compactPatch(patch);
  if (!Object.keys(clean).length) {
    throw new Error("Nenhum campo para gravar.");
  }

  const allowed = await getCollectionFields(DIRECTUS_CONTACTS_COLLECTION);
  const unsupported = listUnsupportedContactFields(clean, allowed);
  const payload = mapToDirectusPayload(clean, allowed);

  if (!Object.keys(payload).length) {
    const hint =
      unsupported.length > 0
        ? ` Campos não existem no Directus: ${unsupported.join(", ")}.`
        : "";
    throw new Error(
      `Nenhum campo válido para gravar no contacto.${hint} Verifique permissões ou VITE_DIRECTUS_CONTACT_FIELD_MAP.`,
    );
  }

  if (unsupported.length > 0) {
    console.warn("[contacts] campos ignorados no PATCH:", unsupported);
  }

  const { payload: safePayload, ignored: ignoredUuid } = stripInvalidUuidAssignmentFields(payload);
  if (ignoredUuid.length > 0) {
    console.warn(
      "[contacts] campos de atribuição omitidos (valor não é UUID válido):",
      ignoredUuid,
    );
  }

  if (!Object.keys(safePayload).length) {
    throw new Error(
      "Nenhum campo válido para gravar no contacto após validação. Verifique permissões ou valores de atribuição.",
    );
  }

  const res = await directusRequest<{ data: ContactItem }>(
    `/items/${DIRECTUS_CONTACTS_COLLECTION}/${encodeURIComponent(String(normalizedId))}`,
    {
      method: "PATCH",
      body: JSON.stringify(safePayload),
    },
  );
  const mapped = mapFromDirectusItem(res?.data);
  if (!mapped) {
    throw new Error("Resposta inválida do Directus ao atualizar contacto.");
  }
  mapped.id = String(mapped.id);
  mapped.assigned_employee_id = extractRelationUuid(mapped.assigned_employee_id);
  mapped.assigned_by_employee_id = extractRelationUuid(mapped.assigned_by_employee_id);
  return mapped;
}

export async function createContact(payload: Record<string, unknown>): Promise<ContactItem> {
  const allowed = await getCollectionFields(DIRECTUS_CONTACTS_COLLECTION);
  let directusPayload = mapToDirectusPayload(payload, allowed);
  const { payload: safePayload, ignored: ignoredUuid } = stripInvalidUuidAssignmentFields(directusPayload);
  if (ignoredUuid.length > 0) {
    console.warn(
      "[contacts] campos de atribuição omitidos no POST (valor não é UUID válido):",
      ignoredUuid,
    );
  }
  directusPayload = safePayload;
  const res = await directusRequest<{ data: ContactItem }>(`/items/${DIRECTUS_CONTACTS_COLLECTION}`, {
    method: "POST",
    body: JSON.stringify(directusPayload),
  });
  return mapFromDirectusItem(res?.data)!;
}

export async function deleteContact(id: string | number): Promise<void> {
  const normalizedId = normalizeContactId(id);
  await directusRequest(
    `/items/${DIRECTUS_CONTACTS_COLLECTION}/${encodeURIComponent(String(normalizedId))}`,
    { method: "DELETE" },
  );
}

/** Campos do schema Directus que o Card 360 usa (notas/tags). */
export async function getContactSchemaHints(): Promise<{
  allowed: Set<string>;
  missingNotesOrTags: string[];
}> {
  const allowed = await getCollectionFields(DIRECTUS_CONTACTS_COLLECTION);
  const optional = ["tags", "notes", "internal_notes", "commercial_notes", "logistics_notes"];
  const missingNotesOrTags = optional.filter(
    (f) => !allowed.has(directusKeyForContactField(f)),
  );
  return { allowed, missingNotesOrTags };
}

export async function listContacts(params?: {
  search?: string;
  limit?: number;
  page?: number;
  entityStatus?: string;
}): Promise<ContactItem[]> {
  const limit = params?.limit ?? 200;
  const page = params?.page ?? 1;
  const search = (params?.search || "").trim();
  const entityStatus = params?.entityStatus;

  const nameKey = DIRECTUS_CONTACT_FIELD_MAP.company_name || "company_name";
  const nifKey = DIRECTUS_CONTACT_FIELD_MAP.nif || "nif";
  const phoneKey = DIRECTUS_CONTACT_FIELD_MAP.phone || "phone";
  const emailKey = DIRECTUS_CONTACT_FIELD_MAP.email || "email";

  const q: Record<string, string | number | undefined | null> = {
    limit,
    page,
    // Avoid system fields permission issues; sort by id (works for int/uuid).
    sort: "-id",
    /**
     * IMPORTANT:
     * Use fields="*" to keep the URL short.
     * Some setups (e.g. Cloudflare/WAF) can block very long query strings when we enumerate many fields.
     *
     * If your policies restrict fields, adjust Directus permissions to allow the required fields.
     */
    fields: "*",
  };

  // Filter by entity_status: "active" excludes archived, undefined shows all
  if (entityStatus) {
    q["filter[entity_status][_eq]"] = entityStatus;
  }

  if (search) {
    q[`filter[_or][0][${nameKey}][_icontains]`] = search;
    q[`filter[_or][1][${nifKey}][_icontains]`] = search;
    q[`filter[_or][2][${phoneKey}][_icontains]`] = search;
    q[`filter[_or][3][${emailKey}][_icontains]`] = search;
  }

  const res = await directusRequest<{ data: any[] }>(`/items/${DIRECTUS_CONTACTS_COLLECTION}${qs(q)}`);
  return (res?.data || []).map((i) => mapFromDirectusItem(i)!).filter(Boolean);
}

