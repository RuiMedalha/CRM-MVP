import { directusAdminFetch, DIRECTUS_ADMIN_TOKEN } from "@/integrations/directus/client";
import { qs } from "@/integrations/directus/utils";
import { createQuotation, createQuotationItems, patchQuotation } from "@/integrations/directus/quotations";
import { createDeal, type DealRow, type DealStatus } from "@/integrations/directus/deals";
import { auditMutation } from "@/integrations/directus/audit";

/* ════════════════════════════════════════════════════════════════════════
   Pedidos (encomendas) do site WooCommerce — coleção Directus site_orders.
   Alimentada pelo site (webhook em tempo real + backfill via API/cron).
   O CRM só lê e pode converter um pedido num orçamento/proposta.
════════════════════════════════════════════════════════════════════════ */

export interface SiteOrderItem { name?: string; sku?: string; product_id?: number; qty?: number; total?: number; price?: number }

export interface SiteOrderMeta {
  id?: number;
  key: string;
  value: any;
}

export interface SiteOrderShippingLine {
  method_id?: string;
  method_title?: string;
  total?: string | number;
  total_tax?: string | number;
}

export interface SiteOrderTaxLine {
  rate_code?: string;
  label?: string;
  rate_percent?: number;
  tax_total?: string | number;
}

export interface SiteOrder {
  id: number;
  wc_order_id?: number;
  order_number?: string;
  status?: string;
  date_ordered?: string;
  /** Data de pagamento (vinda do WooCommerce como date_paid). */
  date_paid?: string | null;
  /** Data de conclusão (WooCommerce date_completed). */
  date_completed?: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_nif?: string;
  total?: number;
  subtotal?: number;
  discount_total?: number;
  shipping_total?: number;
  tax_total?: number;
  coupon_codes?: string[];
  currency?: string;
  items?: SiteOrderItem[];
  billing?: any;
  shipping?: any;
  /** Forma de pagamento (slug WooCommerce — ex: "multibanco_ifthen_for_woocommerce"). */
  payment_method?: string;
  /** Forma de pagamento (rótulo amigável — ex: "Multibanco", "MB Way"). */
  payment_method_title?: string;
  /** URL para o cliente pagar (quando needs_payment=true). */
  payment_url?: string;
  /** ID da transacção. */
  transaction_id?: string;
  /** Linhas de envio (transportadora, custo). */
  shipping_lines?: SiteOrderShippingLine[];
  /** Linhas de imposto (IVA e taxas). */
  tax_lines?: SiteOrderTaxLine[];
  /** Meta data do WooCommerce (campos extra: _billing_NIF, _billing_entity_type, etc.). */
  meta_data?: SiteOrderMeta[];
  customer_note?: string;
  contact_id?: any;
  quotation_id?: string | null;
  source?: string;
  date_created?: string;
}

export const ORDER_STATUSES: { value: string; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "processing", label: "Em processamento" },
  { value: "on-hold", label: "Em espera" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
  { value: "refunded", label: "Reembolsada" },
  { value: "failed", label: "Falhada" },
];

const FIELDS =
  "id,wc_order_id,order_number,status,date_ordered,date_paid,date_completed,customer_name,customer_email,customer_phone,customer_nif,total,subtotal,discount_total,shipping_total,tax_total,coupon_codes,currency,items,billing,shipping,payment_method,payment_method_title,payment_url,transaction_id,shipping_lines,tax_lines,meta_data,customer_note,contact_id,quotation_id";

export async function listSiteOrders(params?: { status?: string; search?: string; page?: number; limit?: number }) {
  const search = params?.search?.trim();
  const filter: Record<string, any> = {};
  if (params?.status && params.status !== "all") filter["filter[status][_eq]"] = params.status;
  const r = await directusAdminFetch<{ data: SiteOrder[]; meta?: { filter_count?: number } }>(
    `/items/site_orders${qs({
      limit: params?.limit ?? 10,
      page: params?.page ?? 1,
      meta: "filter_count",
      sort: "-date_ordered",
      fields: FIELDS,
      ...(search ? { search } : {}),
      ...filter,
    })}`,
  );
  return { data: r?.data || [], total: r?.meta?.filter_count ?? (r?.data?.length || 0) };
}

export async function getSiteOrder(id: number | string) {
  const r = await directusAdminFetch<{ data: SiteOrder }>(`/items/site_orders/${encodeURIComponent(String(id))}${qs({ fields: "*" })}`);
  return r?.data || null;
}

