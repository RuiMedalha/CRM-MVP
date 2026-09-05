import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";

export interface RealCrmMetrics {
  contactsTotal: number;
  contactsWithEmail: number;
  contactsWithPhone: number;
  contactsWithWa: number;
  callsTotal: number;
  emailsTotal: number;
  emailsUnassigned: number;
  emailsGeral: number;
  emailsApoio: number;
  whatsappTotal: number;
  wa916Total: number;
  wa918Total: number;
  wa913Total: number;
  waGroupsTotal: number;
  ordersTotal: number;
  proposalsTotal: number;
  proposalsPending: number;
}

export function useRealCrmMetrics() {
  return useQuery<RealCrmMetrics>({
    queryKey: ["crm-real-metrics-aggregate"],
    queryFn: async () => {
      const [
        cTotal,
        cEmail,
        cPhone,
        cWa,
        callsTotal,
        emailTotal,
        emailUnassigned,
        emailGeral,
        emailApoio,
        waTotal,
        wa916Total,
        wa918Total,
        wa913Total,
        waGroupsTotal,
        ordersTotal,
        proposalsTotal,
        proposalsPending,
      ] = await Promise.all([
        directusRequest<any>("/items/contacts?aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/contacts?filter[email][_nnull]=true&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/contacts?filter[phone][_nnull]=true&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/contacts?filter[whatsapp_number][_nnull]=true&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/communication_events?filter[channel][_eq]=telecof&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/email_threads?aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/email_threads?filter[assigned_to][_null]=true&filter[status][_neq]=closed&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/email_threads?filter[mailbox][_eq]=geral@hotelequip.pt&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/email_threads?filter[mailbox][_eq]=apoio.cliente@hotelequip.pt&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/conversations?filter[channel][_in]=whatsapp,whatsapp_918,whatsapp_group&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/conversations?filter[instance_name][_eq]=hotelequip-916&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/conversations?filter[instance_name][_eq]=hotelequip-918&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/conversations?filter[instance_name][_eq]=hotelequip-913&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/conversations?filter[channel][_eq]=whatsapp_group&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/site_orders?aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/quotations?aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
        directusRequest<any>("/items/quotations?filter[status][_in]=sent,viewed&aggregate[count]=id").catch(() => ({ data: [{ count: { id: 0 } }] })),
      ]);

      return {
        contactsTotal: Number(cTotal.data?.[0]?.count?.id || 0),
        contactsWithEmail: Number(cEmail.data?.[0]?.count?.id || 0),
        contactsWithPhone: Number(cPhone.data?.[0]?.count?.id || 0),
        contactsWithWa: Number(cWa.data?.[0]?.count?.id || 0),
        callsTotal: Number(callsTotal.data?.[0]?.count?.id || 0),
        emailsTotal: Number(emailTotal.data?.[0]?.count?.id || 0),
        emailsUnassigned: Number(emailUnassigned.data?.[0]?.count?.id || 0),
        emailsGeral: Number(emailGeral.data?.[0]?.count?.id || 0),
        emailsApoio: Number(emailApoio.data?.[0]?.count?.id || 0),
        whatsappTotal: Number(waTotal.data?.[0]?.count?.id || 0),
        wa916Total: Number(wa916Total.data?.[0]?.count?.id || 0),
        wa918Total: Number(wa918Total.data?.[0]?.count?.id || 0),
        wa913Total: Number(wa913Total.data?.[0]?.count?.id || 0),
        waGroupsTotal: Number(waGroupsTotal.data?.[0]?.count?.id || 0),
        ordersTotal: Number(ordersTotal.data?.[0]?.count?.id || 0),
        proposalsTotal: Number(proposalsTotal.data?.[0]?.count?.id || 0),
        proposalsPending: Number(proposalsPending.data?.[0]?.count?.id || 0),
      };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
