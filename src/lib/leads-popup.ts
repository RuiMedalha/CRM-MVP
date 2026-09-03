import type { LeadItem } from "@/integrations/directus/leads";

const POPUP_EXCLUDED_SOURCES = new Set(["central"]);
const POPUP_EXCLUDED_TYPES = new Set(["call"]);

/** Idade máxima (segundos) para mostrar popup de lead incoming. */
export function getLeadsPopupMaxAgeSeconds(): number {
  const raw = import.meta.env.VITE_LEADS_POPUP_MAX_AGE_SECONDS;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  return 60;
}

export function getLeadsPopupMaxAgeMs(): number {
  return getLeadsPopupMaxAgeSeconds() * 1000;
}

export function getIncomingLeadsCutoffIso(maxAgeMs = getLeadsPopupMaxAgeMs()): string {
  return new Date(Date.now() - maxAgeMs).toISOString();
}

/** Momento do evento: occurred_at (se existir) ou date_created. */
export function getLeadPopupEventAt(lead: LeadItem): string | null {
  const occurred = lead.occurred_at ?? lead.lead_data?.occurred_at;
  if (occurred) return String(occurred);
  if (lead.date_created) return String(lead.date_created);
  if (lead.first_attempt_at) return String(lead.first_attempt_at);
  return null;
}

function getLeadPopupType(lead: LeadItem): string {
  const direct = lead.type ?? lead.lead_data?.type;
  return String(direct ?? "")
    .trim()
    .toLowerCase();
}

/** Chamadas Telecof / central → HubChat, não popup CRM. */
export function isLeadExcludedFromPopup(lead: LeadItem): boolean {
  const source = String(lead.source ?? "")
    .trim()
    .toLowerCase();
  if (POPUP_EXCLUDED_SOURCES.has(source)) return true;

  const type = getLeadPopupType(lead);
  if (type && POPUP_EXCLUDED_TYPES.has(type)) return true;

  return false;
}

export function isLeadFreshForPopup(lead: LeadItem, maxAgeMs = getLeadsPopupMaxAgeMs()): boolean {
  const at = getLeadPopupEventAt(lead);
  if (!at) return false;
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= maxAgeMs;
}

export function isLeadEligibleForIncomingPopup(lead: LeadItem | null | undefined): lead is LeadItem {
  if (!lead?.id) return false;
  if (String(lead.status ?? "").toLowerCase() !== "incoming") return false;
  if (isLeadExcludedFromPopup(lead)) return false;
  if (!isLeadFreshForPopup(lead)) return false;
  return true;
}
