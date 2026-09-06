import { tokens, fonts } from "./design-tokens";
import { n, eur } from "./utils";
import { calculateProposalTotals } from "@/lib/money/proposalEngine";
import type { PublicQuotation, PublicQuotationItem } from "@/types/quotation";

interface FinancialSummaryProps {
  quotation: PublicQuotation;
  items: PublicQuotationItem[];
}

export function FinancialSummary({ quotation, items }: FinancialSummaryProps) {
  // Motor financeiro canónico — cálculo único para todos os canais
  const engineItems = items.map((i) => {
    const rawIva = (i as any).iva_percent;
    const ivaVal =
      rawIva !== undefined && rawIva !== null && String(rawIva).trim() !== "" && Number(rawIva) > 0
        ? n(rawIva)
        : 23;
    return {
      unit_price: n(i.unit_price),
      quantity: n(i.quantity) || 1,
      discount_percent: n(i.discount_percent),
      iva_percent: ivaVal,
    };
  });

  const result = calculateProposalTotals({
    items: engineItems,
    discount_percent: n(quotation.discount_percent),
    discount_amount: n(quotation.discount_amount),
    urgency_discount_pct: n(quotation.urgency_discount_pct),
    urgency_expires_at: quotation.urgency_expires_at ?? null,
  });

  const subtotalSemIva = result.subtotalSemIva;
  const ivaAmount = result.ivaAmount;
  const total = result.total;
  const discountPercent = n(quotation.discount_percent);
  const discountAmount = result.discountAmount;
  const urgencyPct = n(quotation.urgency_discount_pct);
  const urgencyExpiresAt = quotation.urgency_expires_at;
  const urgencyActive = urgencyPct > 0 && urgencyExpiresAt && new Date(urgencyExpiresAt) > new Date();
  const urgencyAmount = result.urgencyAmount;

  // Etiqueta do IVA — a taxa vem do motor canónico (result.lines[].ivaPercent),
  // que é exactamente a taxa usada para calcular o ivaAmount mostrado ao lado.
  // Nunca reconstituir a taxa a partir de ivaAmount/subtotal: é assim que o
  // generateProposalPDF.ts inventa percentagens em propostas com taxas mistas.
  // Só contam as linhas que contribuem para a base tributável; com mais do que
  // uma taxa distinta nenhum número único é verdadeiro, por isso não se mostra.
  const ivaRates = Array.from(
    new Set(result.lines.filter((l) => l.netBase > 0).map((l) => l.ivaPercent)),
  );
  const ivaLabel =
    ivaRates.length === 1 ? `IVA (${ivaRates[0]}%)` : ivaRates.length > 1 ? "IVA (taxas mistas)" : "IVA";

  // Deposit
  const depositPercent = n(quotation.deposit_percent);
  const isPartialDeposit = quotation.deposit_type === "partial" && depositPercent > 0;

  return (
    <div
      style={{
        background: tokens.card,
        borderTop: `3px solid ${tokens.amber}`,
        borderRadius: 14,
        padding: 24,
        marginTop: 28,
      }}
    >
      <h2
        style={{
          fontFamily: fonts.serif,
          fontSize: "1.25rem",
          color: tokens.text,
          margin: "0 0 20px",
        }}
      >
        Resumo Financeiro
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Subtotal sem IVA */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ fontFamily: fonts.sans, color: tokens.muted }}>Subtotal (s/ IVA)</span>
          <span style={{ fontFamily: fonts.mono, color: tokens.text }}>{eur(subtotalSemIva)}</span>
        </div>

        {/* Discount */}
        {discountPercent > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: tokens.teal }}>
            <span style={{ fontFamily: fonts.sans }}>Desconto ({discountPercent}%)</span>
            <span style={{ fontFamily: fonts.mono }}>-{eur(discountAmount)}</span>
          </div>
        )}

        {/* Urgency discount */}
        {urgencyActive && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: tokens.amber }}>
            <span style={{ fontFamily: fonts.sans }}>Desconto urgência ({urgencyPct}%)</span>
            <span style={{ fontFamily: fonts.mono }}>-{eur(urgencyAmount)}</span>
          </div>
        )}

        {/* IVA */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ fontFamily: fonts.sans, color: tokens.muted }}>{ivaLabel}</span>
          <span style={{ fontFamily: fonts.mono, color: tokens.text }}>+{eur(ivaAmount)}</span>
        </div>

        {/* Separator */}
        <hr style={{ border: "none", borderTop: `1px solid ${tokens.border}`, margin: "4px 0" }} />

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: fonts.sans, fontWeight: 600, color: tokens.text }}>TOTAL</span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 33,
              fontWeight: 700,
              color: tokens.teal,
            }}
          >
            {eur(total)}
          </span>
        </div>

        {/* IVA note */}
        <div
          style={{
            textAlign: "right",
            fontFamily: fonts.sans,
            fontSize: 12,
            color: tokens.faint,
          }}
        >
          IVA incluído à taxa legal em vigor
        </div>

        {/* Deposit card — only for partial deposits */}
        {isPartialDeposit && (
          <div
            style={{
              marginTop: 12,
              padding: "16px 20px",
              background: `linear-gradient(135deg, ${tokens.teal}, ${tokens.tealDark})`,
              borderRadius: 12,
              color: tokens.white,
            }}
          >
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 14,
                fontWeight: 600,
                margin: "0 0 4px",
              }}
            >
              Sinal a adiantar ({depositPercent}%): {eur(total * depositPercent / 100)}
            </p>
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                margin: 0,
                opacity: 0.8,
              }}
            >
              Restante na entrega: {eur(total - (total * depositPercent / 100))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