export async function getSiteOrderByWcId(wcOrderId: number) {
  const r = await directusAdminFetch<{ data: SiteOrder[] }>(
    `/items/site_orders${qs({ "filter[wc_order_id][_eq]": wcOrderId, limit: 1, fields: "*" })}`,
  );
  return r?.data?.[0] || null;
}

export async function updateSiteOrder(id: number | string, patch: Partial<SiteOrder>) {
  const r = await directusAdminFetch<{ data: SiteOrder }>(`/items/site_orders/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return r.data;
}

export type SiteOrderStatusValue =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

/**
 * Helper dedicado para mudar só o status de uma encomenda.
 * Mais type-safe do que updateSiteOrder(id, { status }).
 */
export async function updateSiteOrderStatus(id: number | string, status: SiteOrderStatusValue) {
  return updateSiteOrder(id, { status });
}

export async function countSiteOrders(status?: string) {
  const filter = status && status !== "all" ? { "filter[status][_eq]": status } : {};
  const r = await directusAdminFetch<{ data: Array<{ count: number }> }>(
    `/items/site_orders${qs({ "aggregate[count]": "*", ...filter })}`,
  );
  return Number(r?.data?.[0]?.count || 0);
}

/**
 * Converte um pedido num orçamento/proposta (rascunho) e liga-os.
 * Devolve o id da proposta (string).
 *
 * Regras:
 *   • IVA é extraído por item de `order.tax_lines[]` (rate_percent). Se
 *     não houver tax_lines, fallback 23% (regime geral PT).
 *   • total_amount: prefere `order.total` (já com descontos + portes + IVA).
 *     Fallback: subtotal + shipping - discount + IVA discriminado por linha.
 *     Nunca `subtotal * 1.23` hardcoded.
 *   • meta_data do WooCommerce é preservada como `[WooMeta] key=value` nas
 *     notas da proposta, para auditoria.
 *   • **Idempotência**: se `order.quotation_id` já existir (clique duplo,
 *     retry, etc.), devolve esse id sem criar nova quotation.
 */
export async function convertOrderToProposal(order: SiteOrder): Promise<string> {
  // 1) Idempotência
  const existing = order.quotation_id ? String(order.quotation_id) : "";
  if (existing) return existing;

  const cid = typeof order.contact_id === "object" ? (order.contact_id as any)?.id : order.contact_id;
  const items = order.items || [];

  // 2) Calcular IVA por item a partir de tax_lines[]
  const fallbackRate: VatRate = 23;
  const itemVatRates = pickItemVatRates(items, order.tax_lines, fallbackRate);

  // 3) Calcular totais com IVA discriminado
  const { subtotal, taxByRate, totalAmount } = computeOrderTotals(items, itemVatRates, {
    orderSubtotal: order.subtotal,
    orderTotal: order.total,
    discountTotal: order.discount_total,
    shippingTotal: order.shipping_total,
  });

  // 4) Notas com auditoria + meta_data
  const notesLines: string[] = [];
  if (order.customer_note) notesLines.push(`Nota do Cliente: ${order.customer_note}`);
  notesLines.push(
    order.order_number
      ? `Convertido da Encomenda #${order.order_number}`
      : `Convertido da Encomenda ID ${order.id}`,
  );
  if (order.payment_method_title) {
    notesLines.push(`Método de Pagamento Original: ${order.payment_method_title}`);
  }
  // Meta-data do Woo (NIF faturação, entity_type, etc.) — auditoria
  const wooMeta = (order.meta_data || [])
    .filter((m) => m.key && m.value != null && String(m.value) !== "")
    .filter((m) => m.key.startsWith("_billing_") || m.key.startsWith("_shipping_"))
    .slice(0, 30);
  if (wooMeta.length > 0) {
    notesLines.push(`\n[WooMeta]\n${wooMeta.map((m) => `${m.key}=${m.value}`).join("\n")}`);
  }
  // Resumo IVA discriminado
  const vatSummary = Object.entries(taxByRate)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([rate, value]) => `${rate}%: €${value.toFixed(2)}`)
    .join(" | ");
  if (vatSummary) notesLines.push(`\n[IVA discriminado] ${vatSummary}`);
  if (order.coupon_codes?.length) {
    notesLines.push(`Cupões: ${order.coupon_codes.join(", ")}`);
  }

  // 5) Criar quotation + items
  const prop = await createQuotation({
    customer_id: cid ? String(cid) : undefined,
    status: "draft",
    subtotal: subtotal || 0,
    discount_amount: Number(order.discount_total) || undefined,
    total_amount: totalAmount,
    notes: notesLines.join("\n") || undefined,
  } as any);

  if (items.length > 0) {
    await createQuotationItems(
      items.map((it: any, idx: number) => ({
        quotation_id: prop.id,
        product_name: it.name || "Artigo",
        sku: it.sku || "",
        quantity: Number(it.qty || it.quantity || 1),
        unit_price: Number(it.price || it.unit_price || 0),
        line_total: Number(
          it.total || it.line_total || Number(it.price || 0) * Number(it.qty || 1),
        ),
        iva_percent: itemVatRates[idx] ?? fallbackRate,
        sort_order: idx,
      })),
    );
  }

  // 6) Ligar order → quotation
  await updateSiteOrder(order.id, { quotation_id: prop.id } as any);
  return prop.id;
}

