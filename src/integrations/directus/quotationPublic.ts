/**
 * Public Quotation API — funções para a página pública /p/:token.
 *
 * LEITURA: Sem autenticação (role Public no Directus tem read-only nos campos seguros).
 * ESCRITA: Usa admin token apenas para record view e respond (PATCH).
 */

import { directusAdminFetch } from "@/integrations/directus/client";
import { DIRECTUS_QUOTATIONS_COLLECTION, DIRECTUS_QUOTATION_ITEMS_COLLECTION } from "@/integrations/directus/quotations";
import type { PublicQuotation, PublicQuotationItem, QuotationReview } from "@/types/quotation";

const DIRECTUS_URL = (import.meta.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt").replace(/\/$/, "");
const REVIEWS_COLLECTION = "quotation_reviews";

// ─── Public fetch (plain fetch, NO auth, NO interceptors, NO refresh) ─────

async function publicFetch<T>(path: string): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${DIRECTUS_URL}${normalizedPath}`;

  // Plain fetch — NO Authorization header, NO SDK, NO interceptors.
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Public fetch ${res.status}: ${text}`);
  }

  return await res.json();
}

// ─── Public company settings (sem auth) ────────────────────────────────────

const COMPANY_SETTINGS_COLLECTION =
  import.meta.env.VITE_DIRECTUS_COMPANY_SETTINGS_COLLECTION || "company_settings";
const COMPANY_SETTINGS_ID = import.meta.env.VITE_DIRECTUS_COMPANY_SETTINGS_ID || "";

const PUBLIC_COMPANY_FIELDS = [
  "id", "name", "logo_url", "phone", "email",
  "address", "postal_code", "city", "vat_number",
  "iban", "payment_instructions",
  "multibanco_entity", "multibanco_reference", "mbway_phone",
].join(",");

/**
 * Resolve logo_url: if it's a UUID (Directus asset ID), convert to full asset URL.
 * If it's already a full URL (http/https), use as-is.
 */
function resolveLogoUrl(logoValue: any): string | null {
  if (!logoValue) return null;
  const val = String(logoValue).trim();
  if (!val) return null;
  // Already a full URL — use as-is
  if (val.startsWith("http://") || val.startsWith("https://")) return val;
  // UUID pattern — this is a Directus file UUID stored in local storage
  // DO NOT use /assets/{uuid} as it fails with 500
  // Fall back to the R2 public logo instead
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
    return "https://files.hotelequip.pt/public/logo.png";
  }
  // Other — return as-is
  return val;
}

export async function getPublicCompanySettings(): Promise<Record<string, any> | null> {
  try {
    let data: any = null;
    if (COMPANY_SETTINGS_ID) {
      const res = await publicFetch<{ data: any }>(
        `/items/${COMPANY_SETTINGS_COLLECTION}/${COMPANY_SETTINGS_ID}?fields=${PUBLIC_COMPANY_FIELDS}`
      );
      data = res?.data || null;
    } else {
      const res = await publicFetch<{ data: any[] }>(
        `/items/${COMPANY_SETTINGS_COLLECTION}?fields=${PUBLIC_COMPANY_FIELDS}&limit=1&sort=-id`
      );
      data = res?.data?.[0] || null;
    }
    // Resolve logo_url to full URL (never expose raw UUID to components)
    if (data && data.logo_url) {
      data.logo_url = resolveLogoUrl(data.logo_url);
    }
    return data;
  } catch {
    return null;
  }
}

// ─── Campos seguros para expor publicamente (NUNCA: cost_price, internal_notes) ──
// Nota: NÃO usar campos relacionais (customer_id.x) — a role Public não tem acesso a contacts.
// Os campos customer_name e customer_company são guardados directamente na coleção quotations.

const PUBLIC_QUOTATION_FIELDS = [
  "id", "quotation_number", "status", "treatment", "language",
  "welcome_message", "proposal_description", "comparison_recommendation_text",
  "voice_message_url", "video_url", "next_steps",
  "subtotal", "discount_percent", "discount_amount", "total_amount",
  "deposit_type", "deposit_percent",
  "urgency_discount_pct", "urgency_hours", "urgency_expires_at",
  "valid_until", "theme", "phone_gate_enabled",
  "approved_at", "rejected_at",
  "date_created", "pdf_file_url",
  "customer_name", "customer_company",
  "sent_to_phone", "terms_conditions",
  "view_count", "public_token", "document_type",
  "newsletter_discount_code", "newsletter_discount_percent", "newsletter_applied",
].join(",");

const PUBLIC_ITEM_FIELDS = [
  "id", "item_type", "product_name", "sku", "quantity", "unit_price",
  "discount_percent", "line_total", "image_url", "images",
  "product_url", "datasheet_url", "datasheet_label", "ai_description",
  "notes", "iva_percent",
  "comparison_group", "is_recommended", "comparison_specs",
].join(",");

// ─── Get quotation by public token (PUBLIC — sem auth) ─────────────────────

