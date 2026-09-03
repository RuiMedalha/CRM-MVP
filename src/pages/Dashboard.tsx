import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeals } from "@/hooks/useDeals";
import { useContacts } from "@/hooks/useContacts";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Kanban, TrendingUp, Euro, Phone, Mail, Building2, AlertCircle, MessagesSquare, Inbox as InboxIcon, CalendarClock, BarChart3, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { InboxOmnichannel } from "@/components/InboxOmnichannel";
import { listFollowUps } from "@/integrations/directus/follow-ups";
import { useNotificationStore } from "@/store/notificationStore";
import { CheckSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";

import ForecastWidget from "@/components/dashboard/ForecastWidget";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: contacts, isLoading: contactsLoading } = useContacts();

  // Overdue follow-ups
  const overdueFollowUpsQuery = useFollowUpsLite();

  const activeDeals = deals?.filter((d) => !["ganho", "perdido"].includes(d.status || "")).length || 0;
  const wonDeals = deals?.filter((d) => d.status === "ganho").length || 0;

  // Inbox unificada
  const unreadCount = useNotificationStore((s) => s.badgeCounts.unreadCount);

  // Email stats
  const emailStatsQuery = useEmailStatsLite();

  // Mobile tab — bottom-nav style
  const [mobileTab, setMobileTab] = useState<"conversas" | "hoje">("conversas");

  const totalDealsValue = deals?.reduce((sum, deal) => sum + (deal.total_amount || 0), 0) || 0;

  const isLoading = dealsLoading || contactsLoading;

  // D2: Saudação dinâmica baseada na hora
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite";
  const userName = (user as any)?.first_name || user?.email?.split("@")[0] || "";

  const overdueCount = overdueFollowUpsQuery.data?.length ?? 0;
  const emailsUnassigned = emailStatsQuery.data?.emailsUnassigned ?? 0;

  const urgencyItems = useMemo(() => {
    return [
      emailsUnassigned > 0
        ? { label: `${emailsUnassigned} email${emailsUnassigned > 1 ? "s" : ""} não atribuído${emailsUnassigned > 1 ? "s" : ""}`, href: "/inbox", icon: Mail, color: "text-orange-600" }
        : null,
      overdueCount > 0
        ? { label: `${overdueCount} follow-up${overdueCount > 1 ? "s" : ""} em atraso`, href: "/customer360-shell", icon: CheckSquare, color: "text-red-600" }
        : null,
      unreadCount > 0
        ? { label: `${unreadCount} conversa${unreadCount > 1 ? "s" : ""} por responder`, href: "/inbox", icon: MessagesSquare, color: "text-warning" }
        : null,
    ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Phone; color: string }>;
  }, [emailsUnassigned, overdueCount, unreadCount]);

  const urgencyCapped = urgencyItems.slice(0, 2);

  return (
    <AppLayout>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex shrink-0 items-end justify-between gap-3 px-1"
        >
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {greeting}{userName ? `, ${userName}` : ""}.
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Resumo da operação de hoje.
            </p>
          </div>
          <Link
            to="/inbox"
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 sm:inline-flex"
          >
            <InboxIcon className="h-3.5 w-3.5" />
            Abrir inbox
          </Link>
        </motion.header>

        {/* Mobile tab switcher */}
        <div className="lg:hidden">
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as typeof mobileTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="conversas" className="gap-1.5 text-xs">
                <MessagesSquare className="h-3.5 w-3.5" />
                Conversas
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="hoje" className="gap-1.5 text-xs">
                <ListChecks className="h-3.5 w-3.5" />
                Hoje
              </TabsTrigger>
            </TabsList>
            <TabsContent value="conversas" className="mt-2">
              <Card className="overflow-hidden">
                <InboxOmnichannel compact maxItems={8} />
              </Card>
            </TabsContent>
            <TabsContent value="hoje" className="mt-2">
              <HojeTab
                overdueFollowUpsQuery={overdueFollowUpsQuery}
                emailStatsQuery={emailStatsQuery}
                urgencyItems={urgencyCapped}
                isLoading={isLoading}
                totalDealsValue={totalDealsValue}
                deals={deals}
                contacts={contacts}
                activeDeals={activeDeals}
                wonDeals={wonDeals}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop split 50/50 */}
        <div className="hidden min-h-0 flex-1 gap-3 lg:grid lg:grid-cols-2">
          {/* LEFT — Omnichannel inbox */}
          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader className="shrink-0 border-b border-border pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <InboxIcon className="h-4 w-4 text-primary" />
                Conversas recentes
                {unreadCount > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <div className="min-h-0 flex-1 overflow-hidden">
              <InboxOmnichannel compact />
            </div>
            <div className="shrink-0 border-t border-border px-3 py-2">
              <Link
                to="/inbox"
                className="text-xs font-medium text-primary hover:underline"
              >
                Abrir inbox completa →
              </Link>
            </div>
          </Card>

          {/* RIGHT — KPIs + Forecast */}
          <div className="flex min-h-0 flex-col gap-3 overflow-auto pr-1">
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <KpiTile
                icon={<Users className="h-3.5 w-3.5" />}
                label="Contactos"
                value={contacts?.length || 0}
                href="/contactos"
                loading={contactsLoading}
              />
              <KpiTile
                icon={<Kanban className="h-3.5 w-3.5" />}
                label="Activos"
                value={activeDeals}
                href="/pipeline"
                loading={dealsLoading}
                color="text-warning"
              />
              <KpiTile
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Ganhos"
                value={wonDeals}
                href="/pipeline"
                loading={dealsLoading}
                color="text-success"
              />
              <KpiTile
                icon={<Euro className="h-3.5 w-3.5" />}
                label="Pipeline"
                value={totalDealsValue}
                href="/pipeline"
                loading={dealsLoading}
                format="currency"
                color="text-primary"
              />
            </div>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Forecast 30/60/90
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ForecastWidget />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-warning" />
                  Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/email" className="rounded-md bg-muted/40 p-2 transition-colors hover:bg-muted">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Emails</p>
                    <p className="text-lg font-bold">{emailsUnassigned}</p>
                  </Link>
                  <Link to="/propostas" className="rounded-md bg-muted/40 p-2 transition-colors hover:bg-muted">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Propostas</p>
                    <p className="text-lg font-bold">{emailStatsQuery.data?.proposalsPending ?? 0}</p>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Below-fold analytics — desktop only */}
        <div className="hidden lg:block">
          <BelowFold
            contacts={contacts}
            contactsLoading={contactsLoading}
            overdueFollowUpsQuery={overdueFollowUpsQuery}
            urgencyCapped={urgencyCapped}
            urgencyItems={urgencyItems}
          />
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function KpiTile({
  icon,
  label,
  value,
  href,
  loading,
  format,
  color = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
  loading?: boolean;
  format?: "currency";
  color?: string;
}) {
  const display =
    format === "currency"
      ? value.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
      : value.toLocaleString("pt-PT");
  return (
    <Link
      to={href}
      className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <div className="mt-1 text-lg font-bold leading-tight">
        {loading ? <Skeleton className="h-5 w-12" /> : display}
      </div>
    </Link>
  );
}

