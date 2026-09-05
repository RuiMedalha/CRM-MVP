/**
 * Motor financeiro canónico para propostas.
 *
 * USAR EM:
 *   - src/components/proposals/steps/StepSend.tsx   (editor)
 *   - src/components/proposals/public/FinancialSummary.tsx  (página pública)
 *   - src/utils/generateProposalPDF.ts              (PDF browser)
 *   - services/pdf-service/index.js                (PDF service)
 *   - email render do template                      (email)
 *
 * GARANTIA: todos os canais mostram os mesmos números para a mesma quotation.
 *
 * CONTRATO (IVA por linha, arredondamento half-even):
 *   1. Cada item tem iva_percent próprio (linha-a-linha).
 *   2. subtotalSemIva = Σ (unit_price * qty * (1 - discount_pct/100)) [com half-even a 2 casas]
 *   3. urgency: aplica sobre subtotalSemIva (depois de desconto principal).
 *   4. iva por linha: linhaBaseSemIva * (ivaPercent/100), arredondado por linha.
 *   5. total = subtotalSemIva + Σ ivaAmount (arredondado final).
 */

const DEFAULT_IVA_PCT = 23;

export interface ProposalItemInput {
  /** Preço unitário sem IVA. */
  unit_price: number | string;
  /** Quantidade. */
  quantity?: number | string;
  /** Desconto percentual aplicado a esta linha (0-100). */
  discount_percent?: number | string;
  /** IVA percentual desta linha (0-100). */
  iva_percent?: number | string;
}

export interface ProposalTotalsInput {
  /** Lista de items da proposta. */
  items: ProposalItemInput[];
  /** Desconto percentual aplicado ao total (0-100). */
  discount_percent?: number | string;
  /** Montante fixo de desconto (alternativa a percentagem). */
  discount_amount?: number | string;
  /** Desconto urgência percentual (0-100). */
  urgency_discount_pct?: number | string;
  /** Data de expiração do desconto urgência (ISO). */
  urgency_expires_at?: string | null;
  /** Data de referência (default = now). */
  now?: Date;
}

export interface ProposalTotalsResult {
  /** Subtotal base (s/IVA) antes de descontos. */
  subtotalBase: number;
  /** Montante de desconto percentual aplicado. */
  discountAmount: number;
  /** Montante de desconto urgência aplicado. */
  urgencyAmount: number;
  /** Subtotal final s/IVA (depois de descontos). */
  subtotalSemIva: number;
  /** Total de IVA. */
  ivaAmount: number;
  /** Total final c/IVA. */
  total: number;
  /** Breakdown por linha (para auditoria). */
  lines: Array<{
    base: number;
    discount: number;
    netBase: number;
    ivaPercent: number;
    ivaAmount: number;
  }>;
}

/** Converte para número seguro; NaN/undefined/null → 0. */
function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim();
  if (s === "" || s === "null" || s === "undefined") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Arredondamento half-even (banker's rounding) a 2 casas decimais. */
function round2(n: number): number {
  const m = n * 100;
  const floor = Math.floor(m);
  const diff = m - floor;
  if (diff > 0.5) return (floor + 1) / 100;
  if (diff < 0.5) return floor / 100;
  // exactly .5 → round to even
  return (floor % 2 === 0 ? floor : floor + 1) / 100;
}

export function calculateProposalTotals(input: ProposalTotalsInput): ProposalTotalsResult {
  const now = input.now ?? new Date();

  // 1. Calcular base por linha + desconto por linha + IVA por linha
  const lines = (input.items || []).map((item) => {
    const unit = num(item.unit_price);
    const qty = num(item.quantity) || 1;
    const lineDiscountPct = num(item.discount_percent);
    const lineIvaPct = item.iva_percent !== undefined && item.iva_percent !== null && item.iva_percent !== "" ? num(item.iva_percent) : DEFAULT_IVA_PCT;

    const lineBase = unit * qty;
    const lineDiscount = lineBase * (lineDiscountPct / 100);
    const lineNetBase = lineBase - lineDiscount;
    const lineIvaAmount = lineNetBase * (lineIvaPct / 100);

    return {
      base: round2(lineBase),
      discount: round2(lineDiscount),
      netBase: round2(lineNetBase),
      ivaPercent: lineIvaPct,
      ivaAmount: round2(lineIvaAmount),
    };
  });

  // 2. Subtotal base s/IVA antes de descontos globais
  const subtotalBase = round2(lines.reduce((s, l) => s + l.netBase, 0));

  // 3. Desconto global percentual OU fixo
  let discountAmount = 0;
  const discountPercent = num(input.discount_percent);
  const fixedDiscount = num(input.discount_amount);
  if (discountPercent > 0) {
    discountAmount = subtotalBase * (discountPercent / 100);
  } else if (fixedDiscount > 0) {
    discountAmount = Math.min(fixedDiscount, subtotalBase);
  }
  discountAmount = round2(discountAmount);

  // 4. Desconto urgência (só se ainda não expirou)
  let urgencyAmount = 0;
  const urgencyPct = num(input.urgency_discount_pct);
  const urgencyExpiresAt = input.urgency_expires_at;
  const urgencyActive =
    urgencyPct > 0 &&
    !!urgencyExpiresAt &&
    new Date(urgencyExpiresAt).getTime() > now.getTime();

  if (urgencyActive) {
    const afterDiscount = subtotalBase - discountAmount;
    urgencyAmount = afterDiscount * (urgencyPct / 100);
  }
  urgencyAmount = round2(urgencyAmount);

  // 5. Subtotal final s/IVA
  const subtotalSemIva = round2(subtotalBase - discountAmount - urgencyAmount);

  // 6. IVA total (soma dos IVAs por linha, recalculado sobre base com desconto global rateado proporcionalmente)
  //    Estratégia simples: aplicar discountAmount+urgencyAmount proporcionalmente a cada linha e recalcular IVA
  const totalDiscountRatio = subtotalBase > 0 ? (subtotalSemIva / subtotalBase) : 1;
  let ivaAmount = 0;
  for (const line of lines) {
    const lineNetAfterGlobal = round2(line.netBase * totalDiscountRatio);
    const lineIvaFinal = round2(lineNetAfterGlobal * (line.ivaPercent / 100));
    ivaAmount += lineIvaFinal;
  }
  ivaAmount = round2(ivaAmount);

  // 7. Total final
  const total = round2(subtotalSemIva + ivaAmount);

  return {
    subtotalBase,
    discountAmount,
    urgencyAmount,
    subtotalSemIva,
    ivaAmount,
    total,
    lines,
  };
}

/** Helper: devolve apenas o total final. */
export function calculateProposalTotal(input: ProposalTotalsInput): number {
  return calculateProposalTotals(input).total;
}

/** Helper: devolve apenas o IVA total. */
export function calculateProposalIva(input: ProposalTotalsInput): number {
  return calculateProposalTotals(input).ivaAmount;
}

export const PROPOSAL_ENGINE_DEFAULTS = {
  DEFAULT_IVA_PCT,
} as const;