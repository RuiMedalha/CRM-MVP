import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { listQuotations, duplicateQuotation } from "@/integrations/directus/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Plus, Search, Eye, Copy, MoreHorizontal, Loader2, MessageCircle, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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

export default function Propostas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["propostas", searchQuery],
    queryFn: () => listQuotations({ search: searchQuery, limit: 200 }),
  });

  // Filter to proposals only (PRP- prefix or document_type === 'proposal' excluding ORC-)
  const proposals = quotations
    .filter((q: any) =>
      (q.quotation_number || "").startsWith("PRP-") || (q.document_type === "proposal" && !(q.quotation_number || "").startsWith("ORC-"))
    )
    .sort((a: any, b: any) => Number(b.id || 0) - Number(a.id || 0));

  const filtered = activeTab === "all"
    ? proposals
    : proposals.filter((q: any) => q.status === activeTab);

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
          <Button onClick={() => navigate("/propostas/nova")}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nova Proposta
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar propostas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors",
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
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
    </AppLayout>
  );
}
