/**
 * Página de Leads — lista, filtra por source/status, promove a contacto.
 */
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast, notifyRealtimeLead } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { directusRequest } from "@/integrations/directus/client";
import { createContact, listContacts } from "@/integrations/directus/contacts";
import { CreateContactForm } from "@/components/customer360/edit/CreateContactForm";
import { Search, UserPlus, ArrowRight, Phone, Mail, History, Plus, RefreshCw, AlertCircle, Zap, Flame, Thermometer, Snowflake } from "lucide-react";
import { LeadTimelineModal } from "@/components/contacts/LeadTimelineModal";
import { format } from "date-fns/format";
import { pt } from "date-fns/locale";
import { buildContactCreationUrl } from "@/lib/buildContactCreationUrl";
import { useRealtime } from "@/hooks/useRealtime";
import { useCrossTabBus } from "@/store/crossTabBus";
import { scoreBucket, SCORE_MODEL_VERSION, breakdownScore, scoreBadgeClass } from "@/services/leadScoring/score";

// Em portrait/desktop cada Card de lead tem ~96px (linha + metadata).
// Em landscape phone (~56px) é mais compacto. Detectamos com matchMedia.
const ROW_HEIGHT_ESTIMATE_DESKTOP = 96;
const ROW_HEIGHT_ESTIMATE_LANDSCAPE = 56;
const OVERSCAN = 6;             // quantas linhas extra renderizar acima/abaixo

const SOURCE_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  telecof: "Telecof",
  site: "Site",
  newsletter: "Newsletter",
  manual: "Manual",
  csv_import: "CSV Import",
  bravo_legacy: "BravoTech",
  outro: "Outro",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  incoming: { label: "Novo", color: "bg-blue-100 text-blue-800" },
  missed: { label: "Perdido", color: "bg-red-100 text-red-800" },
  ongoing: { label: "Em progresso", color: "bg-amber-100 text-amber-800" },
  rejected: { label: "Rejeitado", color: "bg-gray-100 text-gray-600" },
  spam: { label: "Spam", color: "bg-gray-100 text-gray-400" },
  discarded: { label: "Descartado", color: "bg-gray-100 text-gray-500" },
  converted: { label: "Convertido", color: "bg-green-100 text-green-800" },
};

interface LeadRow {
  id: number;
  display_name?: string;
  contact_name?: string;
  contact_phone?: string;
  email?: string;
  source?: string;
  status: string;
  contact_id?: number | null;
  date_created?: string;
  city?: string;
  postal_code?: string;
  website?: string;
  lead_data?: Record<string, unknown> | null;
  /** Card 7 — Lead Scoring */
  score?: number;
  score_factors?: Record<string, number> | null;
  score_computed_at?: string | null;
  score_model_version?: string | null;
  whatsapp_replies?: number;
  email_opens?: number;
  phone?: string;
  nif?: string;
  last_attempt_at?: string | null;
}

