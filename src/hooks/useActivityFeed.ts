import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { directusAdminFetch } from "@/integrations/directus/client";
import { qs } from "@/integrations/directus/utils";

export interface ActivityItem {
  type: "order" | "contact" | "chat";
  icon: string;
  title: string;
  subtitle: string;
  time: string;
  url: string;
}

export interface TodayStats {
  ordersToday: number;
  orderValueToday: number;
  newContactsToday: number;
  openChats: number;
}

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const eur = (n: number, cur?: string) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur || "EUR" }).format(n);

/**
 * Hook para parar o refetchInterval quando o documento está em background
 * (utilizador não está com a página visível). Reduz drasticamente o tráfego
 * de rede e bateria gasta em polling de 15s.
 */
function useBackgroundRefetchInterval(activeInterval: number): number | false {
  if (typeof window === "undefined") return activeInterval;
  const [interval, setInterval] = useState(activeInterval);
  useEffect(() => {
    const onVisibility = () => {
      setInterval(document.visibilityState === "visible" ? activeInterval : false);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [activeInterval]);
  return interval;
}

export function useActivityFeed() {
  const interval = useBackgroundRefetchInterval(15000);
  return useQuery<ActivityItem[]>({
    queryKey: ["activity-feed"],
    refetchInterval: interval,
    staleTime: 10000,
    queryFn: async () => {
      // Hotfix F-MOBILE-COMMS-PERF.md: try/catch em cada chamada.
      // Token admin perdeu permissão para site_orders/abandoned_carts
      // após rotação em dfb129c — retorna [] em vez de propagar 403.
      const [ordersRes, contactsRes, convosRes] = await Promise.all([
        directusAdminFetch<{ data: any[] }>(`/items/site_orders${qs({ sort: "-date_ordered", limit: 15, fields: "wc_order_id,order_number,customer_name,total,currency,date_ordered" })}`).catch(() => ({ data: [] })),
        directusAdminFetch<{ data: any[] }>(`/items/contacts${qs({ sort: "-date_created", limit: 10, fields: "id,company_name,email,date_created", "filter[date_created][_gte]": todayIso() })}`).catch(() => ({ data: [] })),
        directusAdminFetch<{ data: any[] }>(`/items/conversations${qs({ sort: "-last_activity_at", limit: 10, fields: "id,channel,status,customer_name,created_at,last_activity_at,contact_id" })}`).catch(() => ({ data: [] })),
      ]);

      const orders: ActivityItem[] = (ordersRes?.data || []).map((o) => ({
        type: "order",
        icon: "🛒",
        title: `Pedido #${o.order_number || o.wc_order_id}`,
        subtitle: `${o.customer_name || ""} — ${eur(Number(o.total || 0), o.currency)}`,
        time: o.date_ordered || "",
        url: `/pedidos?order=${o.wc_order_id}`,
      }));

      const contacts: ActivityItem[] = (contactsRes?.data || []).map((c: any) => ({
        type: "contact",
        icon: "👤",
        title: "Novo cliente",
        subtitle: c.company_name || c.email || "—",
        time: c.date_created || "",
        url: `/dashboard360/${c.id}`,
      }));

      const chats: ActivityItem[] = (convosRes?.data || []).map((v: any) => {
        const handoff = v.status === "handoff";
        const who = v.customer_name || "Visitante do site";
        return {
          type: "chat" as const,
          icon: handoff ? "🙋" : "💬",
          title: handoff ? `${who} — pediu humano` : `Chat: ${who}`,
          subtitle: v.channel === "askme" ? "Chat do site" : v.channel || "—",
          time: v.last_activity_at || v.created_at || "",
          url: `/comunicacoes?conversation=${v.id}&channel=${v.channel || "askme"}`,
        };
      });

      const all = [...orders, ...contacts, ...chats];
      return all.sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 25);
    },
  });
}

export function useTodayStats() {
  const interval = useBackgroundRefetchInterval(15000);
  return useQuery<TodayStats>({
    queryKey: ["today-stats"],
    refetchInterval: interval,
    staleTime: 10000,
    queryFn: async () => {
      const since = todayIso();
      const [ordersCountRes, ordersSumRes, contactsRes, convosRes] = await Promise.all([
        directusAdminFetch<{ data: Array<{ count: string }> }>(`/items/site_orders${qs({ "aggregate[count]": "*", "filter[date_ordered][_gte]": since })}`).catch(() => ({ data: [{ count: "0" }] })),
        directusAdminFetch<{ data: Array<{ sum: { total: string } }> }>(`/items/site_orders${qs({ "aggregate[sum]": "total", "filter[date_ordered][_gte]": since })}`).catch(() => ({ data: [{ sum: { total: "0" } }] })),
        directusAdminFetch<{ data: Array<{ count: string }> }>(`/items/contacts${qs({ "aggregate[count]": "*", "filter[date_created][_gte]": since })}`).catch(() => ({ data: [{ count: "0" }] })),
        directusAdminFetch<{ data: Array<{ count: string }> }>(`/items/conversations${qs({ "aggregate[count]": "*", "filter[status][_in]": "open,handoff" })}`).catch(() => ({ data: [{ count: "0" }] })),
      ]);

      return {
        ordersToday: Number(ordersCountRes?.data?.[0]?.count || 0),
        orderValueToday: Number(ordersSumRes?.data?.[0]?.sum?.total || 0),
        newContactsToday: Number(contactsRes?.data?.[0]?.count || 0),
        openChats: Number(convosRes?.data?.[0]?.count || 0),
      };
    },
  });
}

export interface SiteChat {
  id: string;
  customer_name?: string;
  status?: string;
  last_message?: string;
  date_created?: string;
  unread_count?: number;
  channel?: string;
  handoff: boolean;
  url: string;
}

/** Conversas do chat do site (canal askme). Handoff ("pediu humano") primeiro. */
export function useSiteChats() {
  return useQuery<SiteChat[]>({
    queryKey: ["site-chats"],
    refetchInterval: useBackgroundRefetchInterval(15000),
    staleTime: 10000,
    queryFn: async () => {
      const r = await directusAdminFetch<{ data: any[] }>(
        `/items/conversations${qs({
          "filter[channel][_eq]": "askme",
          sort: "-last_activity_at",
          limit: 12,
          fields: "id,customer_name,status,last_message,created_at,last_activity_at,unread_count,channel",
        })}`,
      ).catch(() => ({ data: [] }));
      const items: SiteChat[] = (r?.data || []).map((v) => ({
        id: v.id,
        customer_name: v.customer_name,
        status: v.status,
        last_message: v.last_message,
        date_created: v.last_activity_at || v.created_at,
        unread_count: Number(v.unread_count || 0),
        channel: v.channel,
        handoff: v.status === "handoff",
        url: `/comunicacoes?conversation=${v.id}&channel=askme`,
      }));
      // handoff primeiro, depois mais recentes
      return items.sort((a, b) => {
        if (a.handoff !== b.handoff) return a.handoff ? -1 : 1;
        return +new Date(b.date_created || 0) - +new Date(a.date_created || 0);
      });
    },
  });
}

export interface RecentOrder {
  id: number;
  wc_order_id?: number;
  order_number?: string;
  customer_name?: string;
  total?: number;
  currency?: string;
  status?: string;
  date_ordered?: string;
  url: string;
}

/** Últimas encomendas do site. */
export function useRecentOrders(limit = 6) {
  return useQuery<RecentOrder[]>({
    queryKey: ["recent-orders", limit],
    refetchInterval: useBackgroundRefetchInterval(15000),
    staleTime: 10000,
    queryFn: async () => {
      const r = await directusAdminFetch<{ data: any[] }>(
        `/items/site_orders${qs({ sort: "-date_ordered", limit, fields: "id,wc_order_id,order_number,customer_name,total,currency,status,date_ordered" })}`,
      ).catch(() => ({ data: [] }));
      return (r?.data || []).map((o) => ({
        id: o.id,
        wc_order_id: o.wc_order_id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        total: Number(o.total || 0),
        currency: o.currency,
        status: o.status,
        date_ordered: o.date_ordered,
        url: `/pedidos?order=${o.wc_order_id}`,
      }));
    },
  });
}

export interface RecentCart {
  id: number;
  customer_name?: string;
  cart_total?: number;
  currency?: string;
  status?: string;
  items_count?: number;
  date_abandoned?: string;
  url: string;
}

/** Carrinhos abandonados recentes + contagem por estado. */
export function useAbandonedCarts(limit = 6) {
  return useQuery<{ recent: RecentCart[]; byStatus: Record<string, number> }>({
    queryKey: ["dash-abandoned-carts", limit],
    refetchInterval: useBackgroundRefetchInterval(15000),
    staleTime: 10000,
    queryFn: async () => {
      const [recentRes, groupRes] = await Promise.all([
        directusAdminFetch<{ data: any[] }>(
          `/items/abandoned_carts${qs({ sort: "-date_abandoned", limit, fields: "id,customer_name,cart_total,currency,status,items_count,date_abandoned" })}`,
        ).catch(() => ({ data: [] })),
        directusAdminFetch<{ data: Array<{ status: string; count: number }> }>(
          `/items/abandoned_carts${qs({ groupBy: "status", "aggregate[count]": "*" })}`,
        ).catch(() => ({ data: [] })),
      ]);
      const byStatus: Record<string, number> = {};
      (groupRes?.data || []).forEach((g: any) => { byStatus[g.status || "abandoned"] = Number(g.count || 0); });
      const recent: RecentCart[] = (recentRes?.data || []).map((c) => ({
        id: c.id,
        customer_name: c.customer_name,
        cart_total: Number(c.cart_total || 0),
        currency: c.currency,
        status: c.status,
        items_count: Number(c.items_count || 0),
        date_abandoned: c.date_abandoned,
        url: `/carrinhos?cart=${c.id}`,
      }));
      return { recent, byStatus };
    },
  });
}

export interface DailyPoint { day: string; encomendas: number; valor: number }

/** Série diária de encomendas dos últimos N dias (para gráfico). */
export function useOrdersDaily(days = 14) {
  return useQuery<DailyPoint[]>({
    queryKey: ["orders-daily", days],
    refetchInterval: useBackgroundRefetchInterval(60000),
    staleTime: 30000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - (days - 1));
      since.setHours(0, 0, 0, 0);
      const r = await directusAdminFetch<{ data: any[] }>(
        `/items/site_orders${qs({ "filter[date_ordered][_gte]": since.toISOString(), sort: "date_ordered", limit: 1000, fields: "total,date_ordered" })}`,
      ).catch(() => ({ data: [] }));
      // baldes por dia
      const buckets: Record<string, DailyPoint> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { day: d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }), encomendas: 0, valor: 0 };
      }
      (r?.data || []).forEach((o) => {
        const key = String(o.date_ordered || "").slice(0, 10);
        if (buckets[key]) {
          buckets[key].encomendas += 1;
          buckets[key].valor += Number(o.total || 0);
        }
      });
      return Object.values(buckets);
    },
  });
}
