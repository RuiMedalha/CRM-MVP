import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Package, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { getOrderTracking, listSiteOrdersByContact } from "@/integrations/directus/site-orders";

export function ContactOrderTracking({ contactId }: { contactId: string | number }) {
  const query = useQuery({
    queryKey: ["site_orders", "contact", contactId],
    queryFn: () => listSiteOrdersByContact(contactId, 10),
    enabled: !!contactId,
  });

  if (query.isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A carregar encomendas...</div>;
  }

  const tracked = (query.data || []).filter((order) => {
    const tracking = getOrderTracking(order);
    return !!(tracking.code || tracking.url);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Tracking das encomendas</h3>
      </div>
      {tracked.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 py-5 text-center text-sm text-muted-foreground">Sem tracking associado.</div>
      ) : (
        <div className="divide-y rounded-lg border">
          {tracked.map((order) => {
            const tracking = getOrderTracking(order);
            return (
              <div key={order.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium"><Package className="h-4 w-4" /> Encomenda #{order.order_number || order.wc_order_id}</div>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{[tracking.carrier, tracking.code].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex gap-2">
                  {tracking.url && <a href={tracking.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Rastrear <ExternalLink className="h-3.5 w-3.5" /></a>}
                  <Link to={`/pedidos?order=${order.wc_order_id}`} className="text-xs font-medium text-primary hover:underline">Ver encomenda</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
