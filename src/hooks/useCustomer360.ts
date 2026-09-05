/**
 * useCustomer360 — hook para carregar dados consolidados de uma Organization.
 *
 * Usa os serviços existentes do Directus (contacts, deals, quotations)
 * e transforma via adapter para Customer360Data.
 */

import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import { buildCustomer360Data } from "@/adapters/customer360Adapter";
import type { Customer360Data } from "@/types/customer360";

interface UseCustomer360Result {
  data: Customer360Data | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * @param organizationId — ID da organização (= contacts.id no Directus actual).
 * O Customer360 é SEMPRE centrado na Organization, nunca num contacto individual.
 * No schema actual, a tabela "contacts" funciona como tabela de organizações.
 */
export function useCustomer360(organizationId: string | undefined): UseCustomer360Result {
  const query = useQuery({
    queryKey: ["customer360", organizationId],
    queryFn: async (): Promise<Customer360Data> => {
      if (!organizationId) throw new Error("ID da organização não definido");

      // 1. Fetch organization (contacts.id = organizationId no schema actual)
      const orgRes = await directusRequest<{ data: Record<string, unknown> }>(
        `/items/contacts/${encodeURIComponent(organizationId)}?fields=*`
      );
      if (!orgRes?.data) throw new Error("Organização não encontrada");

      // 2. Fetch deals (opportunities) for this organization
      const dealsRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/deals?filter[customer_id][_eq]=${organizationId}&sort=-date_created&limit=20&fields=id,title,status,total_amount,assigned_employee_id,date_created`
      ).catch(() => ({ data: [] }));

      // 3. Fetch quotations (proposals) for this organization
      const proposalsRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/quotations?filter[customer_id][_eq]=${organizationId}&sort=-date_created&limit=20&fields=id,quotation_number,status,total_amount,sent_at,viewed_at,approved_at,notes,date_created`
      ).catch(() => ({ data: [] }));

      // Extract search parameters from organization/contact
      const org = orgRes.data;
      const rawPhone = String(org.phone || org.mobile_phone || org.contact_phone || "");
      const phoneDigits = rawPhone.replace(/\D/g, "");
      const phoneTail = phoneDigits.slice(-9);
      const cleanEmail = String(org.email || org.contact_email || "").trim().toLowerCase();
      const companyName = String(org.company_name || "").trim();
      const contactName = String(org.contact_name || "").trim();

      // 4. Fetch site orders for this customer (eCommerce orders)
      let ordersFilter = `filter[_or][0][contact_id][_eq]=${organizationId}`;
      let ordIdx = 1;
      if (cleanEmail) {
        ordersFilter += `&filter[_or][${ordIdx++}][customer_email][_eq]=${encodeURIComponent(cleanEmail)}`;
      }
      if (phoneTail.length >= 6) {
        ordersFilter += `&filter[_or][${ordIdx++}][customer_phone][_contains]=${phoneTail}`;
      }

      const siteOrdersRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/site_orders?${ordersFilter}&sort=-date_ordered&limit=15&fields=id,order_number,status,total,currency,date_ordered,items,customer_note`
      ).catch(() => ({ data: [] as Record<string, unknown>[] }));

      const orderEvents = (siteOrdersRes.data ?? []).map((o) => {
        const orderNum = o.order_number || o.id;
        const totalEur = Number(o.total || 0).toLocaleString("pt-PT", { style: "currency", currency: (o.currency as string) || "EUR" });
        const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
        return {
          id: `order-${o.id}`,
          type: "order",
          title: `Encomenda #${orderNum} — ${totalEur}`,
          description: `Estado: ${o.status || "registada"}${itemsCount > 0 ? ` · ${itemsCount} artigo(s)` : ""}${o.customer_note ? ` · Nota: ${String(o.customer_note).slice(0, 60)}` : ""}`,
          occurred_at: o.date_ordered,
          occurredAt: o.date_ordered,
          actor: "Loja Online",
          _source: "site_orders",
        };
      });

      // 4b. Fetch abandoned carts for this customer
      let cartFilter = `filter[_or][0][contact_id][_eq]=${organizationId}`;
      let crtIdx = 1;
      if (cleanEmail) {
        cartFilter += `&filter[_or][${crtIdx++}][email][_eq]=${encodeURIComponent(cleanEmail)}`;
      }
      if (phoneTail.length >= 6) {
        cartFilter += `&filter[_or][${crtIdx++}][phone][_contains]=${phoneTail}`;
      }

