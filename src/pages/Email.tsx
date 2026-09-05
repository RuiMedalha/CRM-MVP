import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { directusRequest } from "@/integrations/directus/client";
import { useEmailThreads, useEmailUnassignedCount, useAssignThread, useCloseThread } from "@/hooks/useEmailThreads";
import type { EmailFilters, EmailThread } from "@/hooks/useEmailThreads";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { EmailThreadCard } from "@/components/email/EmailThreadCard";
import { EmailThreadDetail } from "@/components/email/EmailThreadDetail";
import { useAllThreadsLite } from "@/hooks/useAllThreadsLite";
import { useRealCrmMetrics } from "@/hooks/useRealCrmMetrics";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Search, Inbox, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Configurable categories ──────────────────────────────────────────────
const EMAIL_CATEGORIES = [
  { key: "", label: "Todas" },
  { key: "pedido_orcamento", label: "Pedidos de orçamento" },
  { key: "followup_cliente", label: "Follow-ups" },
  { key: "reclamacao", label: "Reclamações" },
  { key: "compra_cliente", label: "Compras" },
  { key: "fornecedor_sourcing", label: "Fornecedores (sourcing)" },
  { key: "compra_fornecedor", label: "Fornecedores (compras)" },
  { key: "fatura_administrativo", label: "Faturas" },
  { key: "outro", label: "Outro" },
  { key: "no_reply", label: "Automáticos", muted: true },
  { key: "spam", label: "Spam", muted: true },
] as const;

const MAILBOXES = [
  { key: "", label: "Todas as caixas", color: "" },
  { key: "geral@hotelequip.pt", label: "Geral", color: "text-green-600 dark:text-green-400" },
  { key: "apoio.cliente@hotelequip.pt", label: "Apoio ao Cliente", color: "text-blue-600 dark:text-blue-400" },
] as const;

const STATUSES = [
  { key: "", label: "Todos" },
  { key: "queued", label: "Na fila" },
  { key: "assigned", label: "Em tratamento" },
  { key: "closed", label: "Resolvidos" },
  { key: "sent", label: "Enviados" },
] as const;

const URGENT_TOAST_KEY = "email_urgent_seen";

