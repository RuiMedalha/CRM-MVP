/**
 * Lead Capture - submit (service-side helper).
 *
 * Cria lead em Directus, atribui round-robin se assign_to_employee_id for null,
 * regista interaction, dispara webhook.
 */
import { createItem, readItems, updateItem, getDirectusClient } from "@/lib/directus";

export interface SubmitInput {
  form: {
    id: string;
    slug: string;
    source_label: string;
    name: string;
    assign_to_employee_id?: string | null;
    round_robin_pool?: string[] | null;
    webhook_url?: string | null;
    notification_email?: string | null;
    fields: Array<{ name: string; label: string; type: string; required?: boolean }>;
    redirect_url?: string | null;
    success_message: string;
  };
  data: Record<string, string | number | boolean | null>;
  referer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}

export interface SubmitResult {
  ok: boolean;
  lead_id?: string;
  assigned_to?: string | null;
  redirect_url?: string | null;
  success_message?: string;
  error?: string;
}

function pickDisplay(data: Record<string, any>) {
  return {
    display_name: data["name"] ?? data["full_name"] ?? data["display_name"] ?? undefined,
    email: data["email"] ?? undefined,
    phone: data["phone"] ?? data["telefone"] ?? data["tel"] ?? undefined,
    nif: data["nif"] ?? undefined,
  };
}

async function fetchEmployees(): Promise<Array<{ id: string }>> {
  try {
    const client = getDirectusClient();
    const items = await client.request(
      readItems("employees", {
        filter: { is_active: { _eq: true } } as any,
        fields: ["id"],
        limit: 500,
      })
    );
    return (items as any[]) || [];
  } catch { return []; }
}

async function pickAssignee(input: SubmitInput): Promise<string | null> {
  if (input.form.assign_to_employee_id) return input.form.assign_to_employee_id;
  const pool = Array.isArray(input.form.round_robin_pool) && input.form.round_robin_pool.length > 0
    ? input.form.round_robin_pool
    : null;
  let candidates: Array<{ id: string }> = [];
  if (pool) candidates = pool.map((id) => ({ id }));
  else candidates = await fetchEmployees();
  if (candidates.length === 0) return null;
  const idx = Math.floor(Date.now() / 1000) % candidates.length;
  return candidates[idx].id;
}

async function triggerWebhook(url: string, payload: unknown) {
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch { /* noop */ }
}

export async function submitLeadCapture(input: SubmitInput): Promise<SubmitResult> {
  try {
    const data = input.data || {};
    const picked = pickDisplay(data);

    for (const f of input.form.fields ?? []) {
      if (f.required) {
        const v = data[f.name];
        if (v === undefined || v === null || String(v).trim() === "") {
          return { ok: false, error: "Campo obrigatorio em falta: " + (f.label || f.name) };
        }
      }
    }

    const assignee = await pickAssignee(input);
    const client = getDirectusClient();

    const leadPayload: Record<string, unknown> = {
      status: "novo",
      source: input.form.source_label || "Web Form",
      source_event_id: `form:${input.form.slug}:${Date.now()}`,
      display_name: picked.display_name || data["name"] || "Lead Web",
      email: picked.email ?? null,
      phone: picked.phone ?? null,
      nif: picked.nif ?? null,
      lead_data: {
        form_id: input.form.id,
        form_slug: input.form.slug,
        form_name: input.form.name,
        submitted_fields: data,
        referer: input.referer ?? null,
        user_agent: input.userAgent ?? null,
        ip: input.ip ?? null,
        submitted_at: new Date().toISOString(),
      },
      claimed_by: assignee ?? undefined,
      first_attempt_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      attempt_count: 1,
    };

    const createdLead = await client.request(createItem("leads", leadPayload as any));
    const leadId = (createdLead as any)?.id;

    try {
      const all = await client.request(
        readItems("lead_capture_forms", { filter: { id: { _eq: input.form.id } } as any, fields: ["submit_count"], limit: 1 })
      );
      const current = (all as any[])[0]?.submit_count ?? 0;
      await client.request(updateItem("lead_capture_forms", input.form.id, {
        submit_count: Number(current) + 1,
        last_submitted_at: new Date().toISOString(),
      } as any));
    } catch { /* noop */ }

    try {
      await client.request(createItem("interactions", {
        type: "form_submit",
        direction: "inbound",
        status: "received",
        source: input.form.source_label,
        external_id: String(leadId ?? ""),
        occurred_at: new Date().toISOString(),
        phone: picked.phone ?? null,
        email: picked.email ?? null,
        display_name: picked.display_name ?? null,
        lead_id: leadId ?? null,
        summary: `Submissao via form: ${input.form.name}`,
        payload: { form_slug: input.form.slug, fields: data },
      } as any));
    } catch { /* noop */ }

    if (input.form.webhook_url) {
      void triggerWebhook(input.form.webhook_url, {
        event: "lead_capture.submitted",
        lead_id: leadId,
        form: { id: input.form.id, slug: input.form.slug, name: input.form.name },
        data,
        assigned_to: assignee,
      });
    }

    return { ok: true, lead_id: leadId, assigned_to: assignee, redirect_url: input.form.redirect_url ?? undefined, success_message: input.form.success_message };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao processar submissao" };
  }
}