const SCORE_BUCKET_LABELS = {
  hot:  { label: "Quentes", value: "hot",  Icon: Flame,       color: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200" },
  warm: { label: "Mornos",  value: "warm", Icon: Thermometer, color: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200" },
  cold: { label: "Frios",   value: "cold", Icon: Snowflake,   color: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200" },
} as const;

type ScoreBucket = keyof typeof SCORE_BUCKET_LABELS;

export default function Leads() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showConverted, setShowConverted] = useState(false);
  const [promoting, setPromoting] = useState<string | number | null>(null);
  const [timelineLead, setTimelineLead] = useState<LeadRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [scoreFilter, setScoreFilter] = useState<ScoreBucket | "all">("all");
  const [breakdownLead, setBreakdownLead] = useState<LeadRow | null>(null);

  const newLeads = useCrossTabBus((s) => s.newLeads);
  const clearNewLeads = useCrossTabBus((s) => s.clearNewLeads);
  const newLeadIds = useMemo(() => new Set(newLeads.map((l) => String(l.id))), [newLeads]);

  // Directus & Cross-tab Realtime Subscription
  const { emit } = useRealtime("leads", {
    onEvent: (payload) => {
      if (payload.event === "create" && payload.data) {
        const item = Array.isArray(payload.data) ? payload.data[0] : payload.data;
        const name = item?.display_name || item?.contact_name || item?.contact_phone || "Novo Lead";
        notifyRealtimeLead(name, payload.meta?.userName);
      }
    },
  });

  const {
    data: leads = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["leads-page"],
    queryFn: async () => {
      const res = await directusRequest<{ data: LeadRow[] }>(
        `/items/leads?sort=-score,-date_created&limit=500&fields=id,display_name,contact_name,contact_phone,phone,email,nif,source,status,contact_id,date_created,last_attempt_at,city,postal_code,website,lead_data,score,score_factors,score_computed_at,score_model_version`
      );
      return res.data ?? [];
    },
    staleTime: 30_000,
  });

  // Contagem real de "por converter" — independente do limite de 500 da lista
  // acima, para não mostrar um número truncado quando há mais de 500 leads
  // pendentes (já aconteceu: mostrava sempre "500" mesmo havendo ~1100).
  const { data: pendingCountReal } = useQuery({
    queryKey: ["leads-pending-count"],
    queryFn: async () => {
      const res = await directusRequest<{ data: { count: string }[] }>(
        `/items/leads?aggregate[count]=*&filter[contact_id][_null]=true&filter[status][_nin]=discarded,spam,converted`
      );
      return Number(res.data?.[0]?.count ?? 0);
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    let list = leads;
    // Hide converted by default
    if (!showConverted) {
      list = list.filter((l) => l.status !== "converted" && l.status !== "discarded" && l.status !== "spam");
    }
    if (sourceFilter) {
      list = list.filter((l) => l.source === sourceFilter);
    }
    if (statusFilter) {
      list = list.filter((l) => l.status === statusFilter);
    }
    // Filtro por bucket de score (Card 7)
    if (scoreFilter !== "all") {
      list = list.filter((l) => scoreBucket(l.score ?? 0) === scoreFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        (l.display_name || "").toLowerCase().includes(q) ||
        (l.contact_name || "").toLowerCase().includes(q) ||
        (l.contact_phone || "").includes(q) ||
        (l.email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, sourceFilter, statusFilter, search, showConverted, scoreFilter]);

  const pendingCount = pendingCountReal ?? leads.filter((l) => !l.contact_id && l.status !== "discarded" && l.status !== "spam" && l.status !== "converted").length;

  const handlePromote = useCallback(async (lead: LeadRow) => {
    setPromoting(lead.id);
    try {
      // 1. Check for existing contact by phone (dedup)
      const phoneTail = (lead.contact_phone || "").replace(/\D/g, "").slice(-9);
      let existingContactId: string | number | null = null;

      if (phoneTail.length >= 9) {
        // Verificar phone, mobile_phone, whatsapp_number (mesmo padrão do identifyByPhoneOrEmail)
        for (const field of ["phone", "mobile_phone", "whatsapp_number"]) {
          const existing = await directusRequest<{ data: { id: number }[] }>(
            `/items/contacts?filter[${field}][_ends_with]=${phoneTail}&limit=1&fields=id`
          ).catch(() => ({ data: [] }));
          if (existing.data?.length) {
            existingContactId = existing.data[0].id;
            break;
          }
        }
      }

      if (!existingContactId) {
        // 2. Create new contact
        const newContact = await createContact({
          company_name: lead.display_name || lead.contact_name || lead.contact_phone || "Lead",
          contact_name: lead.contact_name || undefined,
          phone: lead.contact_phone || undefined,
          email: lead.email || undefined,
          city: lead.city || undefined,
          postal_code: lead.postal_code || undefined,
          source: lead.source || "outro",
        } as any);
        existingContactId = newContact?.id ?? (newContact as any)?.data?.id;
      }

      if (!existingContactId) throw new Error("Falha ao criar/encontrar contacto");

      // 3. Mark lead as converted + link to contact
      await directusRequest(`/items/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ contact_id: existingContactId, status: "converted" }),
      });

      toast({ title: "Lead convertido!", description: `Contacto #${existingContactId} associado.` });
      qc.invalidateQueries({ queryKey: ["leads-page"] });
      qc.invalidateQueries({ queryKey: ["contacts-directus"] });
    } catch (err) {
      toast({ title: "Erro ao converter", description: String((err as Error)?.message || ""), variant: "destructive" });
    } finally {
      setPromoting(null);
    }
  }, [qc]);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header com botão inline "+ Novo Lead" — full-width em mobile, compacto em desktop */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 crm-leads-header">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Leads</h1>
              {newLeads.length > 0 && (
                <Badge
                  variant="outline"
                  onClick={() => {
                    qc.invalidateQueries({ queryKey: ["leads-page"] });
                    clearNewLeads();
                  }}
                  className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 cursor-pointer flex items-center gap-1 text-xs py-0.5 px-2 animate-pulse"
                >
                  <Zap className="h-3 w-3 text-emerald-600" />
                  {newLeads.length} novo(s) em tempo real
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {pendingCount} por converter · {filtered.length} visíveis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCreateOpen(true)}
              className="w-full sm:w-auto h-9 gap-2 shadow-sm font-medium"
              data-testid="create-lead-header-btn"
            >
              <Plus className="h-4 w-4" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="crm-leads-filters flex flex-wrap gap-2 items-center">
          <div className="relative min-w-0 flex-1 max-w-sm sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar nome, telefone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>
          <Select value={sourceFilter || "all"} onValueChange={(v) => setSourceFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[110px] h-9 text-xs md:w-[140px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[110px] h-9 text-xs md:w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setShowConverted((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              showConverted ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {showConverted ? "Mostrar todos" : "Incluir convertidos"}
          </button>

          {/* Filtros laterais de Score (Card 7) — Quentes/Mornos/Frios */}
          <div className="flex items-center gap-1.5 ml-auto" data-testid="score-bucket-filters">
            {(["all", "hot", "warm", "cold"] as const).map((bucket) => {
              const isActive = scoreFilter === bucket;
              const conf = bucket === "all" ? null : SCORE_BUCKET_LABELS[bucket];
              const Icon = conf?.Icon;
              return (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => setScoreFilter(bucket)}
                  className={
                    isActive
                      ? "rounded-full border px-2.5 py-1 text-xs font-medium transition bg-primary text-primary-foreground border-primary inline-flex items-center gap-1"
                      : bucket === "all"
                      ? "rounded-full border px-2.5 py-1 text-xs font-medium transition border-border text-muted-foreground hover:bg-muted"
                      : `${conf!.color} rounded-full border px-2.5 py-1 text-xs font-medium transition inline-flex items-center gap-1`
                  }
                  data-testid={`score-filter-${bucket}`}
                  aria-pressed={isActive}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {bucket === "all" ? "Todos" : conf!.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* List — virtualizada para suportar 500+ leads sem gargalo no DOM */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
          </div>
        ) : isError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-8 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">Erro ao carregar leads da base de dados</p>
              <p className="text-xs text-muted-foreground">
                {(error as Error)?.message || "Não foi possível carregar os leads do Directus."}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {search || sourceFilter || statusFilter ? "Sem leads com estes filtros." : "Ainda não existem leads registadas."}
              </p>
              {search || sourceFilter || statusFilter ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setSourceFilter("");
                    setStatusFilter("");
                  }}
                >
                  Limpar filtros
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Lead
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <LeadsVirtualList
            leads={filtered}
            promoting={promoting}
            onPromote={handlePromote}
            onTimeline={setTimelineLead}
            newLeadIds={newLeadIds}
          />
        )}
      </div>

      {/* Floating Action Button (FAB) no Mobile com safe-area-inset respeitada */}
      <div className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 sm:hidden">
        <Button
          onClick={() => setCreateOpen(true)}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg gap-0"
          title="Novo Lead"
          data-testid="create-lead-fab-btn"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Dialog de Criação de Lead com CreateContactForm reutilizado */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Novo Lead
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Criação rápida de lead no Directus. Atualiza a lista sem recarregar a página.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <CreateContactForm
              isDialog={true}
              defaultMode="lead"
              onSuccess={(created) => {
                setCreateOpen(false);
                toast({
                  title: "Lead criada com sucesso",
                  description: "A lista de leads foi atualizada em tempo real.",
                });
                qc.invalidateQueries({ queryKey: ["leads-page"] });
                qc.invalidateQueries({ queryKey: ["leads"] });
                qc.invalidateQueries({ queryKey: ["leads-pending-count"] });
                emit("create", created || { status: "incoming", date_created: new Date().toISOString() });
              }}
              onCancel={() => setCreateOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Timeline Modal */}
      {timelineLead && (
        <LeadTimelineModal
          open={!!timelineLead}
          onClose={() => setTimelineLead(null)}
          leadId={timelineLead.id}
          leadName={timelineLead.display_name || timelineLead.contact_name || timelineLead.contact_phone || "Lead"}
          leadData={timelineLead.lead_data}
        />
      )}

      {/* Score Breakdown Modal (Card 7) */}
      <ScoreBreakdownDialog
        lead={breakdownLead}
        onClose={() => setBreakdownLead(null)}
      />
    </AppLayout>
  );
}

// ─── Lista virtualizada ─────────────────────────────────────────────────────
// Renderiza apenas as linhas visíveis (≈30) em vez das 500 do array.
// Suporta: scroll infinito, busca por teclado em todas as linhas, ações por linha
// continuam clicáveis. Cards mantêm-se idênticos ao design original.

interface LeadsVirtualListProps {
  leads: LeadRow[];
  promoting: string | number | null;
  onPromote: (lead: LeadRow) => void;
  onTimeline: (lead: LeadRow) => void;
  newLeadIds?: Set<string>;
}

function LeadsVirtualList({ leads, promoting, onPromote, onTimeline, newLeadIds }: LeadsVirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  // Detecta landscape phone para usar row compacta. Sem isto, 499 cards
  // a 96px dão 47904px de altura virtualizada; em landscape cabem só 6
  // cards a 56px. Cache simples em ref para evitar recalcular a cada render.
  const isLandscapeShortRef = useRef(false);
  const [rowEstimate, setRowEstimate] = useState(ROW_HEIGHT_ESTIMATE_DESKTOP);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(orientation: landscape) and (max-height: 500px)");
    const update = () => {
      const next = mql.matches ? ROW_HEIGHT_ESTIMATE_LANDSCAPE : ROW_HEIGHT_ESTIMATE_DESKTOP;
      if (next !== isLandscapeShortRef.current) {
        isLandscapeShortRef.current = mql.matches;
        setRowEstimate(next);
      }
    };
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowEstimate,
    overscan: OVERSCAN,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto rounded-md border border-border bg-background"
      style={{ height: "calc(100dvh - 180px)", minHeight: 320, maxHeight: "calc(100dvh - 80px)", paddingRight: "calc(3.25rem + 0.25rem)" }}
      data-testid="leads-virtual-list"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const lead = leads[virtualRow.index];
          const statusConf = STATUS_LABELS[lead.status] || { label: lead.status, color: "bg-gray-100 text-gray-600" };
          const isConverted = lead.status === "converted";
          const isRealtimeNew = newLeadIds?.has(String(lead.id));
          return (
            <div
              key={lead.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <Card
                className={`${isConverted ? "opacity-60" : "cursor-pointer hover:border-primary/40 transition-colors"} ${isRealtimeNew ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm" : ""} mb-2`}
                onClick={() => {
                  if (isConverted && lead.contact_id) {
                    window.location.href = `/customer360-shell/${lead.contact_id}`;
                  } else {
                    const params = buildContactCreationUrl(lead, { includeLeadId: true });
                    window.location.href = `/customer360-shell/novo?${params.toString()}`;
                  }
                }}
              >
                <CardContent className="p-3 flex items-center gap-3 crm-lead-card md:p-4 md:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {lead.display_name || lead.contact_name || lead.contact_phone || "Lead"}
                      </p>
                      {isRealtimeNew && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-1.5 py-0 flex items-center gap-0.5 animate-pulse">
                          <Zap className="h-2.5 w-2.5" />
                          NOVO
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs px-1.5 py-0 ${statusConf.color}`}>
                        {statusConf.label}
                      </Badge>
                      {lead.source && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {lead.contact_phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {lead.contact_phone}</span>}
                      {lead.email && <span className="flex min-w-0 max-w-full items-center gap-0.5 truncate"><Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{lead.email}</span></span>}
                      {lead.date_created && (
                        <span>{format(new Date(lead.date_created), "d MMM HH:mm", { locale: pt })}</span>
                      )}
                    </div>
                  </div>
                  {/* Badge de Score (Card 7) — mobile-first, click para ver breakdown */}
                  <ScoreBadge
                    score={lead.score ?? 0}
                    onClick={(e) => { e.stopPropagation(); setBreakdownLead(lead); }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 shrink-0 text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); onTimeline(lead); }}
                    title="Ver timeline"
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  {!isConverted && (
                    <Button
                      size="sm"
                      variant="outline"
                      /* min-w-[100px] + px-2.5 + gap-1 garante que 'Promover'
                         cabe completamente mesmo em tablet/iPad landscape
                         onde o card fica apertado pela sidebar 220px. */
                      className="gap-1 shrink-0 min-w-[100px] whitespace-nowrap px-2.5"
                      disabled={promoting === lead.id}
                      onClick={(e) => { e.stopPropagation(); onPromote(lead); }}
                    >
                      {promoting === lead.id ? (
                        <><ArrowRight className="h-3.5 w-3.5 animate-pulse" /> A converter...</>
                      ) : (
                        <><UserPlus className="h-3.5 w-3.5" /> Promover</>
                      )}
                    </Button>
                  )}
                  {isConverted && lead.contact_id && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Contacto #{lead.contact_id}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Score Badge + Breakdown Dialog (Card 7) ───────────────────────────────

function ScoreBadge({ score, onClick }: { score: number; onClick?: (e: React.MouseEvent) => void }) {
  const bucket = scoreBucket(score);
  const conf = SCORE_BUCKET_LABELS[bucket];
  const Icon = conf.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Score ${score} — ${conf.label}. Click para ver breakdown.`}
      data-testid="lead-score-badge"
      data-score={score}
      data-bucket={bucket}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 min-w-[52px] justify-center transition ${conf.color}`}
    >
      <Icon className="h-3 w-3" />
      <span className="tabular-nums">{score}</span>
    </button>
  );
}

function ScoreBreakdownDialog({
  lead,
  onClose,
}: {
  lead: LeadRow | null;
  onClose: () => void;
}) {
  const open = !!lead;
  const breakdown = useMemo(() => {
    if (!lead) return null;
    const live = breakdownScore({
      phone: lead.contact_phone || lead.phone,
      email: lead.email,
      nif: lead.nif,
      status: lead.status,
      last_activity_at: lead.last_attempt_at || lead.date_created,
      whatsapp_replies: lead.whatsapp_replies,
      email_opens: lead.email_opens,
    });
    const stored = lead.score ?? 0;
    return {
      live,
      stored,
      factors: lead.score_factors ?? live.factors,
      computed_at: lead.score_computed_at,
      model_version: lead.score_model_version ?? live.model_version,
    };
  }, [lead]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            Score breakdown
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {lead?.display_name || lead?.contact_name || lead?.contact_phone || "Lead"}
            {" · "}
            <span className="font-mono">v{breakdown?.model_version ?? SCORE_MODEL_VERSION}</span>
            {breakdown?.computed_at && (
              <> · calculado {format(new Date(breakdown.computed_at), "d MMM HH:mm", { locale: pt })}</>
            )}
          </DialogDescription>
        </DialogHeader>

        {breakdown && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-2xl font-bold tabular-nums ${scoreBadgeClass(breakdown.stored)}`}
                data-testid="breakdown-score-display"
              >
                {breakdown.stored}
              </div>
              <div className="text-xs text-muted-foreground">
                Bucket: <span className="font-medium">{SCORE_BUCKET_LABELS[scoreBucket(breakdown.stored)].label}</span>
                <br />
                Range: 0-100
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Componentes</p>
              {Object.entries(breakdown.factors)
                .filter(([, v]) => v !== 0)
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between text-xs border-b border-border/40 py-1"
                  >
                    <span className="text-muted-foreground">{SCORE_FACTOR_LABELS[key] ?? key}</span>
                    <span
                      className={`tabular-nums font-semibold ${
                        value > 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {value > 0 ? `+${value}` : value}
                    </span>
                  </div>
                ))}
              {Object.values(breakdown.factors).every((v) => v === 0) && (
                <p className="text-xs text-muted-foreground italic">Sem factores aplicáveis.</p>
              )}
            </div>

            <div className="border-t pt-2 text-xs space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Positivos</span>
                <span className="tabular-nums text-green-700 font-medium">
                  +{breakdown.live.positive}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Negativos</span>
                <span className="tabular-nums text-red-700 font-medium">
                  {breakdown.live.negative}
                </span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t">
                <span>Score final (clamp 0-100)</span>
                <span className="tabular-nums">{breakdown.stored}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const SCORE_FACTOR_LABELS: Record<string, string> = {
  has_phone: "Telefone (+25)",
  has_email: "Email (+15)",
  has_nif: "NIF (+10)",
  whatsapp_replies: "WhatsApp respostas (+20 cada)",
  email_opens: "Email aberturas (+15 cada)",
  status_qualified: "Status qualified (+10)",
  decay_per_day_after_7d: "Idle >7d (−5/dia)",
  penalty_discarded_or_spam: "Status discarded/spam (−50)",
};
