import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CalendarClock, CheckCheck, Clock3, FileText, ListTodo, Phone, Plus, RefreshCw, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { directusRequest } from "@/integrations/directus/client";
import { proposalWork, sortWork, taskWork, validTime, type ProposalInput, type TaskInput, type WorkRecord } from "@/lib/workspace/continuity";
import { cn } from "@/lib/utils";

const LIMIT = 200;
const labels = { overdue: "Prazo vencido", today: "Para hoje", unscheduled: "Sem próximo prazo", upcoming: "Agendado" };
const tones = {
  overdue: "border-destructive/30 bg-destructive/5 text-destructive",
  today: "border-primary/30 bg-primary/5 text-primary",
  unscheduled: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  upcoming: "border-border bg-muted/40 text-muted-foreground",
};

export default function Today() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<WorkRecord["state"] | "all">("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const tasks = useQuery({
    queryKey: ["workspace-tasks", user?.id], enabled: !!user, staleTime: 30_000, retry: 1,
    queryFn: async () => {
      const response = await directusRequest<{ data: TaskInput[] }>(
        `/items/follow_ups?filter[status][_eq]=open&sort=due_at,date_created&limit=${LIMIT}&fields=id,title,status,due_at,completed_at,contact_id.company_name,assigned_employee_id.full_name`
      );
      return response.data;
    },
  });
  const proposals = useQuery({
    queryKey: ["workspace-proposals", user?.id], enabled: !!user, staleTime: 30_000, retry: 1,
    queryFn: async () => {
      const response = await directusRequest<{ data: ProposalInput[] }>(
        `/items/quotations?filter[status][_in]=sent,viewed&sort=follow_up_at,date_created&limit=${LIMIT}&fields=id,quotation_number,status,follow_up_at,total_amount,customer_id.company_name`
      );
      return response.data;
    },
  });
  const items = useMemo(() => sortWork([
    ...taskWork(tasks.isError ? [] : tasks.data ?? [], now),
    ...proposalWork(proposals.isError ? [] : proposals.data ?? [], now),
  ]), [tasks.data, tasks.isError, proposals.data, proposals.isError, now]);
  const loading = tasks.isPending || proposals.isPending;
  const partial = tasks.isError || proposals.isError;
  const filtered = items.filter((item) => (filter === "all" || item.state === filter) &&
    `${item.title} ${item.contact} ${item.owner ?? ""}`.toLocaleLowerCase("pt-PT").includes(search.trim().toLocaleLowerCase("pt-PT")));
  const greeting = user?.first_name ? `Bom trabalho, ${user.first_name}.` : "O trabalho que precisa de atenção.";
  const refresh = () => { void tasks.refetch(); void proposals.refetch(); setNow(Date.now()); };
  const sources = [{ name: "Compromissos", query: tasks }, { name: "Propostas", query: proposals }];

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-4">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.16em] text-primary">Hotelequip · Espaço de trabalho</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Hoje</h1>
            <p className="mt-2 text-base text-muted-foreground">{greeting}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11"><Link to="/comunicacoes?channel=telecof"><Phone className="mr-2 h-4 w-4" />Atender</Link></Button>
            <Button asChild className="min-h-11"><Link to="/propostas/nova"><Plus className="mr-2 h-4 w-4" />Nova proposta</Link></Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Filtrar por prazo">
          {(Object.keys(labels) as WorkRecord["state"][]).map((state) => (
            <button key={state} onClick={() => setFilter(filter === state ? "all" : state)} aria-pressed={filter === state}
              className={cn("min-h-28 rounded-xl border p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === state ? tones[state] : "border-border bg-card")}>
              <span className="block text-sm font-medium">{labels[state]}</span>
              <span className="mt-2 block text-3xl font-semibold tabular-nums">{loading ? "—" : items.filter((i) => i.state === state).length}</span>
              {partial && <span className="text-xs">Contagem parcial</span>}
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="work-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 md:p-5">
              <div><h2 id="work-heading" className="text-lg font-semibold">Próximas ações</h2><p className="mt-1 text-sm text-muted-foreground">Compromissos e propostas acessíveis ao teu perfil.</p></div>
              <Button variant="ghost" size="sm" className="min-h-11" disabled={tasks.isFetching || proposals.isFetching} onClick={refresh}><RefreshCw className={cn("mr-2 h-4 w-4", (tasks.isFetching || proposals.isFetching) && "animate-spin")} />Atualizar</Button>
              <div className="relative w-full"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Pesquisar ações por assunto, contacto ou responsável" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar assunto, contacto ou responsável…" className="min-h-11 pl-10 text-base" /></div>
              {filter !== "all" && <Button variant="outline" size="sm" className="min-h-11" onClick={() => setFilter("all")}>Mostrar todos os prazos</Button>}
            </div>
            {partial && <div role="alert" className="m-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><AlertCircle className="h-5 w-5 shrink-0 text-destructive" /><p>Não foi possível consultar {sources.filter((s) => s.query.isError).map((s) => s.name.toLowerCase()).join(" e ")}. A lista pode estar incompleta. Tenta atualizar; se persistir, verifica a ligação e as permissões.</p></div>}
            {loading ? <p role="status" className="p-8 text-muted-foreground">A consultar o trabalho pendente…</p> : filtered.length === 0 ? (
              <div className="space-y-3 p-8 text-center"><CheckCheck className="mx-auto h-8 w-8 text-muted-foreground" /><p className="font-medium">{partial ? "Não há ações disponíveis nas fontes consultadas." : "Sem ações nesta seleção."}</p><p className="text-sm text-muted-foreground">Consulta também o atendimento e a agenda para acompanhar os restantes pedidos.</p></div>
            ) : <ul className="divide-y divide-border">{filtered.map((item) => (
              <li key={item.id} className="p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">{item.kind === "proposal" ? <FileText className="h-5 w-5" /> : <ListTodo className="h-5 w-5" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words font-semibold">{item.title}</h3><span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", tones[item.state])}>{labels[item.state]}</span></div>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{item.contact}</p>
                    <p className="mt-3 text-sm">{item.reason}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {validTime(item.dueAt) !== null && <p className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{new Date(item.dueAt!).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })}</p>}
                        {item.owner && <p>{item.owner}</p>}
                        {item.amount !== undefined && <p className="font-medium text-foreground">{new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(item.amount)}</p>}
                      </div>
                      <Button asChild variant="outline" size="sm" className="min-h-11"><Link to={item.href}>{item.kind === "proposal" ? "Rever proposta" : "Abrir agenda"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}</ul>}
            <p className="border-t border-border p-4 text-xs text-muted-foreground">Até {LIMIT} registos por fonte, ordenados pelo prazo. Não é uma contagem global do CRM. Horas de Portugal continental.</p>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl bg-primary p-5 text-primary-foreground">
              <CalendarClock className="h-6 w-6" /><h2 className="mt-4 text-lg font-semibold">Dar continuidade</h2><p className="mt-2 text-sm leading-relaxed">Cada promessa precisa de responsável, prazo e próximo passo.</p>
              <Button asChild variant="secondary" className="mt-5 min-h-11 w-full"><Link to="/agenda">Abrir a agenda<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </section>
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold">Área comercial</h2>
              {[["Negócios", "/pipeline"], ["Propostas", "/propostas"], ["Orçamentos", "/orcamentos"], ["Contactos", "/customer360-shell"], ["Indicadores", "/painel"]].map(([label, href]) => <Link key={href} to={href} className="mt-1 flex min-h-11 items-center justify-between rounded-md px-2 text-sm hover:bg-muted">{label}<ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>)}
            </section>
            <section className="rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold">Consulta de dados</h2>
              {sources.map(({ name, query }) => <p key={name} className="mt-3 flex justify-between gap-2 text-sm"><span>{name}</span><span className={query.isError ? "text-destructive" : "text-muted-foreground"}>{query.isPending ? "A consultar" : query.isError ? "Indisponível" : "Consultado"}</span></p>)}
              <p className="mt-3 text-xs text-muted-foreground">Uma consulta bem-sucedida não confirma o estado das integrações externas.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
