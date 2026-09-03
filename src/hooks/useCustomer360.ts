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
        `/items/quotations?filter[customer_id][_eq]=${organizationId}&sort=-date_created&limit=20&fields=id,quotation_number,status,total_amount,sent_at,date_created`
      ).catch(() => ({ data: [] }));

      // 4. Timeline — Activity Ledger (fonte única) com fallback para queries legacy
      let allTimeline: Record<string, unknown>[] = [];

      // Tentar ler do activity ledger primeiro (Fase C)
      const activityRes = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/activity?filter[contact_id][_eq]=${organizationId}&sort=-occurred_at,-date_created&limit=30&fields=id,type,channel,direction,status,summary,occurred_at,source_collection,source_id,payload,date_created`
      ).catch(() => ({ data: [] as Record<string, unknown>[] }));

      if ((activityRes.data ?? []).length > 0) {
        // Activity ledger tem dados — usar como fonte única
        allTimeline = (activityRes.data ?? []).map((a) => ({
          ...a,
          _source: (a.source_collection as string) || "activity",
          created_at: a.occurred_at || a.date_created,
        }));
      } else {
        // Fallback: queries legacy (para contactos sem dados no activity ledger ainda)
        const [commEventsRes, interactionsRes, emailThreadsRes, conversationsRes] = await Promise.all([
          directusRequest<{ data: Record<string, unknown>[] }>(
            `/items/communication_events?filter[contact_int_id][_eq]=${organizationId}&sort=-created_at&limit=20&fields=id,channel,event_type,phone,direction,status,agent_name,created_at`
          ).catch(() => ({ data: [] as Record<string, unknown>[] })),
          directusRequest<{ data: Record<string, unknown>[] }>(
            `/items/interactions?filter[contact_id][_eq]=${organizationId}&sort=-date_created&limit=20&fields=id,type,direction,status,phone,email,display_name,occurred_at,date_created`
          ).catch(() => ({ data: [] as Record<string, unknown>[] })),
          directusRequest<{ data: Record<string, unknown>[] }>(
            `/items/email_threads?filter[contact_id][_eq]=${organizationId}&sort=-date_created&limit=10&fields=id,subject,from_address,status,date_created,mailbox`
          ).catch(() => ({ data: [] as Record<string, unknown>[] })),
          directusRequest<{ data: Record<string, unknown>[] }>(
            `/items/conversations?filter[contact_id][_eq]=${organizationId}&sort=-updated_at&limit=10&fields=id,customer_name,channel,last_message,source,updated_at`
          ).catch(() => ({ data: [] as Record<string, unknown>[] })),
        ]);

        allTimeline = [
          ...(commEventsRes.data ?? []).map((e) => ({ ...e, _source: "communication_events" })),
          ...(interactionsRes.data ?? []).map((e) => ({ ...e, _source: "interactions" })),
          ...(emailThreadsRes.data ?? []).map((e) => ({ ...e, _source: "email_threads", type: "email", title: `Email: ${e.subject || "(sem assunto)"}`, occurredAt: e.date_created })),
          ...(conversationsRes.data ?? []).map((e) => ({ ...e, _source: "conversations", type: "whatsapp", title: `WhatsApp: ${e.customer_name || e.last_message || "conversa"}`, occurredAt: e.updated_at, created_at: e.updated_at })),
        ].sort((a, b) => {
          const dateA = String(a.created_at || a.occurred_at || a.date_created || "");
          const dateB = String(b.created_at || b.occurred_at || b.date_created || "");
          return dateB.localeCompare(dateA);
        }).slice(0, 30);
      }

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