/* ──────────────────────────────────────────────────────────────────────────
   IVA helpers — taxas legais PT: 0% (isenção), 6% (alimentar), 13%
   (restauração em alguns casos), 23% (regime geral). Aceitamos valores
   intermédios que o WooCommerce possa trazer, mas normalizamos para inteiros.
   ────────────────────────────────────────────────────────────────────────── */

export type VatRate = 0 | 6 | 13 | 23;

const KNOWN_RATES: VatRate[] = [0, 6, 13, 23];

/** Mapeia um valor de taxa (string/number) para VatRate conhecida. */
export function normalizeVatRate(value: number | string | null | undefined): VatRate {
  const n = Math.round(Number(value ?? 23));
  if ((KNOWN_RATES as number[]).includes(n)) return n as VatRate;
  // valores intermédios: arredondar ao conhecido mais próximo
  if (n <= 3) return 0;
  if (n <= 9) return 6;
  if (n <= 18) return 13;
  return 23;
}

/**
 * Atribui IVA por item a partir de tax_lines[] do WooCommerce.
 *  1. Se tax_lines vazio → fallback uniforme (regime geral).
 *  2. Se 1 taxa → todos os itens com essa taxa (regime simplificado).
 *  3. Se múltiplas taxas → distribuir pela ordem dos itens (1ª taxa → 1º item).
 */
export function pickItemVatRates(
  items: SiteOrderItem[],
  taxLines: SiteOrderTaxLine[] | undefined,
  fallbackRate: VatRate,
): VatRate[] {
  if (!items.length) return [];
  if (!taxLines || taxLines.length === 0) {
    return items.map(() => fallbackRate);
  }
  const rates = taxLines
    .map((t) => normalizeVatRate(t.rate_percent ?? fallbackRate))
    .filter((r) => r >= 0);
  if (rates.length === 0) return items.map(() => fallbackRate);
  if (rates.length === 1) {
    return items.map(() => rates[0]);
  }
  return items.map((_, idx) => rates[idx % rates.length]);
}

interface ComputeTotalsInput {
  orderSubtotal?: number;
  orderTotal?: number;
  discountTotal?: number | string;
  shippingTotal?: number | string;
}

interface ComputeTotalsResult {
  subtotal: number;
  /** Map: rate (string) → total de IVA em EUR */
  taxByRate: Record<string, number>;
  totalAmount: number;
}

/**
 * Calcula subtotal, IVA discriminado por taxa e total.
 *  • Se `orderTotal` existir, usa directamente como totalAmount.
 *  • Senão, soma (line × (1 + rate)) + shipping - discount.
 */
export function computeOrderTotals(
  items: SiteOrderItem[],
  itemVatRates: VatRate[],
  input: ComputeTotalsInput,
): ComputeTotalsResult {
  const taxByRate: Record<string, number> = {};
  let subtotal = 0;
  let totalWithTax = 0;

  items.forEach((it, idx) => {
    const lineTotal = Number(
      (it as any).total ||
        (it as any).line_total ||
        Number(it.price || 0) * Number(it.qty || it.quantity || 1),
    );
    const rate = itemVatRates[idx] ?? 23;
    const lineTax = lineTotal * (rate / 100);
    subtotal += lineTotal;
    totalWithTax += lineTotal + lineTax;
    taxByRate[String(rate)] = (taxByRate[String(rate)] || 0) + lineTax;
  });

  const discount = Number(input.discountTotal || 0);
  const shipping = Number(input.shippingTotal || 0);

  if (input.orderTotal && Number(input.orderTotal) > 0) {
    return {
      subtotal: subtotal || Number(input.orderSubtotal || 0),
      taxByRate,
      totalAmount: Number(input.orderTotal),
    };
  }

  return {
    subtotal: subtotal || Number(input.orderSubtotal || 0),
    taxByRate,
    totalAmount: Math.max(0, totalWithTax + shipping - discount),
  };
}

