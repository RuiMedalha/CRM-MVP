/**
 * Testes manuais do motor financeiro.
 *
 * Para correr:
 *   npx tsx src/lib/money/proposalEngine.test.ts
 *
 * Estes testes validam o exemplo crítico da auditoria:
 * "€100 × 2 com 10% pode aparecer como €180 no editor/PDF, €221,40 na página pública e €246 no pdf-service"
 *
 * Garantia: TODOS os canais devem chegar aos mesmos números.
 */

import { calculateProposalTotals } from "./proposalEngine";

interface TestCase {
  name: string;
  items: Array<{ unit_price: number; quantity: number; discount_percent?: number; iva_percent?: number }>;
  discount_percent?: number;
  discount_amount?: number;
  urgency_discount_pct?: number;
  urgency_expires_at?: string | null;
  expected: {
    subtotalSemIva?: number;
    ivaAmount?: number;
    total?: number;
  };
}

const CASES: TestCase[] = [
  {
    name: "€100 × 2 com 10% desconto, IVA 23%",
    items: [
      { unit_price: 100, quantity: 2, discount_percent: 10, iva_percent: 23 },
    ],
    expected: {
      subtotalSemIva: 180, // 200 - 20
      ivaAmount: 41.4, // 180 * 0.23
      total: 221.4,
    },
  },
  {
    name: "Sem desconto, sem IVA",
    items: [{ unit_price: 100, quantity: 1, iva_percent: 0 }],
    expected: { subtotalSemIva: 100, ivaAmount: 0, total: 100 },
  },
  {
    name: "Múltiplas linhas com IVAs diferentes",
    items: [
      { unit_price: 50, quantity: 1, iva_percent: 23 },
      { unit_price: 30, quantity: 2, iva_percent: 13 },
    ],
    expected: {
      subtotalSemIva: 110,
      ivaAmount: 50 * 0.23 + 60 * 0.13, // 11.5 + 7.8 = 19.3
      total: 129.3,
    },
  },
  {
    name: "Desconto fixo + urgência",
    items: [{ unit_price: 100, quantity: 1, iva_percent: 23 }],
    discount_amount: 10,
    urgency_discount_pct: 5,
    urgency_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    expected: {
      subtotalSemIva: 85.5, // 100 - 10 = 90, urgency 5% de 90 = 4.5, final = 85.5
      ivaAmount: 19.66, // 85.5 * 0.23 = 19.665 → round half-even = 19.66 (66 é par)
      total: 105.16,
    },
  },
];

let pass = 0;
let fail = 0;

for (const tc of CASES) {
  const result = calculateProposalTotals({
    items: tc.items,
    discount_percent: tc.discount_percent,
    discount_amount: tc.discount_amount,
    urgency_discount_pct: tc.urgency_discount_pct,
    urgency_expires_at: tc.urgency_expires_at ?? null,
  });

  let ok = true;
  const checks: string[] = [];

  if (tc.expected.subtotalSemIva !== undefined && Math.abs(result.subtotalSemIva - tc.expected.subtotalSemIva) > 0.001) {
    ok = false;
    checks.push(`subtotalSemIva: expected ${tc.expected.subtotalSemIva}, got ${result.subtotalSemIva}`);
  }
  if (tc.expected.ivaAmount !== undefined && Math.abs(result.ivaAmount - tc.expected.ivaAmount) > 0.001) {
    ok = false;
    checks.push(`ivaAmount: expected ${tc.expected.ivaAmount}, got ${result.ivaAmount}`);
  }
  if (tc.expected.total !== undefined && Math.abs(result.total - tc.expected.total) > 0.001) {
    ok = false;
    checks.push(`total: expected ${tc.expected.total}, got ${result.total}`);
  }

  if (ok) {
    console.log(`✅ ${tc.name}: subtotalSemIva=${result.subtotalSemIva} iva=${result.ivaAmount} total=${result.total}`);
    pass++;
  } else {
    console.error(`❌ ${tc.name}:`);
    checks.forEach((c) => console.error(`   ${c}`));
    fail++;
  }
}

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
if (fail > 0) process.exit(1);