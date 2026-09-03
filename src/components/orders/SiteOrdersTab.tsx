import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Download, Package, FileSignature, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { listSiteOrders, getSiteOrderByWcId, ORDER_STATUSES, type SiteOrder } from "@/integrations/directus/site-orders";
import { OrderDetailModal } from "./OrderDetailModal";
import { StatusSelect } from "@/components/orders/StatusSelect";
const eur = (n?: number | null, cur = "EUR") => new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur || "EUR" }).format(Number(n) || 0);
const fmt = (d?: string | null) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("pt-PT"); } catch { return "—"; } };

export function SiteOrdersTab() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<SiteOrder | null>(null);
  const [exporting, setExporting] = useState(false);

  // deep-link: /pedidos?order=<wc_order_id> (vindo do push)
  useEffect(() => {
    const wcId = Number(searchParams.get("order"));
    if (!wcId) return;
    getSiteOrderByWcId(wcId).then((o) => {
      if (o) setSelected(o);
      setSearchParams({}, { replace: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounce da pesquisa
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 350); return () => clearTimeout(t); }, [searchInput]);
  // voltar à página 1 quando muda filtro/pesquisa/tamanho
  useEffect(() => { setPage(1); }, [search, status, pageSize]);

  const query = useQuery({
    queryKey: ["site_orders", status, search, page, pageSize],
    queryFn: () => listSiteOrders({ status, search, page, limit: pageSize }),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });
  const orders = query.data?.data || [];
  const total = query.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  async function exportXlsx() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const all = await listSiteOrders({ status, search, limit: -1 });
      const rows = all.data.map((o) => ({
        "Nº": o.order_number || o.wc_order_id,
        Cliente: o.customer_name || "",
        Email: o.customer_email || "",
        Telefone: o.customer_phone || "",
        NIF: o.customer_nif || "",
        Estado: label(o.status),
        Total: Number(o.total || 0),
        Moeda: o.currency || "EUR",
        Artigos: (o.items || []).length,
        Data: o.date_ordered ? new Date(o.date_ordered).toLocaleString("pt-PT") : "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Encomendas do site");
      XLSX.writeFile(wb, "encomendas-do-site.xlsx");
    } finally { setExporting(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Encomendas vindas de hotelequip.palamenta.com.pt. Clica num pedido para ver tudo, enviar email/WhatsApp ou converter em orçamento.</p>

      {/* filtros por estado */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setStatus("all")} className={`rounded-full px-3 py-1 text-xs font-medium ${status === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Todos</button>
        {ORDER_STATUSES.map((s) => (
          <button key={s.value} onClick={() => setStatus(s.value)} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s.label}</button>
        ))}
      </div>

      {/* barra: pesquisa + tamanho + exportar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Pesquisar por cliente, email ou nº…" className="pl-9" />
        </div>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>{[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["site_orders"] })}>
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="outline" onClick={exportXlsx} disabled={exporting || total === 0}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} Exportar
        </Button>
      </div>

      {/* lista */}
      <div className="grid gap-2">
        {query.isLoading ? (
          [...Array(pageSize > 10 ? 8 : pageSize)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : orders.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Sem pedidos {status !== "all" || search ? "para este filtro" : "ainda"}.</p>
          </CardContent></Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id} className="border cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelected(o)}>
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{o.customer_name || "(sem nome)"}</span>
                      <StatusSelect
                        mode="order"
                        id={o.id}
                        value={o.status}
                        options={ORDER_STATUSES}
                        queryKey={["site_orders", status, search, page, pageSize]}
                        onOptimistic={(next) => { o.status = next; }}
                        className="min-w-[140px]"
                      />
                      {o.quotation_id && <Badge variant="outline" className="text-xs gap-1"><FileSignature className="h-3 w-3" /> orçamento</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span>#{o.order_number || o.wc_order_id}</span>
                      <span>{(o.items || []).length} art.</span>
                      <span>{fmt(o.date_ordered || o.date_created)}</span>
                      {o.customer_email && <span className="truncate max-w-[180px]">{o.customer_email}</span>}
                    </div>
                  </div>
                  <div className="font-semibold whitespace-nowrap">{eur(o.total, o.currency)}</div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* paginação */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">{from}–{to} de {total}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <OrderDetailModal
        order={selected}
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        onConverted={() => qc.invalidateQueries({ queryKey: ["site_orders"] })}
      />
    </div>
  );
}