/** Envia um email (transacional) ao cliente do pedido, via crm-campaign-sender/SES. */
export async function sendOrderEmail(payload: { to: string; subject: string; message: string; customer_name?: string }) {
  const res = await fetch(`/campaign-api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-directus-token": DIRECTUS_ADMIN_TOKEN },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.detail || j?.error || `Falha ao enviar email (${res.status})`);
  return j;
}

/* ════════════════════════════════════════════════════════════════════════
   Tracking — portado de feat/crm-order-tracking (2026-08-23).
   O componente OrderTrackingEditor lê/grava tracking em billing.tracking (JSON).
   Stub local: se billing.tracking.endpoint estiver vazio, gravamos só no CRM
   (PATCH site_orders) sem chamar o WooCommerce. Assim funciona para qualquer
   encomenda, mesmo sem o webhook do site estar actualizado.
══════════════════════════════════════════════════════════════════════ */

export interface OrderTracking {
  carrier?: string;
  code?: string;
  url?: string;
  updated_at?: string;
  email_sent_at?: string;
  /** Endpoint exposto pelo site (webhook) para gravar tracking no WooCommerce. */
  endpoint?: string;
  /** Token de auth do endpoint Woo. */
  token?: string;
}

const TRACKING_FIELDS = [
  "carrier",
  "code",
  "url",
  "updated_at",
  "email_sent_at",
  "endpoint",
  "token",
] as const;

/** Lê o tracking do `billing.tracking` (ou `shipping.tracking`) de uma encomenda. */
export function getOrderTracking(order: Pick<SiteOrder, "billing" | "shipping"> | null | undefined): OrderTracking {
  const source: any =
    (order?.shipping && (order.shipping as any).tracking) ||
    (order?.billing && (order.billing as any).tracking) ||
    {};
  const result: OrderTracking = {};
  for (const key of TRACKING_FIELDS) {
    if (source[key] != null && source[key] !== "") result[key] = String(source[key]);
  }
  return result;
}

/** Lista encomendas de um contacto com tracking preenchido. */
export async function listSiteOrdersByContact(contactId: string | number, limit = 10): Promise<SiteOrder[]> {
  if (!contactId && contactId !== 0) return [];
  // contact_id é integer (verificado 2026-08-23 via directus_get_collection_fields)
  const r = await directusAdminFetch<{ data: SiteOrder[] }>(
    `/items/site_orders${qs({
      "filter[contact_id][_eq]": String(contactId),
      sort: "-date_ordered",
      limit,
      fields: FIELDS,
    })}`,
  );
  return r?.data || [];
}

export interface UpdateWooTrackingPayload {
  carrier?: string;
  tracking_code?: string;
  tracking_url?: string;
  /** Quando true, dispara email de expedição (só funciona se endpoint Woo estiver configurado). */
  send_email?: boolean;
}

export interface UpdateWooTrackingResult {
  ok: boolean;
  /** True se a encomenda foi gravada em WooCommerce (false = só CRM). */
  woo_synced: boolean;
  status?: number;
  email_sent?: boolean;
  email_duplicate?: boolean;
  reason?: string;
}

/**
 * Converte um pedido em **Oportunidade** (deal no pipeline) + **Proposta**
 * linkada. Idempotente — se já houver `quotation_id` na order, devolve o id
 * existente sem duplicar.
 *
 * Fluxo:
 *  1. Idempotência: se `order.quotation_id` já existe, devolver esse.
 *  2. Criar `deal` (status `lead`) com `customer_id` + `total_amount` da WC.
 *  3. Criar `quotation` via `convertOrderToProposal(order)`.
 *  4. Ligar `quotation.deal_id` = deal.id (PATCH) para a proposta aparecer
 *     no contexto do deal no pipeline.
 *  5. Audit: regista conversão no activity ledger (user_id/email do contexto).
 *
 * Devolve `{ dealId, quotationId }` para o caller poder navegar para qualquer
 * um dos dois.
 */
export async function convertOrderToDeal(
  order: SiteOrder,
  extra?: { user_id?: string; user_email?: string },
): Promise<{ dealId: string; quotationId: string }> {
  // 1) Idempotência
  if (order.quotation_id) {
    const existingQuotationId = String(order.quotation_id);
    // Buscar deal_id via quotation (se linkado)
    try {
      const res = await directusAdminFetch<{ data: { deal_id?: string | number } }>(
        `/items/${import.meta.env.VITE_DIRECTUS_QUOTATIONS_COLLECTION || "quotations"}/${encodeURIComponent(existingQuotationId)}?fields=deal_id`,
      );
      const dealId = res?.data?.deal_id ? String(res.data.deal_id) : "";
      if (dealId) return { dealId, quotationId: existingQuotationId };
    } catch {
      /* cai para o fluxo normal */
    }
    return { dealId: "", quotationId: existingQuotationId };
  }

  const cid = typeof order.contact_id === "object" ? (order.contact_id as any)?.id : order.contact_id;

  // 2) Criar deal (lead) com total da WC
  const totalAmount = Number(order.total) || 0;
  const deal = (await createDeal({
    title: order.order_number
      ? `Encomenda #${order.order_number} — ${order.customer_name || "Cliente"}`
      : `Encomenda #${order.id} — ${order.customer_name || "Cliente"}`,
    customer_id: cid ? String(cid) : undefined,
    status: "lead" as DealStatus,
    total_amount: totalAmount,
  } as Partial<DealRow>)) as DealRow | null;

  const dealId = (deal as any)?.id ? String((deal as any).id) : "";

  // 3) Criar quotation via função existente (passa a usar a versão com IVA real)
  const quotationId = await convertOrderToProposal(order);

  // 4) Ligar quotation.deal_id
  if (dealId && quotationId) {
    try {
      await patchQuotation(quotationId, { deal_id: dealId } as any);
    } catch (err) {
      console.warn("[site-orders] falha ao ligar quotation.deal_id", err);
    }
  }

  // 5) Audit (fire-and-forget — falhas não bloqueiam)
  await auditMutation(
    "site_orders",
    "update",
    null,
    { id: order.id, quotation_id: quotationId, deal_id: dealId, status: order.status },
    {
      source: "convert_order_to_deal",
      user_id: extra?.user_id,
      user_email: extra?.user_email,
    },
  );

  return { dealId, quotationId };
}

