/**
 * n8n Webhook Integration — Propostas
 *
 * Dispara webhooks n8n para automação de follow-ups e notificações.
 */

import type { Quotation } from "@/types/quotation";

const QUOTATION_SENT_WEBHOOK =
  import.meta.env.VITE_N8N_QUOTATION_SENT_WEBHOOK || "";
const CANCEL_FOLLOWUPS_WEBHOOK =
  import.meta.env.VITE_N8N_CANCEL_FOLLOWUPS_WEBHOOK || "";

// ─── Trigger when quotation is sent ─────────────────────────────────────────

export async function triggerQuotationSent(quotation: Quotation): Promise<void> {
  if (!QUOTATION_SENT_WEBHOOK) {
    console.warn("[n8n] VITE_N8N_QUOTATION_SENT_WEBHOOK não configurado");
    return;
  }

  const payload = {
    quotation_id: quotation.id,
    quotation_number: quotation.quotation_number,
    customer_id: quotation.customer_id,
    treatment: quotation.treatment,
    language: quotation.language || "pt",
    sent_to_email: quotation.sent_to_email,
    sent_to_phone: quotation.sent_to_phone,
    total_amount: quotation.total_amount,
    valid_until: quotation.valid_until,
    public_token: quotation.public_token,
    // Follow-up scheduling info
    follow_up_config: {
      follow_up_1_delay_hours: 48, // 2 dias
      follow_up_2_delay_hours: 120, // 5 dias
      follow_up_3_before_expiry_hours: 48, // 2 dias antes de expirar
    },
  };

  // Use mode: 'no-cors' — n8n does not return CORS headers,
  // but the webhook fires server-side regardless. Fire-and-forget.
  await fetch(QUOTATION_SENT_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    mode: "no-cors",
  }).catch((err) => {
    console.error("[n8n] Erro ao disparar webhook quotation-sent:", err);
  });
}

// ─── Cancel pending follow-ups (when client responds) ───────────────────────

export async function cancelFollowUps(quotationId: number | string): Promise<void> {
  if (!CANCEL_FOLLOWUPS_WEBHOOK) {
    console.warn("[n8n] VITE_N8N_CANCEL_FOLLOWUPS_WEBHOOK não configurado");
    return;
  }

  await fetch(CANCEL_FOLLOWUPS_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quotation_id: quotationId }),
    mode: "no-cors",
  }).catch((err) => {
    console.error("[n8n] Erro ao cancelar follow-ups:", err);
  });
}
