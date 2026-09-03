/**
 * Onboarding wizard helpers - reads/writes company_settings.onboarding_done
 * and bootstraps minimal data (default employee, demo lead, default pipeline).
 */
import { directusRequest } from "@/integrations/directus/client";
import { createItem, readItems, updateItem, getDirectusClient } from "@/lib/directus";

export interface CompanySettingsOnboarding {
  id: string;
  name?: string | null;
  vat_number?: string | null;
  logo_url?: string | null;
  onboarding_done?: boolean | null;
  onboarding_step?: number | null;
  onboarding_completed_at?: string | null;
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

export async function fetchOnboardingState(): Promise<CompanySettingsOnboarding | null> {
  try {
    const res = await directusRequest<{ data: CompanySettingsOnboarding[] }>(
      `/items/company_settings${qs({ limit: 1 })}`,
    );
    return res?.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function setOnboardingStep(step: number, patch: Partial<CompanySettingsOnboarding> = {}): Promise<void> {
  try {
    const cur = await fetchOnboardingState();
    if (!cur?.id) return;
    await directusRequest(`/items/company_settings/${encodeURIComponent(cur.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ onboarding_step: step, ...patch }),
    });
  } catch { /* noop */ }
}

export async function completeOnboarding(): Promise<void> {
  try {
    const cur = await fetchOnboardingState();
    if (!cur?.id) return;
    await directusRequest(`/items/company_settings/${encodeURIComponent(cur.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ onboarding_done: true, onboarding_completed_at: new Date().toISOString() }),
    });
  } catch { /* noop */ }
}

/** Cria/atualiza dados da empresa (nome, logo, NIF). */
export async function upsertCompanyBasics(input: { name: string; vat_number?: string | null; logo_url?: string | null }): Promise<void> {
  try {
    const cur = await fetchOnboardingState();
    if (cur?.id) {
      await directusRequest(`/items/company_settings/${encodeURIComponent(cur.id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    } else {
      await directusRequest(`/items/company_settings`, { method: "POST", body: JSON.stringify(input) });
    }
  } catch { /* noop */ }
}

/** Cria um employee admin para o utilizador atual. */
export async function bootstrapAdminEmployee(input: { full_name: string; email?: string | null; phone?: string | null; role?: string }): Promise<string | null> {
  try {
    const client = getDirectusClient();
    const created = await client.request(createItem("employees", {
      full_name: input.full_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role ?? "admin",
      is_active: true,
    } as any));
    return (created as any)?.id ?? null;
  } catch {
    return null;
  }
}

/** Cria pipeline default se nao existir nenhum. */
export async function ensureDefaultPipeline(): Promise<string | null> {
  try {
    const client = getDirectusClient();
    const existing = await client.request(readItems("deals", { limit: 1, fields: ["id"] } as any) as any);
    if (Array.isArray(existing) && existing.length > 0) return null;
    const pipeline = await client.request(createItem("deals", {
      title: "Pipeline Default",
      status: "open",
      value: 0,
    } as any));
    return (pipeline as any)?.id ?? null;
  } catch {
    return null;
  }
}

/** Cria um lead demo. */
export async function bootstrapDemoLead(): Promise<string | null> {
  try {
    const client = getDirectusClient();
    const created = await client.request(createItem("leads", {
      status: "novo",
      source: "Onboarding Demo",
      display_name: "Lead de Demonstracao",
      email: "demo@exemplo.pt",
      phone: "+351 900 000 000",
      lead_data: { from_onboarding: true, created_at: new Date().toISOString() },
      first_attempt_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      attempt_count: 1,
    } as any));
    return (created as any)?.id ?? null;
  } catch {
    return null;
  }
}
