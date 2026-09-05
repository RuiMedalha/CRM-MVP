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

/* ──────────────────────────────────────────────────────────────────────────
   IVA helpers — taxas legais PT: 0% (isenção), 6% (alimentar), 13%
   (restauração em alguns casos), 23% (regime geral). Aceitamos valores
   intermédios que o WooCommerce possa trazer, mas normalizamos para inteiros.
   ────────────────────────────────────────────────────────────────────────── */

export type VatRate = 0 | 6 | 13 | 23;

const KNOWN_RATES: VatRate[] = [0, 6, 13, 23];

export function normalizeVatRate(value: number | string | null | undefined): VatRate {
  const n = Math.round(Number(value ?? 23));
  if ((KNOWN_RATES as number[]).includes(n)) return n as VatRate;
  if (n <= 3) return 0;
  if (n <= 9) return 6;
  if (n <= 18) return 13;
  return 23;
}

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
  taxByRate: Record<string, number>;
  totalAmount: number;
}

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

export async function convertOrderToProposal(order: SiteOrder): Promise<string> {
  const existing = order.quotation_id ? String(order.quotation_id) : "";
  if (existing) return existing;

  const cid = typeof order.contact_id === "object" ? (order.contact_id as any)?.id : order.contact_id;
  const items = order.items || [];

  const fallbackRate: VatRate = 23;
  const itemVatRates = pickItemVatRates(items, order.tax_lines, fallbackRate);

  const { subtotal, taxByRate, totalAmount } = computeOrderTotals(items, itemVatRates, {
    orderSubtotal: order.subtotal,
    orderTotal: order.total,
    discountTotal: order.discount_total,
    shippingTotal: order.shipping_total,
  });

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
  const wooMeta = (order.meta_data || [])
    .filter((m) => m.key && m.value != null && String(m.value) !== "")
    .filter((m) => m.key.startsWith("_billing_") || m.key.startsWith("_shipping_"))
    .slice(0, 30);
  if (wooMeta.length > 0) {
    notesLines.push(`\n[WooMeta]\n${wooMeta.map((m) => `${m.key}=${m.value}`).join("\n")}`);
  }
  const vatSummary = Object.entries(taxByRate)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([rate, value]) => `${rate}%: €${value.toFixed(2)}`)
    .join(" | ");
  if (vatSummary) notesLines.push(`\n[IVA discriminado] ${vatSummary}`);
  if (order.coupon_codes?.length) {
    notesLines.push(`Cupões: ${order.coupon_codes.join(", ")}`);
  }

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

  await updateSiteOrder(order.id, { quotation_id: prop.id } as any);
  return prop.id;
}

export async function convertOrderToDeal(
  order: SiteOrder,
  extra?: { user_id?: string; user_email?: string },
): Promise<{ dealId: string; quotationId: string }> {
  if (order.quotation_id) {
    const existingQuotationId = String(order.quotation_id);
    try {
      const res = await directusAdminFetch<{ data: { deal_id?: string | number } }>(
        `/items/${import.meta.env.VITE_DIRECTUS_QUOTATIONS_COLLECTION || "quotations"}/${encodeURIComponent(existingQuotationId)}?fields=deal_id`,
      );
      const dealId = res?.data?.deal_id ? String(res.data.deal_id) : "";
      if (dealId) return { dealId, quotationId: existingQuotationId };
    } catch {
    }
    return { dealId: "", quotationId: existingQuotationId };
  }

  const cid = typeof order.contact_id === "object" ? (order.contact_id as any)?.id : order.contact_id;

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
  const quotationId = await convertOrderToProposal(order);

  if (dealId && quotationId) {
    try {
      await patchQuotation(quotationId, { deal_id: dealId } as any);
    } catch (err) {
      console.warn("[site-orders] falha ao ligar quotation.deal_id", err);
    }
  }

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

export async function listSiteOrdersForCustomer(params: {
  contactId?: string | number | null;
  email?: string | null;
  phone?: string | null;
  limit?: number;
}): Promise<SiteOrder[]> {
  const { contactId, email, phone, limit = 50 } = params;
  const queries: Promise<{ data: SiteOrder[] } | null>[] = [];

  if (contactId !== undefined && contactId !== null && String(contactId).trim() !== "") {
    queries.push(
      directusAdminFetch<{ data: SiteOrder[] }>(
        `/items/site_orders${qs({
          "filter[contact_id][_eq]": String(contactId),
          sort: "-date_ordered",
          limit,
          fields: FIELDS,
        })}`,
      ).catch(() => null),
    );
  }

  if (email && email.trim()) {
    queries.push(
      directusAdminFetch<{ data: SiteOrder[] }>(
        `/items/site_orders${qs({
          "filter[customer_email][_eq]": email.trim(),
          sort: "-date_ordered",
          limit,
          fields: FIELDS,
        })}`,
      ).catch(() => null),
    );
  }

  if (phone && phone.trim()) {
    const rawPhone = phone.trim();
    const digits = rawPhone.replace(/\D/g, "");
    queries.push(
      directusAdminFetch<{ data: SiteOrder[] }>(
        `/items/site_orders${qs({
          "filter[customer_phone][_icontains]": digits.length >= 9 ? digits.slice(-9) : rawPhone,
          sort: "-date_ordered",
          limit,
          fields: FIELDS,
        })}`,
      ).catch(() => null),
    );
  }

  if (queries.length === 0) return [];

  const results = await Promise.all(queries);
  const seen = new Set<number | string>();
  const orders: SiteOrder[] = [];

  for (const r of results) {
    for (const ord of r?.data || []) {
      const uid = ord.id || ord.wc_order_id;
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      orders.push(ord);
    }
  }

  return orders
    .sort((a, b) => {
      const da = a.date_ordered ? new Date(a.date_ordered).getTime() : 0;
      const db = b.date_ordered ? new Date(b.date_ordered).getTime() : 0;
      return db - da;
    })
    .slice(0, limit);
}

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

export interface OrderTracking {
  carrier?: string;
  code?: string;
  url?: string;
  updated_at?: string;
  email_sent_at?: string;
  endpoint?: string;
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

export interface UpdateWooTrackingPayload {
  carrier?: string;
  tracking_code?: string;
  tracking_url?: string;
  send_email?: boolean;
}

export interface UpdateWooTrackingResult {
  ok: boolean;
  woo_synced: boolean;
  status?: number;
  email_sent?: boolean;
  email_duplicate?: boolean;
  reason?: string;
}

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

  const billing = { ...(order.billing || {}), tracking: updated };
  await directusAdminFetch<{ data: SiteOrder }>(
    `/items/site_orders/${encodeURIComponent(String(order.id))}`,
    {
      method: "PATCH",
      body: JSON.stringify({ billing }),
    },
  );

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

  return {
    ok: true,
    woo_synced: false,
    email_sent: false,
    reason: "tracking gravado só no CRM (webhook Woo não configurado nesta encomenda)",
  };
}
