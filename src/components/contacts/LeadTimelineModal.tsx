/**
 * LeadTimelineModal — Modal que mostra a timeline completa de uma lead:
 * - Email threads ligadas (lead_id)
 * - Conversas WhatsApp ligadas (lead_id)
 * - Follow-ups associados (lead_id)
 * - Itens pedidos (lead_data.requested_items)
 */
import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, MessageCircle, CalendarClock, Package } from "lucide-react";
import { format } from "date-fns/format";
import { pt } from "date-fns/locale";

interface LeadTimelineModalProps {
  open: boolean;
  onClose: () => void;
  leadId: number;
  leadName: string;
  leadData?: Record<string, unknown> | null;
}

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "d MMM HH:mm", { locale: pt });
  } catch {
    return String(d);
  }
}

export function LeadTimelineModal({ open, onClose, leadId, leadName, leadData }: LeadTimelineModalProps) {
  // Fetch email threads linked to this lead
  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["lead-threads", leadId],
    queryFn: async () => {
      const res = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/email_threads?filter[lead_id][_eq]=${leadId}&sort=-date_created&limit=20&fields=id,subject,from_address,status,date_created,mailbox`
      );
      return res?.data ?? [];
    },
    enabled: open && !!leadId,
  });

  // Fetch conversations linked to this lead
  const { data: conversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ["lead-conversations", leadId],
    queryFn: async () => {
      const res = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/conversations?filter[lead_id][_eq]=${leadId}&sort=-updated_at&limit=20&fields=id,customer_name,source,channel,last_message,updated_at`
      );
      return res?.data ?? [];
    },
    enabled: open && !!leadId,
  });

  // Fetch follow-ups linked to this lead
  const { data: followUps = [], isLoading: fuLoading } = useQuery({
    queryKey: ["lead-followups", leadId],
    queryFn: async () => {
      const res = await directusRequest<{ data: Record<string, unknown>[] }>(
        `/items/follow_ups?filter[lead_id][_eq]=${leadId}&sort=-due_at&limit=20&fields=id,title,notes,due_at,status,type`
      );
      return res?.data ?? [];
    },
    enabled: open && !!leadId,
  });

  const isLoading = threadsLoading || convsLoading || fuLoading;

  // Parse lead_data.requested_items
  let requestedItems: string | null = null;
  if (leadData) {
    const items = leadData.requested_items || leadData.itens;
    if (typeof items === "string" && items.trim()) {
      requestedItems = items;
    } else if (Array.isArray(items) && items.length > 0) {
      requestedItems = items.join(", ");
    }
  }

  const hasContent = threads.length > 0 || conversations.length > 0 || followUps.length > 0 || requestedItems;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Timeline — {leadName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !hasContent ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sem atividade registada para esta lead.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            {/* Email threads */}
            {threads.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Mail className="h-3.5 w-3.5" /> Emails ({threads.length})
                </h3>
                <div className="space-y-1.5">
                  {threads.map((t) => (
                    <div key={String(t.id)} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-xs">
                          {String(t.subject || "(sem assunto)")}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          de {String(t.from_address)} · {fmt(t.date_created as string)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {String(t.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* WhatsApp conversations */}
            {conversations.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp ({conversations.length})
                </h3>
                <div className="space-y-1.5">
                  {conversations.map((c) => (
                    <div key={String(c.id)} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-xs">
                          {String(c.customer_name || c.source || "Conversa")}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {String(c.last_message || "").slice(0, 60)} · {fmt(c.updated_at as string)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Follow-ups */}
            {followUps.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <CalendarClock className="h-3.5 w-3.5" /> Follow-ups ({followUps.length})
                </h3>
                <div className="space-y-1.5">
                  {followUps.map((f) => (
                    <div key={String(f.id)} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-xs">
                          {String(f.title || f.notes || "Follow-up")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(f.due_at as string)}
                        </p>
                      </div>
                      <Badge variant={f.status === "done" ? "default" : "outline"} className="text-xs shrink-0">
                        {String(f.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Itens pedidos */}
            {requestedItems && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Package className="h-3.5 w-3.5" /> Itens pedidos
                </h3>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {requestedItems}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
