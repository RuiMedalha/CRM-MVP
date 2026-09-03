/**
 * Directus integration for the lead_capture_forms collection.
 */
import { directusRequest } from "@/integrations/directus/client";
import type { LeadCaptureForm, LeadField } from "@/services/leadCapture/renderForm";

export interface LeadCaptureFormRow {
  id: string;
  name: string;
  slug: string;
  source_label: string;
  description?: string | null;
  fields: LeadField[];
  success_message: string;
  redirect_url?: string | null;
  notification_email?: string | null;
  webhook_url?: string | null;
  assign_to_employee_id?: string | null;
  round_robin_pool?: string[] | null;
  is_active?: boolean | null;
  embed_code_html?: string | null;
  embed_code_iframe?: string | null;
  submit_count?: number | null;
  last_submitted_at?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function rowToForm(row: LeadCaptureFormRow): LeadCaptureForm {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    source_label: row.source_label ?? "Web Form",
    success_message: row.success_message ?? "Obrigado!",
    redirect_url: row.redirect_url ?? null,
    is_active: row.is_active ?? true,
    fields: Array.isArray(row.fields) ? row.fields : [],
  };
}

export async function listLeadCaptureForms(): Promise<LeadCaptureFormRow[]> {
  const res = await directusRequest<{ data: LeadCaptureFormRow[] }>(
    `/items/lead_capture_forms${qs({ sort: "-date_created", limit: 200 })}`,
  );
  return res?.data ?? [];
}

export async function fetchLeadCaptureFormBySlug(slug: string): Promise<LeadCaptureForm | null> {
  const res = await directusRequest<{ data: LeadCaptureFormRow[] }>(
    `/items/lead_capture_forms${qs({ "filter[slug][_eq]": slug, limit: 1 })}`,
  );
  const row = res?.data?.[0];
  if (!row) return null;
  return rowToForm(row);
}

export async function fetchLeadCaptureFormById(id: string): Promise<LeadCaptureFormRow | null> {
  try {
    const res = await directusRequest<{ data: LeadCaptureFormRow }>(
      `/items/lead_capture_forms/${encodeURIComponent(id)}`,
    );
    return res?.data ?? null;
  } catch { return null; }
}

export interface CreateLeadCaptureFormInput {
  name: string;
  slug: string;
  source_label: string;
  description?: string | null;
  fields: LeadField[];
  success_message: string;
  redirect_url?: string | null;
  notification_email?: string | null;
  webhook_url?: string | null;
  assign_to_employee_id?: string | null;
  round_robin_pool?: string[] | null;
  is_active?: boolean;
  embed_code_html?: string | null;
  embed_code_iframe?: string | null;
}

export async function createLeadCaptureForm(input: CreateLeadCaptureFormInput): Promise<LeadCaptureFormRow> {
  const res = await directusRequest<{ data: LeadCaptureFormRow }>(`/items/lead_capture_forms`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res?.data;
}

export async function updateLeadCaptureForm(id: string, patch: Partial<CreateLeadCaptureFormInput>): Promise<LeadCaptureFormRow> {
  const res = await directusRequest<{ data: LeadCaptureFormRow }>(
    `/items/lead_capture_forms/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return res?.data;
}

export async function deleteLeadCaptureForm(id: string): Promise<void> {
  await directusRequest(`/items/lead_capture_forms/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listLeadsBySource(source: string): Promise<Array<{ id: string; display_name?: string | null; email?: string | null; phone?: string | null; date_created?: string | null; lead_data?: any }>> {
  const res = await directusRequest<{ data: any[] }>(
    `/items/leads${qs({ "filter[source][_eq]": source, sort: "-date_created", limit: 100 })}`,
  );
  return res?.data ?? [];
}