export async function getQuotationByToken(token: string): Promise<PublicQuotation | null> {
  const res = await publicFetch<{ data: any[] }>(
    `/items/${DIRECTUS_QUOTATIONS_COLLECTION}?filter[public_token][_eq]=${encodeURIComponent(token)}&fields=${PUBLIC_QUOTATION_FIELDS}&limit=1`
  );

  const row = res?.data?.[0];
  if (!row) return null;

  // Fetch items (public — plain fetch, no auth)
  const itemsRes = await publicFetch<{ data: any[] }>(
    `/items/${DIRECTUS_QUOTATION_ITEMS_COLLECTION}?filter[quotation_id][_eq]=${row.id}&fields=${PUBLIC_ITEM_FIELDS}&sort=id&limit=200`
  ).catch(() => ({ data: [] }));

  // Fetch reviews (public — plain fetch, no auth, silencioso se 403)
  const reviewsRes = await publicFetch<{ data: QuotationReview[] }>(
    `/items/${REVIEWS_COLLECTION}?filter[quotation_id][_eq]=${row.id}&sort=-date_created&limit=50`
  ).catch(() => ({ data: [] as QuotationReview[] }));

  return {
    id: row.id,
    quotation_number: row.quotation_number,
    status: row.status,
    treatment: row.treatment,
    language: row.language,
    welcome_message: row.welcome_message,
    proposal_description: row.proposal_description,
    comparison_recommendation_text: row.comparison_recommendation_text,
    voice_message_url: row.voice_message_url,
    video_url: row.video_url,
    next_steps: row.next_steps,
    subtotal: row.subtotal,
    discount_percent: row.discount_percent,
    discount_amount: row.discount_amount,
    total_amount: row.total_amount,
    deposit_type: row.deposit_type,
    deposit_percent: row.deposit_percent,
    urgency_discount_pct: row.urgency_discount_pct,
    urgency_hours: row.urgency_hours,
    urgency_expires_at: row.urgency_expires_at,
    valid_until: row.valid_until,
    theme: row.theme,
    phone_gate_enabled: row.phone_gate_enabled,
    approved_at: row.approved_at,
    rejected_at: row.rejected_at,
    date_created: row.date_created,
    pdf_file_url: row.pdf_file_url,
    items: (itemsRes?.data || []) as PublicQuotationItem[],
    reviews: (reviewsRes?.data || []) as QuotationReview[],
    customer_name: row.customer_name || "",
    customer_company: row.customer_company || "",
    terms_conditions: row.terms_conditions || "",
    public_token: row.public_token || undefined,
  };
}

// ─── Verify phone gate (últimos 4 dígitos) ─────────────────────────────────
// Usa sent_to_phone (campo directo na quotation, sem relação)

export async function verifyPhoneGate(token: string, lastFourDigits: string): Promise<boolean> {
  const res = await publicFetch<{ data: any[] }>(
    `/items/${DIRECTUS_QUOTATIONS_COLLECTION}?filter[public_token][_eq]=${encodeURIComponent(token)}&fields=sent_to_phone&limit=1`
  );

  const row = res?.data?.[0];
  if (!row) return false;

  const phone = String(row.sent_to_phone || "").replace(/\D/g, "");
  
  // Se não há telefone configurado, deixa passar (gate desactivado por omissão)
  if (!phone || phone.length < 4) return true;
  
  const last4 = phone.slice(-4);
  return last4 === lastFourDigits.replace(/\D/g, "");
}

// ─── Record view (ADMIN — precisa de auth para escrita) ─────────────────────
// Recebe o id numérico da proposta (campo "id" da collection quotations).
// Nunca deve bloquear a página pública — try/catch completo.

export async function recordView(quotationId: number | string, viewCount: number, currentStatus?: string): Promise<void> {
  // Guard: only accept numeric IDs (integer or numeric string)
  const numericId = Number(quotationId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    console.warn("[recordView] ID inválido (não numérico), a ignorar:", quotationId);
    return;
  }

  try {
    const now = new Date().toISOString();
    const shouldUpdateStatus = currentStatus === "sent";
    await directusAdminFetch(`/items/${DIRECTUS_QUOTATIONS_COLLECTION}/${numericId}`, {
      method: "PATCH",
      body: JSON.stringify({
        view_count: viewCount + 1,
        last_viewed_at: now,
        ...(viewCount === 0 ? { viewed_at: now } : {}),
        ...(shouldUpdateStatus ? { status: "viewed" } : {}),
      }),
    });

    // Best-effort: log view event in quotation_views_log for analytics
    await directusAdminFetch(`/items/quotation_views_log`, {
      method: "POST",
      body: JSON.stringify({
        quotation_id: numericId,
        viewed_at: now,
        device: typeof navigator !== "undefined" ? (/mobile/i.test(navigator.userAgent) ? "mobile" : "desktop") : "web",
      }),
    }).catch(() => {});
  } catch {
    // Silently ignore — never block the public page
  }
}

// ─── Respond to quotation (ADMIN — precisa de auth para escrita) ────────────
// Usa o id numérico da proposta.

export async function respondToQuotation(
  quotationId: number | string,
  action: "approved" | "rejected",
  signature?: string,
  reason?: string
): Promise<void> {
  const numericId = Number(quotationId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error("ID da proposta inválido.");
  }

  const now = new Date().toISOString();
  const patch: Record<string, any> = {
    status: action,
    ...(action === "approved"
      ? { approved_at: now, approval_signature: signature ?? "" }
      : { rejected_at: now, rejection_reason: reason ?? "" }),
  };
  await directusAdminFetch(`/items/${DIRECTUS_QUOTATIONS_COLLECTION}/${numericId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

  // Cancel any scheduled followups for this proposal
  try {
    const { cancelFollowUps } = await import("@/integrations/n8n/quotationWebhooks");
    await cancelFollowUps(numericId);
  } catch {
    // Silently ignore webhook failure
  }
}
