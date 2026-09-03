import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";

export type Customer360Event = { id: string; channel: string; title: string; summary?: string; occurredAt?: string };
export type Customer360Note = { id: string; body: string; pinned?: boolean; date_created?: string };

const rows = async (path: string) => (await directusRequest<{ data: any[] }>(path).catch(() => ({ data: [] }))).data || [];
const contactId = (value: any) => typeof value === "object" ? value?.id : value;
const event = (row: any, channel: string, title: string, summary?: string): Customer360Event => ({
  id: `${channel}-${row.id}`, channel, title, summary, occurredAt: row.occurred_at || row.start_time || row.date_created || row.date_ordered,
});

export function useCustomer360Remodeled(id?: string) {
  const client = useQueryClient();
  const key = ["customer360-remodeled", id];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error("Contacto não definido");
      const [contact, whatsapp, emails, calls, quotations, activity, orders, notes] = await Promise.all([
        directusRequest<{ data: any }>(`/items/contacts/${encodeURIComponent(id)}?fields=*`).then(r => r.data),
        rows(`/items/whatsapp_messages?filter[contact_id][_eq]=${encodeURIComponent(id)}&sort=-date_created&limit=50&fields=id,content,body,message,direction,date_created`),
        rows(`/items/email_threads?filter[contact_id][_eq]=${encodeURIComponent(id)}&sort=-date_created&limit=50&fields=id,subject,preview,from_address,date_created`),
        rows(`/items/Historico_Chamadas?filter[contact_id][_eq]=${encodeURIComponent(id)}&sort=-start_time&limit=50&fields=id,summary,ai_summary,direction,start_time,date_created`),
        rows(`/items/quotations?filter[customer_id][_eq]=${encodeURIComponent(id)}&sort=-date_created&limit=50&fields=id,quotation_number,status,total_amount,date_created`),
        rows(`/items/activity?filter[contact_id][_eq]=${encodeURIComponent(id)}&sort=-occurred_at,-date_created&limit=50&fields=id,type,channel,summary,occurred_at,date_created`),
        rows(`/items/site_orders?filter[contact_id][_eq]=${encodeURIComponent(id)}&sort=-date_ordered&limit=50&fields=id,order_number,wc_order_id,status,total,date_ordered,items`),
        rows(`/items/customer_notes?filter[contact_id][_eq]=${encodeURIComponent(id)}&sort=-pinned,-date_created&limit=100&fields=id,body,pinned,date_created`),
      ]);
      const timeline = [
        ...whatsapp.map(r => event(r, "whatsapp", r.direction === "outbound" ? "WhatsApp enviado" : "WhatsApp recebido", r.content || r.body || r.message)),
        ...emails.map(r => event(r, "email", r.subject || "Email", r.preview || r.from_address)),
        ...calls.map(r => event(r, "call", r.direction === "outbound" ? "Chamada efetuada" : "Chamada recebida", r.ai_summary || r.summary)),
        ...quotations.map(r => event(r, "proposal", `Proposta ${r.quotation_number || r.id}`, r.status)),
        ...activity.map(r => event(r, r.channel || r.type || "activity", r.summary || "Atividade", r.type)),
        ...notes.map(r => event(r, "note", "Nota", r.body)),
      ].sort((a, b) => String(b.occurredAt || "").localeCompare(String(a.occurredAt || "")));
      return { contact, timeline, quotations, orders, notes };
    },
    staleTime: 30_000,
    retry: 1,
  });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const createNote = useMutation({
    mutationFn: (body: string) => directusRequest("/items/customer_notes", { method: "POST", body: JSON.stringify({ contact_id: id, body, pinned: false }) }),
    onSuccess: refresh,
  });
  return { ...query, createNote: createNote.mutateAsync };
}