export default function Email() {
  const { toast } = useToast();
  const { employee } = useCurrentEmployee();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [search, setSearch] = useState("");
  const [activeMailbox, setActiveMailbox] = useState(() => searchParams.get("mailbox") || "");
  const [activeStatus, setActiveStatus] = useState("");
  const [activeCategory, setActiveCategory] = useState("");

  // Keep state in sync with URL search param changes
  useEffect(() => {
    setActiveMailbox(searchParams.get("mailbox") || "");
  }, [searchParams]);

  const handleSelectMailbox = (mailboxKey: string) => {
    setActiveMailbox(mailboxKey);
    const next = new URLSearchParams(searchParams);
    if (mailboxKey) {
      next.set("mailbox", mailboxKey);
    } else {
      next.delete("mailbox");
    }
    setSearchParams(next, { replace: true });
  };

  const filters: EmailFilters = {
    mailbox: activeMailbox,
    status: activeStatus,
    category: activeCategory,
    onlyUnassigned: false,
  };

  const { data: threads, isLoading } = useEmailThreads(filters);
  const { data: allThreadsLite } = useAllThreadsLite();
  const { data: unassignedCount } = useEmailUnassignedCount();
  const { data: realMetrics } = useRealCrmMetrics();
  const assignMutation = useAssignThread();
  const closeMutation = useCloseThread();

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threads ?? []) {
      const cat = t.category || "outro";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    counts[""] = (threads ?? []).length;
    return counts;
  }, [threads]);

  // Contagem de não-lidos (read_at === null) por categoria
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of threads ?? []) {
      if (t.read_at) continue; // já lida
      const cat = t.category || "outro";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    counts[""] = (threads ?? []).filter((t) => !t.read_at).length;
    return counts;
  }, [threads]);

  // Urgency toasts
  useEffect(() => {
    if (!threads || threads.length === 0) return;
    const seen = JSON.parse(sessionStorage.getItem(URGENT_TOAST_KEY) || "[]") as string[];
    const urgent = threads.filter(
      (t) => (t.urgency === "high" || t.urgency === "critical") && t.status === "queued" && !seen.includes(t.id)
    );
    if (urgent.length === 0) return;
    sessionStorage.setItem(URGENT_TOAST_KEY, JSON.stringify([...seen, ...urgent.map((t) => t.id)]));
    urgent.slice(0, 3).forEach((t) => {
      toast({ title: "🚨 Email urgente", description: t.subject || "(sem assunto)" });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads]);

  // Client-side search filter + ocultar ruído (spam/automáticos) da vista "Todas".
  const MUTED_CATEGORIES = ["spam", "no_reply"];
  const filtered = useMemo(() => {
    let list = threads ?? [];
    if (!MUTED_CATEGORIES.includes(activeCategory)) {
      list = list.filter((t) => !MUTED_CATEGORIES.includes(t.category ?? ""));
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (t) => (t.subject ?? "").toLowerCase().includes(q) || (t.from_address ?? "").toLowerCase().includes(q)
    );
  }, [threads, search, activeCategory]);

  const handleSelect = (thread: EmailThread) => {
    setSelectedThread(thread);
    // Secção 1: marcar como lida (read_at) se ainda não foi
    if (!thread.read_at) {
      const now = new Date().toISOString();
      directusRequest(`/items/email_threads/${encodeURIComponent(thread.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ read_at: now }),
      }).catch(() => { /* non-blocking */ });
      // Actualizar localmente para o badge reflectir imediatamente
      setSelectedThread({ ...thread, read_at: now });
    }
  };

  const handleAssign = async (thread: EmailThread) => {
    if (!employee) {
      toast({ title: "Erro", description: "Não foi possível identificar o operador", variant: "destructive" });
      return;
    }
    try {
      await assignMutation.mutateAsync({ threadId: thread.id, employeeId: employee.id });
      toast({ title: "Assumido", description: "Thread assumida com sucesso" });
      if (selectedThread?.id === thread.id) {
        setSelectedThread({ ...thread, assigned_to: employee.id, status: "assigned", assigned_at: new Date().toISOString() });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Não foi possível assumir", variant: "destructive" });
    }
  };

  const handleClose = async () => {
    if (!selectedThread) return;
    try {
      await closeMutation.mutateAsync(selectedThread.id);
      toast({ title: "Fechado", description: "Thread marcada como resolvida" });
      setSelectedThread({ ...selectedThread, status: "closed" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Não foi possível fechar", variant: "destructive" });
    }
  };

  // ─── Render helpers ─────────────────────────────────────────────────────

  const renderSidebar = () => (
    <aside className="hidden w-[200px] shrink-0 flex-col border-r border-border bg-muted/30 p-3 lg:flex">
      {/* Caixas */}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caixas</p>
      <div className="space-y-0.5 mb-3">
        {MAILBOXES.map((m) => {
          const count =
            !m.key
              ? realMetrics?.emailsTotal
              : m.key === "geral@hotelequip.pt"
              ? realMetrics?.emailsGeral
              : m.key === "apoio.cliente@hotelequip.pt"
              ? realMetrics?.emailsApoio
              : null;
          const isSelected = activeMailbox === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => handleSelectMailbox(m.key)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                isSelected ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              <span className={m.color}>{m.label}</span>
              {count !== undefined && count !== null && (
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-3 h-px bg-border" />

      {/* Estado */}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</p>
      <div className="space-y-0.5">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveStatus(s.key)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              activeStatus === s.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
            )}
          >
            <span>{s.label}</span>
            {s.key === "queued" && (unassignedCount ?? 0) > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">
                {(unassignedCount ?? 0) > 99 ? "99+" : unassignedCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );

  const renderListHeader = () => (
    <div className="shrink-0 border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h1 className="text-lg font-semibold">Email Inbox</h1>
        <div className="relative min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar assunto / remetente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-0.5 overflow-x-auto pb-0.5">
        {EMAIL_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.key] ?? 0;
          const unread = unreadCounts[cat.key] ?? 0;
          const isActive = activeCategory === cat.key;
          const isMuted = "muted" in cat && cat.muted;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                "whitespace-nowrap px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors",
                isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                isMuted && !isActive && "opacity-45"
              )}
            >
              {cat.label}
              {unread > 0 ? (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold bg-destructive/15 text-destructive">
                  {unread}
                </span>
              ) : count > 0 ? (
                <span className={cn(
                  "ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold",
                  isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderThreadList = () => (
    <div className="flex-1 overflow-auto p-3 space-y-1.5">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma thread encontrada</p>
        </div>
      ) : (
        filtered.map((thread) => {
          const canAssign =
            (thread.status === "queued" && !thread.assigned_to) ||
            (thread.assigned_to !== null && thread.assigned_to !== (employee?.id ?? null));
          return (
            <EmailThreadCard
              key={thread.id}
              thread={thread}
              onClick={() => handleSelect(thread)}
              onAssign={() => handleAssign(thread)}
              showAssign={!!employee && canAssign}
              allThreads={allThreadsLite}
              onOpenThread={(id) => { const t = (threads ?? []).find(x => x.id === id) || (allThreadsLite ?? []).find(x => x.id === id); if (t) handleSelect(t as EmailThread); }}
              isSelected={selectedThread?.id === thread.id}
            />
          );
        })
      )}
    </div>
  );

  const renderDetail = () => {
    if (!selectedThread) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <Inbox className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Selecciona um email para ver os detalhes</p>
        </div>
      );
    }
    return (
      <EmailThreadDetail
        thread={selectedThread}
        currentEmployeeId={employee?.id ?? null}
        onBack={() => setSelectedThread(null)}
        onAssign={() => handleAssign(selectedThread)}
        onClose={handleClose}
      />
    );
  };

  return (
    <AppLayout fullHeight>
      <div className="flex h-full min-h-0">
        {/* Filter sidebar */}
        {renderSidebar()}

        {/* Desktop: split-pane (list + detail) */}
        <div className="hidden md:flex min-h-0 min-w-0 flex-1">
          {/* Left: thread list */}
          <div className={cn(
            "flex flex-col border-r border-border transition-all",
            selectedThread ? "w-[360px] shrink-0" : "flex-1"
          )}>
            {renderListHeader()}
            {renderThreadList()}
          </div>

          {/* Right: detail pane */}
          {selectedThread && (
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {renderDetail()}
            </div>
          )}
          {!selectedThread && (
            <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Inbox className="h-12 w-12 mb-3 opacity-30 mx-auto" />
                <p className="text-sm">Selecciona um email para ver os detalhes</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile: stacked view */}
        <div className="flex md:hidden min-h-0 min-w-0 flex-1 flex-col">
          {selectedThread ? (
            <div className="flex-1 overflow-auto">
              {renderDetail()}
            </div>
          ) : (
            <>
              {renderListHeader()}
              {renderThreadList()}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