function HojeTab(props: {
  overdueFollowUpsQuery: ReturnType<typeof useFollowUpsLite>;
  emailStatsQuery: ReturnType<typeof useEmailStatsLite>;
  urgencyItems: Array<{ label: string; href: string; icon: typeof Phone; color: string }>;
  isLoading: boolean;
  totalDealsValue: number;
  deals: any;
  contacts: any;
  activeDeals: number;
  wonDeals: number;
}) {
  const { overdueFollowUpsQuery, urgencyItems, isLoading, totalDealsValue, contacts, activeDeals, wonDeals } = props;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <KpiTile
          icon={<Users className="h-3.5 w-3.5" />}
          label="Contactos"
          value={contacts?.length || 0}
          href="/contactos"
          loading={isLoading}
        />
        <KpiTile
          icon={<Kanban className="h-3.5 w-3.5" />}
          label="Activos"
          value={activeDeals}
          href="/pipeline"
          color="text-warning"
        />
        <KpiTile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Ganhos"
          value={wonDeals}
          href="/pipeline"
          color="text-success"
        />
        <KpiTile
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Pipeline"
          value={totalDealsValue}
          href="/pipeline"
          format="currency"
          color="text-primary"
        />
      </div>

      {urgencyItems.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Para fazer
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {urgencyItems.map((item) => (
                <Link
                  key={item.href + item.label}
                  to={item.href}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  <item.icon className={`h-3 w-3 ${item.color}`} />
                  {item.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1">
          <CardTitle className="flex items-center gap-2 text-xs">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            Agenda de hoje
          </CardTitle>
          <Link to="/agenda" className="text-[11px] text-primary hover:underline">
            Ver agenda
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {overdueFollowUpsQuery.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (overdueFollowUpsQuery.data ?? []).length === 0 ? (
            <p className="py-1 text-[11px] text-muted-foreground">Sem follow-ups para hoje.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(overdueFollowUpsQuery.data ?? []).slice(0, 4).map((fu: any) => (
                <li key={fu.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                  <CheckSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <p className="flex-1 truncate text-xs">{fu.title || "Follow-up"}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {fu.due_at
                      ? new Date(fu.due_at).toLocaleString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-2 text-xs">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ForecastWidget />
        </CardContent>
      </Card>
    </div>
  );
}

function BelowFold({
  contacts,
  contactsLoading,
  overdueFollowUpsQuery,
  urgencyCapped,
  urgencyItems,
}: {
  contacts: any;
  contactsLoading: boolean;
  overdueFollowUpsQuery: any;
  urgencyCapped: any;
  urgencyItems: any;
}) {
  return (
    <div className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4" />
            Resumo de Contactos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {contactsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div><p className="text-lg font-bold">{contacts?.length || 0}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
              <div><p className="text-lg font-bold">{contacts?.filter((c: any) => c.email).length || 0}</p><p className="text-[10px] text-muted-foreground">Email</p></div>
              <div><p className="text-lg font-bold">{contacts?.filter((c: any) => c.whatsapp_number).length || 0}</p><p className="text-[10px] text-muted-foreground">WhatsApp</p></div>
              <div><p className="text-lg font-bold">{contacts?.filter((c: any) => c.phone).length || 0}</p><p className="text-[10px] text-muted-foreground">Telefone</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-primary" />
            Agenda de hoje
          </CardTitle>
          <Link to="/agenda" className="text-[11px] text-primary hover:underline">Ver</Link>
        </CardHeader>
        <CardContent className="pt-0">
          {overdueFollowUpsQuery.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (overdueFollowUpsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem follow-ups para hoje.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(overdueFollowUpsQuery.data ?? []).slice(0, 4).map((fu: any) => (
                <li key={fu.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                  <CheckSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <p className="flex-1 truncate text-xs">{fu.title || "Follow-up"}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {fu.due_at ? new Date(fu.due_at).toLocaleString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {urgencyCapped.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Para fazer hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {urgencyCapped.map((item: any) => (
                <Link
                  key={item.href + item.label}
                  to={item.href}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  <item.icon className={`h-3 w-3 ${item.color}`} />
                  {item.label}
                </Link>
              ))}
              {urgencyItems.length > 2 && (
                <Link
                  to="/customer360-shell"
                  className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20"
                >
                  +{urgencyItems.length - 2}
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Lightweight data hooks (inline to avoid pulling too much into Dashboard) ─

function useFollowUpsLite() {
  return useQuery({
    queryKey: ["dashboard-overdue-followups"],
    queryFn: async () => await listFollowUps({ status: "open", dueBefore: new Date().toISOString(), limit: 50 }),
    refetchInterval: 60000,
  });
}

function useEmailStatsLite() {
  return useQuery({
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
}