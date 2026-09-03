import { directusRequest } from "@/integrations/directus/client";
import { qs } from "@/integrations/directus/utils";

/**
 * Camada de dados da aba Loja.
 * Encomendas: lê deals com woo_order_id (sincronizados pelo workflow n8n "Woo · Encomenda → CRM").
 * Carrinhos abandonados: preparado. A fonte depende do plugin de carrinhos (a confirmar).
 *   Quando a fonte existir (webhook n8n → coleção abandoned_carts, ou endpoint do plugin),
 *   liga-se aqui sem tocar na UI.
 */

export interface WooOrder {
  id: string;
  woo_order_id: number | null;
  title: string;
  total_amount: number;
  status: string;
  customer_name: string | null;
  customer_id: string | null;
  date_created: string;
}

export interface AbandonedCart {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_id: string | null;
  total: number;
  items_count: number;
  abandoned_at: string;
  recovery_sent: boolean;
}

export interface StoreStats {
  ordersToday: number;
  ordersMonth: number;
  revenueMonth: number;
  abandonedCarts: number;
  abandonedValue: number;
}

/** Encomendas Woo = deals com woo_order_id preenchido, mais recentes primeiro. */
export async function getWooOrders(limit = 100): Promise<WooOrder[]> {
  try {
    const query = qs({
      limit,
      sort: "-date_created",
      fields:
        "id,woo_order_id,title,total_amount,status,date_created,customer_id.id,customer_id.company_name,customer_id.full_name",
      "filter[woo_order_id][_nnull]": true,
    });
    const res = await directusRequest<{ data: any[] }>(`/items/deals?${query}`);
    return (res?.data ?? []).map((d) => ({
      id: String(d.id),
      woo_order_id: d.woo_order_id ?? null,
      title: d.title ?? `Encomenda #${d.woo_order_id ?? ""}`,
      total_amount: Number(d.total_amount ?? 0),
      status: d.status ?? "",
      customer_name:
        d.customer_id?.company_name || d.customer_id?.full_name || null,
      customer_id: d.customer_id?.id ? String(d.customer_id.id) : null,
      date_created: d.date_created ?? "",
    }));
  } catch {
    return [];
  }
}

/**
 * Carrinhos abandonados. Fonte a ligar conforme o plugin.
 * Enquanto não existir a coleção `abandoned_carts`, devolve [] (a UI mostra estado
 * "à espera de fonte", nunca erro).
 */
export async function getAbandonedCarts(limit = 100): Promise<AbandonedCart[]> {
  try {
    const query = qs({ limit, sort: "-abandoned_at" });
    const res = await directusRequest<{ data: any[] }>(
      `/items/abandoned_carts?${query}`,
    );
    return (res?.data ?? []).map((c) => ({
      id: String(c.id),
      customer_name: c.customer_name ?? null,
      customer_email: c.customer_email ?? null,
      customer_id: c.customer_id ? String(c.customer_id) : null,
      total: Number(c.total ?? 0),
      items_count: Number(c.items_count ?? 0),
      abandoned_at: c.abandoned_at ?? "",
      recovery_sent: !!c.recovery_sent,
    }));
  } catch {
    // Coleção ainda não existe (plugin por ligar) — não é erro.
    return [];
  }
}

export function computeStoreStats(
  orders: WooOrder[],
  carts: AbandonedCart[],
): StoreStats {
  const now = new Date();
  const isSameDay = (d: string) => {
    const x = new Date(d);
    return x.toDateString() === now.toDateString();
  };
  const isSameMonth = (d: string) => {
    const x = new Date(d);
    return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear();
  };
  return {
    ordersToday: orders.filter((o) => isSameDay(o.date_created)).length,
    ordersMonth: orders.filter((o) => isSameMonth(o.date_created)).length,
    revenueMonth: orders
      .filter((o) => isSameMonth(o.date_created))
      .reduce((s, o) => s + o.total_amount, 0),
    abandonedCarts: carts.length,
    abandonedValue: carts.reduce((s, c) => s + c.total, 0),
  };
}