/**
 * Stub local: actualiza o tracking no CRM (billing.tracking).
 * Se `billing.tracking.endpoint` existir, chama também o endpoint Woo e envia email.
 */
export async function updateWooOrderTracking(
  order: SiteOrder,
  payload: UpdateWooTrackingPayload,
): Promise<UpdateWooTrackingResult> {
  const tracking = getOrderTracking(order);
  const nowIso = new Date().toISOString();
  const updated: OrderTracking = {
    ...tracking,
    carrier: payload.carrier ?? tracking.carrier,
    code: payload.tracking_code ?? tracking.code,
    url: payload.tracking_url ?? tracking.url,
    updated_at: nowIso,
    email_sent_at: payload.send_email ? nowIso : tracking.email_sent_at,
  };

  // 1. Gravar localmente no CRM (sempre)
  const billing = { ...(order.billing || {}), tracking: updated };
  await directusAdminFetch<{ data: SiteOrder }>(
    `/items/site_orders/${encodeURIComponent(String(order.id))}`,
    {
      method: "PATCH",
      body: JSON.stringify({ billing }),
    },
  );

  // 2. Se houver endpoint Woo configurado, chamar
  if (tracking.endpoint && tracking.token) {
    try {
      const res = await fetch(tracking.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-directus-token": DIRECTUS_ADMIN_TOKEN,
        },
        body: JSON.stringify({
          order_id: order.wc_order_id ?? order.id,
          token: tracking.token,
          carrier: updated.carrier,
          tracking_code: updated.code,
          tracking_url: updated.url,
          send_email: !!payload.send_email,
        }),
      });
      const j = await res.json().catch(() => ({} as any));
      return {
        ok: res.ok,
        woo_synced: !!res.ok,
        status: res.status,
        email_sent: !!j?.email_sent,
        email_duplicate: !!j?.email_duplicate,
        reason: j?.detail || j?.error,
      };
    } catch (e: any) {
      return {
        ok: false,
        woo_synced: false,
        reason: e?.message || String(e),
      };
    }
  }

  // Sem endpoint: tracking gravado só no CRM
  return {
    ok: true,
    woo_synced: false,
    email_sent: false,
    reason: "tracking gravado só no CRM (webhook Woo não configurado nesta encomenda)",
  };
}
