/**
 * Customer 360 Adapter — transforma dados do Directus (contacts, deals, quotations)
 * em Customer360Data para a UI.
 *
 * Garante fallbacks seguros e arrays vazios.
 * A UI nunca recebe dados brutos do Directus.
 */

import type {
  Customer360Data,
  Customer360Organization,
  Customer360Contact,
  Customer360TimelineEvent,
  Customer360Opportunity,
  Customer360Proposal,
} from "@/types/customer360";

function str(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v).trim();
}

function numOrUndefined(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

export function adaptOrganization(record: Record<string, unknown>): Customer360Organization {
  // Resolve assigned_to (pode ser object { id, name } ou string)
  const assignedRaw = record.assigned_to;
  const assignedTo = typeof assignedRaw === "object" && assignedRaw
    ? str((assignedRaw as Record<string, unknown>).first_name) || str((assignedRaw as Record<string, unknown>).id)
    : str(assignedRaw) || undefined;

  // Spread all raw fields first so new Directus fields are available
  // without needing explicit mapping for each one. Then override with
  // the fields that need transformation (renaming, type conversion, etc.)
  const raw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v !== null && v !== undefined && v !== "") raw[k] = v;
  }

  return {
    ...raw,
    id: str(record.id),
    name: str(record.company_name) || str(record.contact_name) || "Sem nome",
    status: str(record.lifecycle_stage) || str(record.status) || "lead",
    roles: Array.isArray(record.roles) ? record.roles.map(String) : ["customer"],
    entityType: str(record.entity_type) || undefined,
    entityStatus: str(record.entity_status) || undefined,
    assignedTo,
    phone: str(record.phone) || undefined,
    email: str(record.email) || undefined,
    vatNumber: str(record.nif) || str(record.vat_number) || undefined,
    website: str(record.website) || undefined,
    address: str(record.address) || undefined,
    postalCode: str(record.postal_code) || undefined,
    city: str(record.city) || undefined,
    district: str(record.district) || undefined,
    country: str(record.country) || undefined,
    segment: str(record.segment) || undefined,
    origin: str(record.source) || undefined,
    businessType: str(record.business_type) || undefined,
    annualValue: numOrUndefined(record.annual_value),
    potential: str(record.potential) || undefined,
    operationalStatus: str(record.operational_status) || undefined,
    lastActivityAt: str(record.last_activity_at) || str(record.date_updated) || undefined,
    createdAt: str(record.date_created) || new Date().toISOString(),
    notes: str(record.notes) || undefined,
    internal_notes: str(record.internal_notes) || undefined,
  } as Customer360Organization;
}

export function adaptContact(record: Record<string, unknown>): Customer360Contact {
  const contactName = str(record.contact_name) || str(record.contact_person) || str(record.company_name) || "Sem nome";
  return {
    id: str(record.id),
    name: contactName,
    role: str(record.contact_role) || "other",
    phone: str(record.phone) || str(record.contact_phone) || undefined,
    email: str(record.email) || str(record.contact_email) || undefined,
    isPrimary: record.is_primary === true || record.isPrimary === true,
  };
}

export function adaptTimelineEvent(record: Record<string, unknown>): Customer360TimelineEvent {
  const payload = record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : undefined;
  const actor =
    str(record.actor) ||
    str(record.actor_name) ||
    str(record.agent_name) ||
    str(payload?.agent_name) ||
    str(record.display_name) ||
    str(record.from_address) ||
    str(record.customer_name) ||
    str(payload?.from) ||
    undefined;

  const rawDate = str(record.occurred_at) || str(record.occurredAt) || str(record.date_created) || str(record.created_at) || "";
  const isValidDate = Boolean(rawDate && !Number.isNaN(new Date(rawDate).getTime()));
  const occurredAt = isValidDate ? rawDate : new Date().toISOString();

  let eventType = str(record.type) || str(record.channel) || "note";
  if (eventType === "telecof" || eventType === "call") eventType = "phone";
  if (eventType === "askme" || eventType === "chat") eventType = "whatsapp";

  const defaultTitle =
    eventType === "phone" ? "Chamada telefónica" :
    eventType === "whatsapp" ? "Mensagem WhatsApp" :
    eventType === "email" ? "Email" : "Registo";

  return {
    id: str(record.id),
    type: eventType,
    title: str(record.title) || str(record.summary) || str(record.subject) || str(record.content)?.slice(0, 80) || defaultTitle,
    description: str(record.description) || str(record.content) || (payload?.text ? String(payload.text) : undefined),
    occurredAt,
    actor,
  };
}

export function adaptOpportunity(record: Record<string, unknown>): Customer360Opportunity {
  return {
    id: str(record.id),
    title: str(record.title) || "Sem título",
    stage: str(record.status) || str(record.stage) || "prospecting",
    value: numOrUndefined(record.total_amount) || numOrUndefined(record.value),
    assignedTo: str(record.assigned_employee_id) || str(record.assigned_to) || undefined,
  };
}

export function adaptProposal(record: Record<string, unknown>): Customer360Proposal {
  return {
    id: str(record.id),
    number: str(record.quotation_number) || str(record.id),
    status: str(record.status) || "draft",
    totalAmount: numOrUndefined(record.total_amount),
    sentAt: str(record.sent_at) || undefined,
    notes: str(record.notes) || undefined,
  };
}

/**
 * Adapta dados raw do Directus para Customer360Data completa.
 * Recebe objectos separados — a orquestração das queries é feita pelo hook.
 */
export function buildCustomer360Data(
  orgRecord: Record<string, unknown>,
  contactRecords: Record<string, unknown>[],
  timelineRecords: Record<string, unknown>[],
  opportunityRecords: Record<string, unknown>[],
  proposalRecords: Record<string, unknown>[],
): Customer360Data {
  return {
    organization: adaptOrganization(orgRecord),
    contacts: (contactRecords ?? []).map(adaptContact),
    timeline: (timelineRecords ?? []).map(adaptTimelineEvent),
    opportunities: (opportunityRecords ?? []).map(adaptOpportunity),
    proposals: (proposalRecords ?? []).map(adaptProposal),
  };
}
