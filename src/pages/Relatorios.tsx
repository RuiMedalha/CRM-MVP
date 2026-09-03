import { useMemo, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeals } from "@/hooks/useDeals";
import { useContacts } from "@/hooks/useContacts";
import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import { fetchRecentLeads } from "@/integrations/directus/leads";
import {
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Users,
  Euro,
  Target,
  Mail,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useForecast } from "@/features/forecast/useForecast";

function delta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-emerald-600" : "text-red-600"}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{value.toFixed(0)}%
    </span>
  );
}

export default function Relatorios() {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: contacts, isLoading: contactsLoading } = useContacts();

  const leadsQuery = useQuery({
    queryKey: ["relatorios-leads"],
    queryFn: () => fetchRecentLeads(300),
  });

  const emailQuery = useQuery({
    queryKey: ["relatorios-email-stats"],
    queryFn: async () => {
      const [threads, proposals] = await Promise.all([
        directusRequest<any>("/items/email_threads?aggregate[count]=id").catch(() => ({ data: [{ count: { id: "0" } }] })),
        directusRequest<any>("/items/quotations?aggregate[count]=id").catch(() => ({ data: [{ count: { id: "0" } }] })),
      ]);
      return {
        totalEmails: Number(threads.data?.[0]?.count?.id || 0),
        totalProposals: Number(proposals.data?.[0]?.count?.id || 0),
      };
    },
  });

  // Weekly comparison
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const allDeals = deals ?? [];
    const thisWeekDeals = allDeals.filter((d) => {
      const created = new Date((d as any).date_created || "");
      return created >= oneWeekAgo;
    });
    const lastWeekDeals = allDeals.filter((d) => {
      const created = new Date((d as any).date_created || "");
      return created >= twoWeeksAgo && created < oneWeekAgo;
    });

    const thisWeekLeads = (leadsQuery.data ?? []).filter((l: any) => {
      const created = new Date(l.date_created || "");
      return created >= oneWeekAgo;
    });
    const lastWeekLeads = (leadsQuery.data ?? []).filter((l: any) => {
      const created = new Date(l.date_created || "");
      return created >= twoWeeksAgo && created < oneWeekAgo;
    });

    const thisWeekValue = thisWeekDeals.reduce((s, d) => s + (d.total_amount || 0), 0);
    const lastWeekValue = lastWeekDeals.reduce((s, d) => s + (d.total_amount || 0), 0);

    const thisWeekWon = thisWeekDeals.filter((d) => d.status === "ganho").length;
    const lastWeekWon = lastWeekDeals.filter((d) => d.status === "ganho").length;

    return {
      deals: { current: thisWeekDeals.length, previous: lastWeekDeals.length },
      leads: { current: thisWeekLeads.length, previous: lastWeekLeads.length },
      value: { current: thisWeekValue, previous: lastWeekValue },
      won: { current: thisWeekWon, previous: lastWeekWon },
    };
  }, [deals, leadsQuery.data]);

  // Pipeline summary
  const pipelineSummary = useMemo(() => {
    const allDeals = deals ?? [];
    const active = allDeals.filter((d) => !["ganho", "perdido"].includes(d.status || ""));
    const totalValue = active.reduce((s, d) => s + (d.total_amount || 0), 0);
    const won = allDeals.filter((d) => d.status === "ganho");
    const wonValue = won.reduce((s, d) => s + (d.total_amount || 0), 0);
    const lost = allDeals.filter((d) => d.status === "perdido").length;
    const convRate = allDeals.length > 0 ? ((won.length / allDeals.length) * 100).toFixed(1) : "0";
    return { activeCount: active.length, totalValue, wonCount: won.length, wonValue, lostCount: lost, convRate };
  }, [deals]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!deals?.length) return;
    const header = "Título,Cliente,Status,Valor,Data Criação\n";
    const rows = deals.map((d) => {
      const client = (d as any).customer?.company_name || "";
      const created = (d as any).date_created || "";
      return `"${d.title || ""}","${client}","${d.status || ""}",${d.total_amount || 0},"${created}"`;
    }).join("\n");
    const csv = header + rows;
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-negocios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = dealsLoading || contactsLoading || leadsQuery.isLoading;
  const forecast30 = useForecast(30);
  const forecast60 = useForecast(60);
  const forecast90 = useForecast(90);

  return (
    <AppLayout>
      <div className="space-y-6 print:space-y-4" ref={printRef}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground text-sm">Resumo semanal de performance</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!deals?.length}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {/* Weekly KPIs with delta */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <DeltaBadge value={delta(weeklyStats.leads.current, weeklyStats.leads.previous)} />
                  </div>
                  <p className="text-2xl font-bold">{weeklyStats.leads.current}</p>
                  <p className="text-xs text-muted-foreground">Leads esta semana</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <DeltaBadge value={delta(weeklyStats.deals.current, weeklyStats.deals.previous)} />
                  </div>
                  <p className="text-2xl font-bold">{weeklyStats.deals.current}</p>
                  <p className="text-xs text-muted-foreground">Negócios criados</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Euro className="h-4 w-4 text-muted-foreground" />
                    <DeltaBadge value={delta(weeklyStats.value.current, weeklyStats.value.previous)} />
                  </div>
                  <p className="text-2xl font-bold">
                    {weeklyStats.value.current.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor criado</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <DeltaBadge value={delta(weeklyStats.won.current, weeklyStats.won.previous)} />
                  </div>
                  <p className="text-2xl font-bold">{weeklyStats.won.current}</p>
                  <p className="text-xs text-muted-foreground">Ganhos esta semana</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

                {/* Forecast Ponderado 30/60/90 */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              {forecast30.isLoading ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Target className="h-4 w-4 text-primary" />
                    <DeltaBadge value={forecast30.deltaMonthPercent} />
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {forecast30.forecast30.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Forecast 30d &middot; {forecast30.activeDealsCount} negocios activos</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              {forecast60.isLoading ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Target className="h-4 w-4 text-purple-500" />
                    <DeltaBadge value={forecast60.deltaMonthPercent} />
                  </div>
                  <p className="text-2xl font-bold text-purple-600">
                    {forecast60.forecast60.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Forecast 60d &middot; {forecast60.activeDealsCount} negocios activos</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              {forecast90.isLoading ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Target className="h-4 w-4 text-amber-500" />
                    <DeltaBadge value={forecast90.deltaMonthPercent} />
                  </div>
                  <p className="text-2xl font-bold text-amber-600">
                    {forecast90.forecast90.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Forecast 90d &middot; {forecast90.activeDealsCount} negocios activos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Grafico de Barras - Forecast por Estagio */}
        {!forecast30.isLoading && forecast30.chartData?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Forecast por Estagio (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecast30.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k €`} />
                    <Tooltip
                      formatter={(value) => [Number(value).toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }), "Valor Ponderado"]}
                      labelFormatter={(label) => `Estágio: ${label}`}
                    />
                    <Bar dataKey="valorPonderado" name="Valor Ponderado" radius={[4, 4, 0, 0]}>
                      {forecast30.chartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

{/* Pipeline Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo do Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-20 w-full" /> : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{pipelineSummary.activeCount}</p>
                  <p className="text-xs text-muted-foreground">Activos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {pipelineSummary.totalValue.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor em pipeline</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{pipelineSummary.wonCount}</p>
                  <p className="text-xs text-muted-foreground">Ganhos (total)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {pipelineSummary.wonValue.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor ganho</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{pipelineSummary.convRate}%</p>
                  <p className="text-xs text-muted-foreground">Taxa conversão</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xl font-bold">{contacts?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total contactos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-xl font-bold">{emailQuery.data?.totalEmails || 0}</p>
                  <p className="text-xs text-muted-foreground">Threads email</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Euro className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xl font-bold">{emailQuery.data?.totalProposals || 0}</p>
                  <p className="text-xs text-muted-foreground">Propostas emitidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Print footer */}
        <div className="hidden print:block text-center text-xs text-muted-foreground pt-6 border-t">
          <p>Gerado em {new Date().toLocaleDateString("pt-PT")} · HotelEquip CRM</p>
        </div>
      </div>
    </AppLayout>
  );
}
