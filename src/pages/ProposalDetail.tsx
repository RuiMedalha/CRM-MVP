import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { getQuotationById } from "@/integrations/directus/quotations";
import { directusRequest } from "@/integrations/directus/client";
import { useCompanySettings } from "@/hooks/useSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Eye, Users, Clock, Calendar, ArrowLeft, Edit, Copy, FileDown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { generateProposalPDF } from "@/utils/generateProposalPDF";

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pdfLoading, setPdfLoading] = useState(false);
  const { data: companySettings } = useCompanySettings();

  const { data, isLoading } = useQuery({
    queryKey: ["proposal-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { quotation, items } = await getQuotationById(id);
      if (!quotation) return null;
      // Attach items to quotation so PDF generation has access
      return { ...quotation, items };
    },
    enabled: !!id,
  });

  // Fetch views log for chart
  const { data: viewsLog = [] } = useQuery({
    queryKey: ["proposal-views-log", id],
    queryFn: async () => {
      if (!id) return [];
      const res = await directusRequest<{ data: any[] }>(
        `/items/quotation_views_log?filter[quotation_id][_eq]=${id}&sort=-viewed_at&limit=500&fields=viewed_at,duration_seconds,device`
      );
      return res.data || [];
    },
    enabled: !!id,
  });

  // Build chart data: views per day for last 14 days
  const chartData = (() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().split("T")[0]] = 0;
    }
    for (const log of viewsLog) {
      if (!log.viewed_at) continue;
      const day = log.viewed_at.split("T")[0];
      if (day in days) days[day]++;
    }
    return Object.entries(days).map(([date, views]) => ({
      date: new Date(date).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
      views,
    }));
  })();

  const copyLink = () => {
    const baseUrl = import.meta.env.VITE_PROPOSALS_BASE_URL || "https://proposta.hotelequip.pt";
    const token = (data as any)?.public_token;
    if (token) {
      navigator.clipboard.writeText(`${baseUrl}/p/${token}`);
      toast({ title: "Link copiado!" });
    } else {
      toast({ title: "Proposta sem link público", variant: "destructive" });
    }
  };

  const handlePDF = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const settings = companySettings as any;
      const q = data as any;
      const company = {
        name: settings?.name || "HotelEquip",
        logo_url: settings?.logo_url || "",
        phone: settings?.phone || "",
        email: settings?.email || "",
        address: settings?.address || "",
        vat_number: settings?.vat_number || "",
        iban: settings?.iban || "",
        payment_instructions: settings?.payment_instructions || "",
        multibanco_entity: settings?.multibanco_entity || "",
        multibanco_reference: settings?.multibanco_reference || "",
      };

      // Build quotation object with items for PDF template
      const pdfQuotation = {
        ...q,
        customer_name: q.customer_id?.contact_name || q.customer_id?.company_name || "",
        customer_company: q.customer_id?.company_name || "",
        items: q.items || [],
      };

      await generateProposalPDF(pdfQuotation, company);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast({ title: "Erro ao gerar PDF", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">A carregar...</div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Proposta não encontrada.</div>
      </AppLayout>
    );
  }

  const q = data as any;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/propostas")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{q.quotation_number || "Proposta"}</h1>
              <p className="text-sm text-muted-foreground">
                {q.customer_id?.company_name || q.customer_id?.contact_name || "Sem cliente"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/propostas/${id}`)}>
              <Edit className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-1.5" />
              Copiar link
            </Button>
            <Button variant="outline" size="sm" onClick={handlePDF} disabled={pdfLoading}>
              {pdfLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
              PDF
            </Button>
          </div>
        </div>

        {/* Status + Total */}
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {q.status || "draft"}
          </Badge>
          {q.total_amount && (
            <span className="text-lg font-bold">€{Number(q.total_amount).toFixed(2)}</span>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-xs">Visualizações</span>
              </div>
              <p className="text-2xl font-bold">{q.view_count || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs">Visitantes únicos</span>
              </div>
              <p className="text-2xl font-bold">{q.unique_visitors || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Duração média</span>
              </div>
              <p className="text-2xl font-bold">
                {q.avg_duration_seconds ? `${q.avg_duration_seconds}s` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Última visualização</span>
              </div>
              <p className="text-sm font-medium">
                {q.last_viewed_at
                  ? new Date(q.last_viewed_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visualizações (últimos 14 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
