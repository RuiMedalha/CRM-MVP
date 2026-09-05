import { directusAdminFetch, DIRECTUS_ADMIN_TOKEN } from "@/integrations/directus/client";
import { qs } from "@/integrations/directus/utils";

/* ════════════════════════════════════════════════════════════════════════
   Carrinhos abandonados do site (coleção Directus abandoned_carts).
   Alimentada pelo WP (cart-recovery-crm.php): captura no cart/checkout,
   push ao admin após X min sem comprar. O CRM lê para recuperação ativa.
════════════════════════════════════════════════════════════════════════ */

export interface CartItem { name?: string; sku?: string; product_id?: number; qty?: number; price?: number; line_total?: number }

export interface AbandonedCart {
  id: number;
  wp_cart_id?: number;
  status?: string;
  customer_name?: string;
  email?: string;
  phone?: string;
  cart_total?: number;
  currency?: string;
  items_count?: number;
  items?: CartItem[];
  recovery_url?: string;
  page_url?: string;
  contact_id?: number | null;
  order_id?: number | null;
  date_abandoned?: string;
  date_created?: string;
}

export const CART_STATUSES: { value: string; label: string }[] = [
  { value: "abandoned", label: "Abandonado" },
  { value: "recovered", label: "Recuperado (clicou)" },
  { value: "converted", label: "Convertido (pedido)" },
];

const FIELDS =
  "id,wp_cart_id,status,customer_name,email,phone,cart_total,currency,items_count,items,recovery_url,page_url,contact_id,order_id,date_abandoned";

export async function listAbandonedCarts(params?: { status?: string; search?: string; page?: number; limit?: number }) {
  const search = params?.search?.trim();
  const filter: Record<string, any> = {};
  if (params?.status && params.status !== "all") filter["filter[status][_eq]"] = params.status;
  const r = await directusAdminFetch<{ data: AbandonedCart[]; meta?: { filter_count?: number } }>(
    `/items/abandoned_carts${qs({
      limit: params?.limit ?? 15,
      page: params?.page ?? 1,
      meta: "filter_count",
      sort: "-date_abandoned",
      fields: FIELDS,
      ...(search ? { search } : {}),
      ...filter,
    })}`,
  );
  return { data: r?.data || [], total: r?.meta?.filter_count ?? (r?.data?.length || 0) };
}

export async function getAbandonedCart(id: number | string) {
  const r = await directusAdminFetch<{ data: AbandonedCart }>(
    `/items/abandoned_carts/${encodeURIComponent(String(id))}${qs({ fields: "*" })}`,
  );
  return r?.data || null;
}

export type CartStatus = "abandoned" | "recovered" | "converted";

/**
 * Actualiza o status de um carrinho abandonado.
 * Usado pela UI para triagem manual: abandoned → recovered (clicou link) ou converted (virou pedido).
 */
export async function updateAbandonedCartStatus(id: number | string, status: CartStatus) {
  const r = await directusAdminFetch<{ data: AbandonedCart }>(
    `/items/abandoned_carts/${encodeURIComponent(String(id))}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  return r?.data || null;
}

/** Email de recuperação ao dono do carrinho (via crm-campaign-sender/SES). */
export async function sendCartEmail(payload: { to: string; subject: string; message: string; customer_name?: string }) {
  const res = await fetch(`/campaign-api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-directus-token": DIRECTUS_ADMIN_TOKEN },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.detail || j?.error || `Falha ao enviar email (${res.status})`);
  return j;
}

export async function listAbandonedCartsForCustomer(params: {
  contactId?: string | number;
  email?: string;
  phone?: string;
  limit?: number;
}): Promise<AbandonedCart[]> {
  const { contactId, email, phone, limit = 20 } = params;
  const queries: Promise<{ data: AbandonedCart[] } | null>[] = [];

  if (contactId !== undefined && contactId !== null && String(contactId).trim() !== "") {
    queries.push(
      directusAdminFetch<{ data: AbandonedCart[] }>(
        `/items/abandoned_carts${qs({
          "filter[contact_id][_eq]": String(contactId),
          sort: "-date_abandoned",
          limit,
          fields: FIELDS,
        })}`,
      ).catch(() => null),
    );
  }

  if (email && email.trim()) {
    queries.push(
      directusAdminFetch<{ data: AbandonedCart[] }>(
        `/items/abandoned_carts${qs({
          "filter[email][_eq]": email.trim(),
          sort: "-date_abandoned",
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
      directusAdminFetch<{ data: AbandonedCart[] }>(
        `/items/abandoned_carts${qs({
          "filter[phone][_contains]": digits.length >= 9 ? digits.slice(-9) : rawPhone,
          sort: "-date_abandoned",
          limit,
          fields: FIELDS,
        })}`,
      ).catch(() => null),
    );
  }

  if (queries.length === 0) return [];

  const results = await Promise.all(queries);
  const seen = new Set<number | string>();
  const carts: AbandonedCart[] = [];

  for (const r of results) {
    for (const c of r?.data || []) {
      const uid = c.id || c.wp_cart_id;
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      carts.push(c);
    }
  }

  return carts
    .sort((a, b) => {
      const da = a.date_abandoned ? new Date(a.date_abandoned).getTime() : 0;
      const db = b.date_abandoned ? new Date(b.date_abandoned).getTime() : 0;
      return db - da;
    })
    .slice(0, limit);
}
