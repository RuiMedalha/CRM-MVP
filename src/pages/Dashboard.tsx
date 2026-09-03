import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDeals, DEAL_STATUSES } from "@/hooks/useDeals";
import { useContacts } from "@/hooks/useContacts";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Kanban, TrendingUp, Euro, Phone, MessageCircle, Mail, Globe, Building2, AlertCircle, MessagesSquare, Inbox, CalendarClock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRecentLeads } from "@/integrations/directus/leads";
import { listFollowUps } from "@/integrations/directus/follow-ups";
import { useConversationStore } from "@/store/conversationStore";
import { useNotificationStore } from "@/store/notificationStore";
import { CheckSquare } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { SlaCompliancePanel } from "@/components/dashboard/SlaCompliancePanel";
import { EmployeeActivityPanel } from "@/components/dashboard/EmployeeActivityPanel";
import ForecastWidget from "@/components/dashboard/ForecastWidget";

const DEAL_STAGES_FUNNEL = [
  { value: "lead", label: "Lead", color: "#94a3b8" },
  { value: "qualificacao", label: "Qualificação", color: "#3b82f6" },
  { value: "proposta", label: "Proposta", color: "#8b5cf6" },
  { value: "negociacao", label: "Negociação", color: "#f59e0b" },
  { value: "ganho", label: "Ganho", color: "#10b981" },
  { value: "perdido", label: "Perdido", color: "#ef4444" },
];

