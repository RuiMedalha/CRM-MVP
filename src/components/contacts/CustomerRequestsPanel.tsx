import { useMemo } from "react";
import { AlertCircle, CircleHelp, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useInteractions } from "@/hooks/useInteractions";

const REQUEST_TYPES = new Set(["information_request", "complaint", "support_request"]);

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-PT");
}

function typeMeta(type: string) {
  if (type === "complaint") {
    return { label: "Reclamação", icon: AlertCircle, className: "border-red-200 bg-red-50 text-red-700" };
  }
  if (type === "support_request") {
    return { label: "Assistência técnica", icon: Wrench, className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  return { label: "Pedido de informação", icon: CircleHelp, className: "border-blue-200 bg-blue-50 text-blue-700" };
}

/**
 * Painel de pedidos do site (reclamação / info / assistência).
 *
 * Pesquisa por **3 vectores em paralelo** (e deduplica por id):
 *   1. contact_id (mais fiável — preenchido pelo webhook do site)
 *   2. email (por vezes vazio)
 *   3. phone (mais universal)
 *
 * Port de feat/crm-order-tracking — estendido 2026-08-23 com fallback por
 * contact_id + phone, depois de detectar que 21/25 interactions têm email NULL.
 */
export function CustomerRequestsPanel({
  contactId,
  contactEmail,
  contactPhone,
}: {
  contactId?: string | number;
  contactEmail?: string;
  contactPhone?: string;
}) {
  const hasContactId = Boolean(contactId !== undefined && contactId !== null && String(contactId).trim() !== "");
  const hasEmail = Boolean(contactEmail && contactEmail.trim());
  const hasPhone = Boolean(contactPhone && contactPhone.trim());

  const byContactId = useInteractions(
    hasContactId ? { contactId: String(contactId), limit: 200, page: 1 } : undefined,
    { enabled: hasContactId }
  );
  const byEmail = useInteractions(
    hasEmail ? { email: contactEmail!.trim(), limit: 200, page: 1 } : undefined,
    { enabled: hasEmail }
  );
  const byPhone = useInteractions(
    hasPhone ? { phone: contactPhone!.trim(), limit: 200, page: 1 } : undefined,
    { enabled: hasPhone }
  );

  const loading = byContactId.isLoading || byEmail.isLoading || byPhone.isLoading;

  const requests = useMemo(() => {
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const source of [byContactId.data, byEmail.data, byPhone.data]) {
      for (const row of source || []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        merged.push(row);
      }
    }
    return merged.filter((row) => REQUEST_TYPES.has(String(row.type || "")));
  }, [byContactId.data, byEmail.data, byPhone.data]);

  if (loading) {
    return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  }

  if (!requests.length) {
    return (
      <div className="rounded-lg border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
        Este cliente ainda não enviou pedidos pelo site.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const meta = typeMeta(String(request.type || ""));
        const Icon = meta.icon;
        const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
        return (
          <Card key={request.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{request.summary || meta.label}</span>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                    <Badge variant={request.status === "done" ? "secondary" : "outline"}>
                      {request.status === "done" ? "Concluído" : "Aberto"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDate(request.occurred_at || request.date_created)}</span>
                    {payload.reference ? <span>Referência: {String(payload.reference)}</span> : null}
                    {request.email ? <span>{request.email}</span> : null}
                    {request.phone ? <span>{request.phone}</span> : null}
                  </div>
                  {payload.text ? (
                    <div className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">{String(payload.text)}</div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
