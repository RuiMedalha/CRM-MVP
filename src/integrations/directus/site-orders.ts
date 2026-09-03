import { directusAdminFetch, DIRECTUS_ADMIN_TOKEN } from "@/integrations/directus/client";
import { qs } from "@/integrations/directus/utils";
import { createQuotation, createQuotationItems } from "@/integrations/directus/quotations";

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

/** Converte um pedido num orçamento/proposta (rascunho) e liga-os. Devolve o id da proposta (string). */
export async function convertOrderToProposal(order: SiteOrder): Promise<string> {
  const cid = typeof order.contact_id === "object" ? (order.contact_id as any)?.id : order.contact_id;
  const items = order.items || [];
  const subtotal = items.reduce((s, i) => s + Number((i as any).total || (i as any).line_total || 0), 0);
  const prop = await createQuotation({
    customer_id: cid ? String(cid) : undefined,
    status: "draft",
    subtotal,
    notes: order.customer_note || undefined,
  } as any);
  await createQuotationItems(
    items.map((it: any, idx: number) => ({
      quotation_id: prop.id,
      product_name: it.name || "",
      sku: it.sku || "",
      quantity: Number(it.qty || 1),
      unit_price: Number(it.price || 0),
      line_total: Number(it.total || it.line_total || 0),
      iva_percent: 23,
      sort_order: idx,
    })),
  );
  await updateSiteOrder(order.id, { quotation_id: prop.id } as any);
  return prop.id;
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
