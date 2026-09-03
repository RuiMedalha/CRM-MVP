import { useState } from "react";
import { tokens, fonts } from "./design-tokens";
import { directusAdminFetch } from "@/integrations/directus/client";
import { DIRECTUS_QUOTATIONS_COLLECTION } from "@/integrations/directus/quotations";

interface NewsletterDiscountProps {
  quotationId: number | string;
  quotationNumber?: string;
  discountCode: string;
  discountPercent: number;
  alreadyApplied?: boolean;
}

const N8N_NEWSLETTER_WEBHOOK = import.meta.env.VITE_N8N_NEWSLETTER_WEBHOOK || "";

export function NewsletterDiscount({
  quotationId,
  quotationNumber,
  discountCode,
  discountPercent,
  alreadyApplied,
}: NewsletterDiscountProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(alreadyApplied || false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    try {
      // Notify n8n webhook
      if (N8N_NEWSLETTER_WEBHOOK) {
        await fetch(N8N_NEWSLETTER_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            code: discountCode,
            quotation_id: quotationId,
            quotation_number: quotationNumber,
            source: "proposta",
          }),
        }).catch(() => {});
      }
      // PATCH quotation
      await directusAdminFetch(`/items/${DIRECTUS_QUOTATIONS_COLLECTION}/${quotationId}`, {
        method: "PATCH",
        body: JSON.stringify({
          newsletter_applied: true,
          newsletter_email: email.trim(),
        }),
      }).catch(() => {});

      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: tokens.amberSoft,
        border: `2px dashed ${tokens.amber}`,
        borderRadius: 14,
        padding: 24,
        marginTop: 24,
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 16,
          fontWeight: 600,
          color: tokens.text,
          margin: "0 0 8px",
        }}
      >
        📧 Poupe {discountPercent}% na sua próxima compra
      </p>
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          color: tokens.muted,
          margin: "0 0 16px",
        }}
      >
        Subscreva a newsletter e receba um código de desconto exclusivo.
      </p>

      {!submitted ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "0 auto" }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="O seu nome"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${tokens.border}`,
              fontFamily: fonts.sans,
              fontSize: 13,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.pt"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${tokens.border}`,
              fontFamily: fonts.sans,
              fontSize: 13,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !email.trim()}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: tokens.teal,
              color: tokens.white,
              fontFamily: fonts.sans,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading || !name.trim() || !email.trim() ? 0.6 : 1,
            }}
          >
            {loading ? "A processar..." : "Subscrever e receber código"}
          </button>
        </div>
      ) : (
        <div>
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: tokens.muted,
              margin: "0 0 8px",
            }}
          >
            O seu código de desconto:
          </p>
          <p
            style={{
              fontFamily: fonts.mono,
              fontSize: 28,
              fontWeight: 700,
              color: tokens.teal,
              margin: "0 0 8px",
              letterSpacing: "0.05em",
            }}
          >
            {discountCode}
          </p>
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: tokens.faint,
              margin: 0,
            }}
          >
            Use este código na sua próxima encomenda para obter {discountPercent}% de desconto.
          </p>
        </div>
      )}
    </div>
  );
}