      const cartsRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/abandoned_carts?${cartFilter}&sort=-date_abandoned&limit=10&fields=id,wp_cart_id,status,cart_total,currency,items_count,items,recovery_url,date_abandoned`
      ).catch(() => ({ data: [] as Record<string, unknown>[] }));

      const cartEvents = (cartsRes.data ?? []).map((c) => {
        const totalEur = Number(c.cart_total || 0).toLocaleString("pt-PT", { style: "currency", currency: (c.currency as string) || "EUR" });
        const itemsCount = Number(c.items_count) || (Array.isArray(c.items) ? c.items.length : 0);
        const statusLabel = c.status === "converted" ? "Convertido em encomenda" : (c.status === "recovered" ? "Recuperado" : "Abandonado");
        return {
          id: `cart-${c.id}`,
          type: "cart",
          title: `🛒 Carrinho ${statusLabel} — ${totalEur}`,
          description: `${itemsCount} artigo(s) no carrinho${c.recovery_url ? ` · Link: ${c.recovery_url}` : ""}`,
          occurred_at: (c.date_abandoned as string) || (c.date_created as string),
          occurredAt: (c.date_abandoned as string) || (c.date_created as string),
          actor: "Loja Online (WooCommerce)",
          _source: "abandoned_carts",
        };
      });

      // 5. Fetch Activity Ledger (if any)
      const activityRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/activity?filter[contact_id][_eq]=${organizationId}&sort=-occurred_at,-date_created&limit=30&fields=id,type,channel,direction,status,summary,occurred_at,source_collection,source_id,payload,date_created`
      ).catch(() => ({ data: [] as Record<string, unknown>[] }));

      const activityEvents = (activityRes.data ?? []).map((a) => ({
        ...a,
        _source: (a.source_collection as string) || "activity",
        created_at: a.occurred_at || a.date_created,
        occurredAt: a.occurred_at || a.date_created,
      }));

      // 6. Fetch Communication Events (Telecof / CTI Calls)
      let commFilter = `filter[_or][0][contact_int_id][_eq]=${organizationId}`;
      let cIdx = 1;
      if (phoneTail.length >= 6) {
        commFilter += `&filter[_or][${cIdx++}][phone][_contains]=${phoneTail}`;
        commFilter += `&filter[_or][${cIdx++}][normalized_phone][_contains]=${phoneTail}`;
      }
      if (companyName.length >= 4) {
        commFilter += `&filter[_or][${cIdx++}][customer_name][_contains]=${encodeURIComponent(companyName)}`;
      }

      const commEventsRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/communication_events?${commFilter}&sort=-created_at&limit=25&fields=id,channel,event_type,phone,direction,status,agent_name,created_at,started_at,duration,customer_name,short_message`
      ).catch(() => ({ data: [] as Record<string, unknown>[] }));

      const callEvents = (commEventsRes.data ?? []).map((e) => {
        const isIncoming = e.direction === "inbound" || e.direction === "in";
        const isMissed = e.status === "unhandled" || e.status === "missed" || !e.status;
        const statusLabel = isMissed ? "Não atendida / perdida" : (e.status === "answered" ? "Atendida" : String(e.status));
        const phoneFormatted = (e.phone as string) || rawPhone || "";
        const durationLabel = e.duration ? ` · ${e.duration}s` : "";
        const customerLabel = e.customer_name ? ` · ${e.customer_name}` : "";
        return {
          id: `call-${e.id}`,
          type: "phone",
          channel: "phone",
          title: `${isIncoming ? "📞 Chamada recebida" : "📞 Chamada efetuada"} (${phoneFormatted})`,
          description: `Estado: ${statusLabel}${durationLabel}${customerLabel}`,
          occurred_at: (e.started_at as string) || (e.created_at as string),
          occurredAt: (e.started_at as string) || (e.created_at as string),
          actor: (e.agent_name as string) || "Telecof CTI",
          _source: "communication_events",
        };
      });

      // 7. Fetch Conversations & Messages (WhatsApp / Askme / Web Chat)
      let convFilter = `filter[_or][0][contact_id][_eq]=${organizationId}`;
      let cvIdx = 1;
      if (phoneTail.length >= 6) {
        convFilter += `&filter[_or][${cvIdx++}][source][_contains]=${phoneTail}`;
        convFilter += `&filter[_or][${cvIdx++}][customer_name][_contains]=${phoneTail}`;
      }
      if (contactName.length >= 3) {
        convFilter += `&filter[_or][${cvIdx++}][customer_name][_contains]=${encodeURIComponent(contactName)}`;
      }

      const conversationsRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/conversations?${convFilter}&sort=-updated_at&limit=10&fields=id,customer_name,channel,last_message,source,updated_at,created_at`
      ).catch(() => ({ data: [] as Record<string, unknown>[] }));

      const convList = conversationsRes.data ?? [];
      const convIds = convList.map((c) => String(c.id)).filter(Boolean);

      let messageEvents: Record<string, unknown>[] = [];
      if (convIds.length > 0) {
        const messagesRes = await directusRequest<{ data: Record<string, unknown>[] }>(
          `/items/messages?filter[conversation_id][_in]=${convIds.join(",")}&sort=-created_at&limit=50&fields=id,conversation_id,sender_name,sender_type,content,created_at`
        ).catch(() => ({ data: [] as Record<string, unknown>[] }));

        if ((messagesRes.data ?? []).length > 0) {
          messageEvents = (messagesRes.data ?? []).map((m) => {
            const isCustomer = m.sender_type === "customer";
            const sender = (m.sender_name as string) || (isCustomer ? (contactName || "Cliente") : "Assistente");
            return {
              id: `msg-${m.id}`,
              type: "whatsapp",
              channel: "whatsapp",
              title: `💬 Mensagem: ${sender}`,
              description: String(m.content || ""),
              occurred_at: m.created_at as string,
              occurredAt: m.created_at as string,
              actor: sender,
              _source: "messages",
            };
          });
        }
      }

      if (messageEvents.length === 0 && convList.length > 0) {
        messageEvents = convList.map((c) => ({
          id: `conv-${c.id}`,
          type: "whatsapp",
          channel: "whatsapp",
          title: `💬 Conversa: ${c.customer_name || contactName || "Cliente"}`,
          description: c.last_message ? String(c.last_message) : undefined,
          occurred_at: (c.updated_at as string) || (c.created_at as string),
          occurredAt: (c.updated_at as string) || (c.created_at as string),
          actor: (c.customer_name as string) || "WhatsApp",
          _source: "conversations",
        }));
      }

      // 8. Fetch Email Threads
      let emailFilter = `filter[_or][0][contact_id][_eq]=${organizationId}`;
      let emIdx = 1;
      if (cleanEmail) {
        emailFilter += `&filter[_or][${emIdx++}][from_address][_icontains]=${encodeURIComponent(cleanEmail)}`;
        emailFilter += `&filter[_or][${emIdx++}][to_address][_icontains]=${encodeURIComponent(cleanEmail)}`;
      }

      const emailThreadsRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/email_threads?${emailFilter}&sort=-date_created&limit=15&fields=id,subject,from_address,to_address,status,date_created,mailbox`
      ).catch(() => ({ data: [] as Record<string, unknown>[] }));

      const emailEvents = (emailThreadsRes.data ?? []).map((t) => ({
        id: `email-${t.id}`,
        type: "email",
        channel: "email",
        title: `📧 Email: ${t.subject || "(sem assunto)"}`,
        description: `De: ${t.from_address || "—"} | Para: ${t.to_address || "Hotelequip"}`,
        occurred_at: t.date_created as string,
        occurredAt: t.date_created as string,
        actor: (t.from_address as string) || "Email",
        _source: "email_threads",
      }));

      // 9. Fetch Interactions
      let interFilter = `filter[_or][0][contact_id][_eq]=${organizationId}`;
      let inIdx = 1;
      if (phoneTail.length >= 6) {
        interFilter += `&filter[_or][${inIdx++}][phone][_contains]=${phoneTail}`;
      }
      if (cleanEmail) {
        interFilter += `&filter[_or][${inIdx++}][email][_icontains]=${encodeURIComponent(cleanEmail)}`;
      }

      const interactionsRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/interactions?${interFilter}&sort=-date_created&limit=20&fields=id,type,direction,status,phone,email,display_name,occurred_at,date_created,summary,notes`
      ).catch(() => ({ data: [] as Record<string, unknown>[] }));

      const interactionEvents = (interactionsRes.data ?? []).map((i) => ({
        ...i,
        _source: "interactions",
        occurred_at: (i.occurred_at as string) || (i.date_created as string),
        occurredAt: (i.occurred_at as string) || (i.date_created as string),
        title: (i.summary as string) || (i.display_name as string) || `Interação (${i.type || "nota"})`,
        description: (i.notes as string) || (i.summary as string) || undefined,
      }));

      // 10. Consolidate and Deduplicate All Timeline Events
      const seenIds = new Set<string>();
      const allTimeline: Record<string, unknown>[] = [];

      for (const ev of [
        ...activityEvents,
        ...callEvents,
        ...messageEvents,
        ...emailEvents,
        ...interactionEvents,
        ...orderEvents,
        ...cartEvents,
      ]) {
        const key = String(ev.id || `${ev.type}-${ev.occurredAt || ev.occurred_at}`);
        if (!seenIds.has(key)) {
          seenIds.add(key);
          allTimeline.push(ev);
        }
      }

      allTimeline.sort((a, b) => {
        const dateA = String(a.occurredAt || a.occurred_at || a.created_at || a.date_created || "");
        const dateB = String(b.occurredAt || b.occurred_at || b.created_at || b.date_created || "");
        return dateB.localeCompare(dateA);
      });

      // 5. Contacts — no modelo actual, a org IS the contact (mesma tabela)
      const contacts = [{ ...orgRes.data, is_primary: true }];

      return buildCustomer360Data(
        orgRes.data,
        contacts as Record<string, unknown>[],
        allTimeline as Record<string, unknown>[],
        (dealsRes.data ?? []) as Record<string, unknown>[],
        (proposalsRes.data ?? []) as Record<string, unknown>[],
      );
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : "Erro ao carregar") : null,
  };
}
