import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { listQuotations, duplicateQuotation } from "@/integrations/directus/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Plus, Search, Eye, Copy, MoreHorizontal, Loader2, MessageCircle, ExternalLink, FileText, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { QuotationCreator } from "@/components/quotations/QuotationCreator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useContacts } from "@/hooks/useContacts";
import type { ContactItem } from "@/integrations/directus/contacts";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

const TYPE_TABS = [
  { value: "all", label: "Todas" },
  { value: "proposal", label: "Propostas Interativas" },
  { value: "quotation", label: "Orçamentos Rápidos" },
];

const STATUS_TABS = [
  { value: "all", label: "Todas" },
  { value: "draft", label: "Rascunho" },
  { value: "sent", label: "Enviadas" },
  { value: "viewed", label: "Vistas" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Rejeitadas" },
  { value: "expired", label: "Expiradas" },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  sent: { label: "Enviada", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  viewed: { label: "Vista", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  approved: { label: "Aprovada", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  rejected: { label: "Rejeitada", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  converted: { label: "Convertida", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  expired: { label: "Expirada", className: "bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400" },
};

function detectDocType(q: any): "proposal" | "quotation" {
  const num = String(q.quotation_number || "");
  if (num.startsWith("ORC-")) return "quotation";
  if (num.startsWith("PRP-")) return "proposal";
  return q.document_type === "quotation" ? "quotation" : "proposal";
}

export default function Propostas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [openCreateChooser, setOpenCreateChooser] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [createFor, setCreateFor] = useState<{ id: string; name: string } | null>(null);

  // Tipo de documento: "todas" | "proposta" | "orcamento" — lê da query string ?tipo=
  const tipoParam = searchParams.get("tipo");
  const docTypeFilter: "all" | "proposal" | "quotation" =
    tipoParam === "orcamento"
      ? "quotation"
      : tipoParam === "proposta"
        ? "proposal"
        : "all";

  // Sincroniza ?tipo= na URL sempre que o utilizador muda o filtro
  useEffect(() => {
    const current = searchParams.get("tipo");
    const desired = docTypeFilter === "all" ? null : docTypeFilter;
    if ((current ?? null) !== desired) {
      const next = new URLSearchParams(searchParams);
      if (desired) next.set("tipo", desired);
      else next.delete("tipo");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docTypeFilter]);

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["propostas", searchQuery],
    queryFn: () => listQuotations({ search: searchQuery, limit: 200 }),
  });

  // Sem fragmentação: lista única, filtrada por tipo (proposta/orcamento) e por status
  const items = (quotations as any[])
    .map((q: any) => ({ ...q, _docType: detectDocType(q) }))
    .sort((a: any, b: any) => Number(b.id || 0) - Number(a.id || 0));

  const byType = docTypeFilter === "all"
    ? items
    : items.filter((q: any) => q._docType === docTypeFilter);

  const filtered = activeTab === "all"
    ? byType
    : byType.filter((q: any) => q.status === activeTab);

  const contactsQuery = useContacts(openCreateChooser ? contactSearch : "");
  const contacts = (contactsQuery.data || []) as ContactItem[];

  const handleDuplicate = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDuplicatingId(id);
    try {
      const duplicated = await duplicateQuotation(id);
      toast({
        title: "Proposta duplicada!",
        description: `Criada nova proposta ${duplicated.quotation_number || "em rascunho"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      navigate(`/propostas/${duplicated.id}/detalhe`);
    } catch (err) {
      toast({
        title: "Erro ao duplicar proposta",
        description: String((err as Error)?.message || err),
        variant: "destructive",
      });
    } finally {
      setDuplicatingId(null);
    }
  }, [navigate, queryClient]);

  return (
    <AppLayout>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl md:text-2xl font-semibold">Propostas</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                Nova
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onSelect={() => navigate("/propostas/nova")}>
                <Sparkles className="h-4 w-4 mr-2 text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium">Proposta Interativa Completa</span>
                  <span className="text-xs text-muted-foreground">Wizard 8 passos</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenCreateChooser(true)}>
                <FileText className="h-4 w-4 mr-2 text-amber-500" />
                <div className="flex flex-col">
                  <span className="font-medium">Orçamento Rápido</span>
                  <span className="text-xs text-muted-foreground">1 folha, cliente + itens</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar propostas e orçamentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Type tabs (Sprint F: Todas / Propostas Interativas / Orçamentos Rápidos) */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                if (tab.value === "all") setSearchParams({}, { replace: true });
                else setSearchParams({ tipo: tab.value }, { replace: true });
              }}
              className={cn(
                "px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors",
                docTypeFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors border border-transparent",
                activeTab === tab.value
                  ? "bg-secondary text-secondary-foreground border-border"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <Card>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma proposta encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q: any) => {
                  const status = statusConfig[q.status] || statusConfig.draft;
                  const customerName =
                    q.customer_name ||
                    q.customer_company ||
                    q.customer_id?.company_name ||
                    q.customer_id?.contact_name ||
                    "—";
                  const displayDate = q.date_created || q.date_updated;
                  const baseUrl = import.meta.env.VITE_PROPOSALS_BASE_URL || "https://proposta.hotelequip.pt";
                  const proposalUrl = q.public_token
                    ? `${baseUrl}/p/${q.public_token}`
                    : `${window.location.origin}/propostas/${q.id}/detalhe`;
                  const phone = String(q.sent_to_phone || q.customer_id?.phone || "").replace(/\D/g, "");
                  const greeting = customerName !== "—" ? `Olá ${customerName}!` : "Olá!";
                  const waMsg = encodeURIComponent(`${greeting} Segue a sua proposta da HotelEquip (${q.quotation_number || ""}):\n${proposalUrl}\n\nFicamos à total disposição!`);
                  const waUrl = phone ? `https://wa.me/${phone}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;

                  return (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/propostas/${q.id}/detalhe`)}
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wide",
                            q._docType === "quotation"
                              ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30"
                              : "border-primary/40 text-primary bg-primary/5"
                          )}
                        >
                          {q._docType === "quotation" ? "ORÇ" : "PROP"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {q.quotation_number || "—"}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{customerName}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {q.total_amount ? `€${Number(q.total_amount).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", status.className)} variant="outline">
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {displayDate
                          ? new Date(displayDate).toLocaleDateString("pt-PT")
                          : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Enviar por WhatsApp"
                            onClick={() => window.open(waUrl, "_blank", "noopener,noreferrer")}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Copiar link"
                            onClick={() => {
                              navigator.clipboard.writeText(proposalUrl);
                              toast({ title: "Link copiado!", description: proposalUrl });
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/propostas/${q.id}`)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/propostas/${q.id}/detalhe`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalhe
                              </DropdownMenuItem>
                              {q.public_token && (
                                <DropdownMenuItem onClick={() => window.open(`${baseUrl}/p/${q.public_token}`, "_blank", "noopener,noreferrer")}>
                                  <ExternalLink className="h-4 w-4 mr-2 text-blue-500" />
                                  Abrir página pública
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => window.open(waUrl, "_blank", "noopener,noreferrer")}>
                                <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                                Enviar WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleDuplicate(q.id, e)} disabled={duplicatingId === q.id}>
                                {duplicatingId === q.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                                Duplicar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Dialog: escolher cliente para criar Orçamento Rápido */}
      <Dialog open={openCreateChooser} onOpenChange={setOpenCreateChooser}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Novo Orçamento Rápido</DialogTitle>
            <DialogDescription className="sr-only">
              Seleciona um cliente e cria um novo orçamento de 1 folha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por empresa, NIF, telefone, email…"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <ScrollArea className="h-[50vh] pr-2">
              <div className="space-y-2">
                {contactsQuery.isLoading ? (
                  [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                ) : contacts.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      Sem resultados
                    </CardContent>
                  </Card>
                ) : (
                  contacts.slice(0, 100).map((c) => {
                    const name = String(c.company_name || c.contact_name || c.id);
                    return (
                      <Card key={String(c.id)} className="border">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{name}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                              {c.nif ? <span>NIF: {String(c.nif)}</span> : null}
                              {c.phone ? <span>Tel: {String(c.phone)}</span> : null}
                              {c.email ? <span className="truncate">{String(c.email)}</span> : null}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setOpenCreateChooser(false);
                              setCreateFor({ id: String(c.id), name });
                            }}
                          >
                            Criar
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Orcamento Rápido creator (1 folha) */}
      {createFor ? (
        <QuotationCreator
          open={!!createFor}
          onOpenChange={(open) => {
            if (!open) setCreateFor(null);
          }}
          contactId={createFor.id}
          contactName={createFor.name}
          onComplete={() => {
            setCreateFor(null);
            queryClient.invalidateQueries({ queryKey: ["propostas"] });
          }}
        />
      ) : null}
    </AppLayout>
  );
}