const SOURCE_CONFIG: Record<string, { label: string; color: string; icon: typeof Phone }> = {
  phone: { label: "Chamada", color: "hsl(var(--primary))", icon: Phone },
  whatsapp: { label: "WhatsApp", color: "#25D366", icon: MessageCircle },
  email: { label: "Email", color: "hsl(var(--warning))", icon: Mail },
  web: { label: "Website", color: "hsl(var(--muted-foreground))", icon: Globe },
  typebot: { label: "Typebot", color: "#6366F1", icon: MessageCircle },
  n8n: { label: "n8n", color: "#FF6D5A", icon: Globe },
  chatwoot: { label: "Chatwoot", color: "#1F93FF", icon: MessageCircle },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const recentLeadsQuery = useQuery({
    queryKey: ["leads-recent-dashboard"],
    queryFn: async () => await fetchRecentLeads(300),
    refetchInterval: 12000,
  });

  // Overdue follow-ups
  const overdueFollowUpsQuery = useQuery({
    queryKey: ["dashboard-overdue-followups"],
    queryFn: async () => await listFollowUps({ status: "open", dueBefore: new Date().toISOString(), limit: 50 }),
    refetchInterval: 60000,
  });

  const totalDealsValue = deals?.reduce((sum, deal) => sum + (deal.total_amount || 0), 0) || 0;
  const activeDeals = deals?.filter((d) => !["ganho", "perdido"].includes(d.status || "")).length || 0;
  const wonDeals = deals?.filter((d) => d.status === "ganho").length || 0;

  // Inbox unificada — contar não lidos via notificationStore (alimentada por useCommunicationNotifications no AppLayout)
  const unreadCount = useNotificationStore((s) => s.badgeCounts.unreadCount);

  // Email + proposal stats
  const emailStatsQuery = useQuery({
    queryKey: ["dashboard-email-stats"],
    queryFn: async () => {
      const { directusRequest } = await import("@/integrations/directus/client");
      const [unassigned, proposals] = await Promise.all([
        directusRequest<{ data: { count: { id: string } }[] }>("/items/email_threads?filter[assigned_to][_null]=true&filter[status][_neq]=closed&aggregate[count]=id").catch(() => ({ data: [{ count: { id: "0" } }] })),
        directusRequest<{ data: { count: { id: string } }[] }>("/items/quotations?filter[status][_in]=sent,viewed&aggregate[count]=id").catch(() => ({ data: [{ count: { id: "0" } }] })),
      ]);
      return {
        emailsUnassigned: Number(unassigned.data?.[0]?.count?.id || 0),
        proposalsPending: Number(proposals.data?.[0]?.count?.id || 0),
      };
    },
    refetchInterval: 30000,
  });

  // Calculate leads by source
  const leadsBySource = useMemo(() => {
    const all = recentLeadsQuery.data || [];
    if (!all.length) return [];
    
    const sourceCount: Record<string, number> = {};
    all.forEach((lead) => {
      const source = lead.source || "phone";
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    return Object.entries(sourceCount)
      .map(([source, count]) => ({
        source,
        name: SOURCE_CONFIG[source]?.label || source,
        count,
        color: SOURCE_CONFIG[source]?.color || "hsl(var(--muted-foreground))",
      }))
      .sort((a, b) => b.count - a.count);
  }, [recentLeadsQuery.data]);

  // Calculate leads by day (last 7 days)
  const leadsByDay = useMemo(() => {
    const all = recentLeadsQuery.data || [];
    if (!all.length) return [];
    
    const days: Record<string, Record<string, number>> = {};
    const now = new Date();
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric" });
      days[key] = {};
    }

    all.forEach((lead) => {
      const date = new Date(lead.date_created || "");
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 6) {
        const key = date.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric" });
        const source = lead.source || "phone";
        if (days[key]) {
          days[key][source] = (days[key][source] || 0) + 1;
        }
      }
    });

    return Object.entries(days).map(([day, sources]) => ({
      day,
      ...sources,
      total: Object.values(sources).reduce((a, b) => a + b, 0),
    }));
  }, [recentLeadsQuery.data]);

  const stats = [
    {
      title: "Total de Contactos",
      value: contacts?.length || 0,
      icon: Users,
      href: "/contactos",
      color: "text-primary",
    },
    {
      title: "Negócios Ativos",
      value: activeDeals,
      icon: Kanban,
      href: "/pipeline",
      color: "text-warning",
    },
    {
      title: "Negócios Ganhos",
      value: wonDeals,
      icon: TrendingUp,
      href: "/pipeline",
      color: "text-success",
    },
    {
      title: "Emails Pendentes",
      value: emailStatsQuery.data?.emailsUnassigned || 0,
      icon: Mail,
      href: "/email",
      color: "text-orange-600",
    },
    {
      title: "Propostas Activas",
      value: emailStatsQuery.data?.proposalsPending || 0,
      icon: Euro,
      href: "/propostas",
      color: "text-blue-600",
    },
  ];

  const isLoading = dealsLoading || contactsLoading || recentLeadsQuery.isLoading;

  // Urgency data
  const conversations = useConversationStore((s) => s.conversations)
  const urgentConversations = useMemo(() => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    return conversations.filter((c) => {
      if ((c.unreadCount ?? 0) === 0) return false
      const updated = c.updatedAt ? new Date(c.updatedAt).getTime() : 0
      return updated < twoHoursAgo || (c.unreadCount ?? 0) > 0
    }).slice(0, 5)
  }, [conversations])

  const staleDeals = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return (deals ?? []).filter((d) => {
      if (["ganho", "perdido"].includes(d.status || "")) return false
      const updated = (d as any).date_updated ? new Date((d as any).date_updated).getTime() : 0
      return updated < sevenDaysAgo
    }).slice(0, 5)
  }, [deals])

  const urgencyItems = useMemo(() => {
    const convCount = urgentConversations.length
    const dealCount = staleDeals.length
    const emailCount = emailStatsQuery.data?.emailsUnassigned ?? 0
    const overdueCount = overdueFollowUpsQuery.data?.length ?? 0
    return [
      emailCount > 0
        ? { label: `${emailCount} email${emailCount > 1 ? "s" : ""} não atribuído${emailCount > 1 ? "s" : ""}`, href: "/inbox", icon: Mail, color: "text-orange-600" }
        : null,
      overdueCount > 0
        ? { label: `${overdueCount} follow-up${overdueCount > 1 ? "s" : ""} em atraso`, href: "/customer360-shell", icon: CheckSquare, color: "text-red-600" }
        : null,
      convCount > 0
        ? { label: `${convCount} conversa${convCount > 1 ? "s" : ""} sem resposta`, href: "/comunicacoes", icon: MessagesSquare, color: "text-warning" }
        : null,
      dealCount > 0
        ? { label: `${dealCount} negócio${dealCount > 1 ? "s" : ""} sem actividade`, href: "/pipeline", icon: Kanban, color: "text-muted-foreground" }
        : null,
    ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Phone; color: string }>
  }, [urgentConversations, staleDeals, emailStatsQuery.data, overdueFollowUpsQuery.data])

  // D2: Saudação dinâmica baseada na hora
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite";
  const userName = (user as any)?.first_name || user?.email?.split("@")[0] || "";

  // D2: Atrasados — cap a 2 com link "Ver todos"
  const urgencyCapped = urgencyItems.slice(0, 2);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header com saudação dinâmica */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}{userName ? `, ${userName}` : ""}.
          </h1>
          <p className="text-muted-foreground">Aqui está o resumo da tua operação.</p>
        </div>

        {/* NOVO D2: Inbox unificada (WhatsApp + Email + Phone) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" />
              Inbox unificada
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-2">
              <Link
                to="/comunicacoes?channel=whatsapp"
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <MessageCircle className="h-5 w-5 text-[#25D366] mb-1" />
                <span className="text-2xl font-bold">{unreadCount}</span>
                <span className="text-xs text-muted-foreground">WhatsApp</span>
              </Link>
              <Link
                to="/email"
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Mail className="h-5 w-5 text-warning mb-1" />
                <span className="text-2xl font-bold">
                  {emailStatsQuery.data?.emailsUnassigned ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">Email</span>
              </Link>
              <Link
                to="/comunicacoes?channel=telecof"
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Phone className="h-5 w-5 text-primary mb-1" />
                <span className="text-2xl font-bold">
                  {urgentConversations.length}
                </span>
                <span className="text-xs text-muted-foreground">Chamadas</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* NOVO D2: Agenda de hoje */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Agenda de hoje
            </CardTitle>
            <Link
              to="/agenda"
              className="text-xs text-primary hover:underline"
            >
              Ver agenda
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {overdueFollowUpsQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (overdueFollowUpsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Sem follow-ups para hoje.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(overdueFollowUpsQuery.data ?? []).slice(0, 5).map((fu: any) => (
                  <li
                    key={fu.id}
                    className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{fu.title || "Follow-up"}</p>
                      <p className="text-xs text-muted-foreground">
                        {fu.due_at
                          ? new Date(fu.due_at).toLocaleString("pt-PT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Sem hora"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Para fazer hoje (urgências) — cap 2 + Ver todos */}
        {urgencyCapped.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                Para fazer hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {urgencyCapped.map((item) => (
                  <Link
                    key={item.href + item.label}
                    to={item.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    {item.label}
                  </Link>
                ))}
                {urgencyItems.length > 2 && (
                  <Link
                    to="/customer360-shell"
                    className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    Ver mais ({urgencyItems.length - 2})
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas secundárias — Stats Grid movido para o fundo */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.title} to={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{stat.value}</div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Revenue Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Total em Pipeline
            </CardTitle>
            <Euro className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-3xl font-bold">
                {totalDealsValue.toLocaleString("pt-PT", {
                  style: "currency",
                  currency: "EUR",
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Summary Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Resumo de Contactos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contactsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{contacts?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {contacts?.filter(c => c.email).length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Com Email</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {contacts?.filter(c => c.whatsapp_number).length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Com WhatsApp</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {contacts?.filter(c => c.phone).length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Com Telefone</p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adicionados esta semana</span>
                  <span className="font-medium text-primary">
                    +{contacts?.filter(c => {
                      const created = new Date((c as any).date_created || '');
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return created > weekAgo;
                    }).length || 0}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Leads Analytics */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Leads by Source - Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leads por Fonte</CardTitle>
            </CardHeader>
            <CardContent>
              {recentLeadsQuery.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : leadsBySource.length === 0 ? (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Sem dados de leads</p>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leadsBySource}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="name"
                        label={({ name, percent }) => 
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {leadsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value} leads`, "Total"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              {/* Source Legend */}
              {!recentLeadsQuery.isLoading && leadsBySource.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {leadsBySource.map((source) => (
                    <div key={source.source} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: source.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {source.name}: {source.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leads by Day - Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leads Últimos 7 Dias</CardTitle>
            </CardHeader>
            <CardContent>
              {recentLeadsQuery.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : leadsByDay.every((d) => d.total === 0) ? (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Sem leads nos últimos 7 dias</p>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadsByDay}>
                      <XAxis 
                        dataKey="day" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      {Object.keys(SOURCE_CONFIG).map((source) => (
                        <Bar
                          key={source}
                          dataKey={source}
                          stackId="a"
                          fill={SOURCE_CONFIG[source].color}
                          radius={[2, 2, 0, 0]}
                          name={SOURCE_CONFIG[source].label}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Analytics Section ─────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Pipeline Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Funil do Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {dealsLoading ? <Skeleton className="h-48 w-full" /> : (
                <div className="space-y-2">
                  {DEAL_STAGES_FUNNEL.map((stage) => {
                    const stageDeals = (deals ?? []).filter((d) => d.status === stage.value);
                    const count = stageDeals.length;
                    const value = stageDeals.reduce((s, d) => s + (d.total_amount || 0), 0);
                    const maxCount = Math.max(...DEAL_STAGES_FUNNEL.map((st) => (deals ?? []).filter((d) => d.status === st.value).length), 1);
                    const pct = (count / maxCount) * 100;
                    return (
                      <div key={stage.value} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{stage.label}</span>
                          <span className="text-muted-foreground">{count} · {value.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: stage.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Taxas de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
              {dealsLoading ? <Skeleton className="h-48 w-full" /> : (
                <div className="space-y-4">
                  {(() => {
                    const total = (deals ?? []).length;
                    const proposed = (deals ?? []).filter((d) => ["proposta", "negociacao", "ganho"].includes(d.status || "")).length;
                    const won = (deals ?? []).filter((d) => d.status === "ganho").length;
                    const lost = (deals ?? []).filter((d) => d.status === "perdido").length;
                    const convRate = total > 0 ? ((won / total) * 100).toFixed(1) : "0";
                    const propRate = total > 0 ? ((proposed / total) * 100).toFixed(1) : "0";
                    const lossRate = total > 0 ? ((lost / total) * 100).toFixed(1) : "0";
                    return (
                      <>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-primary">{convRate}%</p>
                          <p className="text-xs text-muted-foreground">Lead → Ganho</p>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <p className="text-lg font-bold">{propRate}%</p>
                            <p className="text-xs text-muted-foreground">Com proposta</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-emerald-600">{won}</p>
                            <p className="text-xs text-muted-foreground">Ganhos</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-red-600">{lossRate}%</p>
                            <p className="text-xs text-muted-foreground">Perdidos</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SLA Compliance + Activity */}
        <div className="grid gap-4 lg:grid-cols-2">
                  {/* Forecast Widget */}
        <ForecastWidget />

        {/* SLA Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SLA Email</CardTitle>
            </CardHeader>
            <CardContent>
              <SlaCompliancePanel />
            </CardContent>
          </Card>

          {/* Activity per Employee */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actividade por Comercial</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeActivityPanel />
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Deals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Últimos Negócios</CardTitle>
            </CardHeader>
            <CardContent>
              {dealsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : deals?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem negócios registados</p>
              ) : (
                <div className="space-y-3">
                  {deals?.slice(0, 5).map((deal) => (
                    <Link
                      key={deal.id}
                      to={`/pipeline?dealId=${deal.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{deal.title || "Sem título"}</p>
                        <p className="text-xs text-muted-foreground">
                          {(deal as any).customer?.company_name || "Sem cliente"}
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {(deal.total_amount || 0).toLocaleString("pt-PT", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </AppLayout>
  );
}
