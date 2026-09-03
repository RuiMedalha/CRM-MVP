/**
 * WooCommerce Enricher — busca dados completos de uma encomenda via proxy WP.
 *
 * Cache em sessionStorage (5min por id) para evitar martelar a API.
 *
 * Quando o Directus já tem os campos essenciais (`payment_method_title`,
 * `shipping_lines`), o enricher é skipped (skip automático via
 * `hasEssentialFields()`).
 *
 * Endpoint: GET https://www.hotelequip.pt/wp-json/heq/v1/order/<wc_order_id>
 *   definido em wp-content/mu-plugins/heq-crm-wc-proxy.php (criado em 2026-08-24).
 *   Devolve id, payment_method, payment_method_title, payment_url,
 *   transaction_id, date_paid, date_completed, billing, shipping,
 *   shipping_lines, tax_lines, meta_data.
 */
import type { SiteOrder } from "./site-orders";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5min
const CACHE_KEY = "crm-woo-enrich-cache";

type CacheEntry = { data: Partial<SiteOrder>; ts: number };

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
}

/** Verdade quando os campos essenciais já estão presentes no Directus. */
function hasEssentialFields(order: SiteOrder): boolean {
  return Boolean(order.payment_method_title || order.shipping_lines);
}

const FIELDS = "id,payment_method,payment_method_title,payment_url,transaction_id,date_paid,date_completed,billing,shipping,shipping_lines,tax_lines,meta_data";

/**
 * Enriquece um SiteOrder com campos que só existem no WooCommerce.
 * - Se o Directus já tem os campos essenciais, devolve `order` intacto.
 * - Senão, chama o proxy WP em heq-crm-wc-proxy (com cache 5min).
 */
export async function enrichSiteOrderFromWoo(order: SiteOrder): Promise<SiteOrder> {
  if (!order?.wc_order_id) return order;
  if (hasEssentialFields(order)) return order;

  // cache lookup
  const cache = readCache();
  const entry = cache[order.wc_order_id];
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
    return { ...order, ...entry.data };
  }

  // tenta o endpoint proxy do WordPress que dá os campos em falta.
  // Este endpoint está em wp-content/mu-plugins/heq-crm-wc-proxy.php e serve
  // GET /wp-json/heq/v1/order/<wc_order_id> com os campos completos (CORS-safe).
  let patch: Partial<SiteOrder> | null = null;
  try {
    const r = await fetch(`https://www.hotelequip.pt/wp-json/heq/v1/order/${order.wc_order_id}`);
    if (r.ok) {
      const data = await r.json();
      if (data?.id) {
        patch = {
          payment_method: data.payment_method,
          payment_method_title: data.payment_method_title,
          payment_url: data.payment_url,
          transaction_id: data.transaction_id,
          date_paid: data.date_paid,
          date_completed: data.date_completed,
          shipping: data.shipping,
          shipping_lines: data.shipping_lines,
          tax_lines: data.tax_lines,
          meta_data: data.meta_data,
        };
      }
    }
  } catch {
    // ignore
  }

  if (!patch) return order;

  cache[order.wc_order_id] = { data: patch, ts: Date.now() };
  writeCache(cache);

  return { ...order, ...patch };
}