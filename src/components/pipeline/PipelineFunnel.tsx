import { useMemo } from "react";
import type { DealRow } from "@/integrations/directus/deals";
import type { PipelineStageRow } from "@/integrations/directus/pipelines";
import { TrendingUp, Wallet, Trophy, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineFunnelProps {
  stages: PipelineStageRow[];
  deals: DealRow[] | undefined | null;
  onStageClick?: (stageId: string) => void;
}

const CLOSED_STAGE_KEYS = new Set(["ganho", "perdido", "fechado", "won", "lost"]);

function stageKey(stage: PipelineStageRow): string {
  return (stage.id || stage.name || "").toLowerCase();
}

function isClosedStage(stage: PipelineStageRow): boolean {
  const key = stageKey(stage);
  if (CLOSED_STAGE_KEYS.has(key)) return true;
  const name = (stage.name || "").toLowerCase();
  if (CLOSED_STAGE_KEYS.has(name)) return true;
  return false;
}

function isWonStage(stage: PipelineStageRow): boolean {
  const key = stageKey(stage);
  return key === "ganho" || key === "won" || (stage.name || "").toLowerCase() === "ganho";
}

function formatEUR(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k€`;
  }
  return `${Math.round(n)}€`;
}

function formatEURFull(n: number): string {
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export function PipelineFunnel({ stages, deals, onStageClick }: PipelineFunnelProps) {
  const safeDeals = deals ?? [];
  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [stages]);

  // Por etapa: total € e contagem
  const stageMetrics = useMemo(() => {
    const out = new Map<string, { count: number; total: number }>();
    for (const stage of sortedStages) {
      out.set(stage.id, { count: 0, total: 0 });
    }
    for (const deal of safeDeals) {
      const stageId = (deal as any).stage_id ?? (deal as any).status ?? null;
      if (!stageId) continue;
      // Match pelo id OU nome (lower) da etapa
      const stageObj = sortedStages.find(
        (s) => s.id === stageId || s.id.toLowerCase() === String(stageId).toLowerCase(),
      );
      if (!stageObj) continue;
      const cur = out.get(stageObj.id)!;
      cur.count += 1;
      cur.total += Number((deal as any).total_amount || 0);
    }
    return out;
  }, [sortedStages, safeDeals]);

  // Métricas globais
  const insights = useMemo(() => {
    let openTotal = 0;
    let wonLast30 = 0;
    let wonAllTime = 0;
    let wonAllTimeCount = 0;
    let lostCount = 0;
    let closedCount = 0;

    const wonStageIds = new Set(sortedStages.filter(isWonStage).map((s) => s.id));
    const lostStageIds = new Set(
      sortedStages.filter((s) => isClosedStage(s) && !isWonStage(s)).map((s) => s.id),
    );

    const now = Date.now();
    const cutoff30 = now - 30 * 86400000;

    for (const deal of safeDeals) {
      const stageId = (deal as any).stage_id ?? (deal as any).status ?? null;
      if (!stageId) continue;
      const stageObj = sortedStages.find((s) => s.id === stageId);
      if (!stageObj) continue;
      const amount = Number((deal as any).total_amount || 0);
      if (wonStageIds.has(stageObj.id)) {
        wonAllTime += amount;
        wonAllTimeCount += 1;
        const created = (deal as any).date_created;
        const updated = (deal as any).date_updated;
        const ts = updated || created;
        if (ts) {
          const t = new Date(ts).getTime();
          if (!Number.isNaN(t) && t >= cutoff30) {
            wonLast30 += amount;
          }
        }
      } else if (lostStageIds.has(stageObj.id)) {
        lostCount += 1;
      } else {
        openTotal += amount;
      }
    }

    closedCount = wonAllTimeCount + lostCount;

    // Taxa conversão global: negócios Ganho / (Ganho + Perdido) por CONTAGEM — proxy lead→ganho
    const globalRate = closedCount > 0
      ? Math.round((wonAllTimeCount / closedCount) * 1000) / 10
      : null;

    // Tempo médio desde criação, apenas para negócios ainda abertos
    const openAges = safeDeals
      .filter((d) => {
        const sid = (d as any).stage_id ?? (d as any).status;
        if (!sid) return false;
        return !wonStageIds.has(String(sid)) && !lostStageIds.has(String(sid));
      })
      .map((d) => daysSince((d as any).date_created))
      .filter((v): v is number => v !== null);
    const avgAgeDays = openAges.length > 0
      ? Math.round(openAges.reduce((a, b) => a + b, 0) / openAges.length)
      : null;

    return {
      openTotal,
      wonLast30,
      wonAllTime,
      wonAllTimeCount,
      lostCount,
      closedCount,
      globalRate,
      avgAgeDays,
    };
  }, [safeDeals, sortedStages]);

  // Larguras proporcionais ao valor €
  const maxTotal = useMemo(() => {
    let m = 0;
    for (const v of stageMetrics.values()) if (v.total > m) m = v.total;
    return m;
  }, [stageMetrics]);

  // % conversão entre etapas consecutivas (ex: Lead→Qualificação = q.count / lead.count * 100)
  function conversionBetween(fromId: string, toId: string): number | null {
    const from = stageMetrics.get(fromId)?.count ?? 0;
    const to = stageMetrics.get(toId)?.count ?? 0;
    if (from === 0) return null;
    return Math.round((to / from) * 100);
  }

  // Apenas etapas "activas" para o funil (exclui Perdido)
  const funnelStages = useMemo(() => {
    return sortedStages.filter((s) => {
      const k = stageKey(s);
      // Excluir Perdido do funil
      if (k === "perdido" || k === "lost") return false;
      return true;
    });
  }, [sortedStages]);

  // Funil visível: pelo menos a primeira etapa (Lead); as outras se tiverem total>0 OU count>0
  const visibleStages = useMemo(() => {
    if (funnelStages.length === 0) return funnelStages;
    const first = funnelStages[0];
    const rest = funnelStages.slice(1).filter((s) => {
      const m = stageMetrics.get(s.id);
      return (m?.total ?? 0) > 0 || (m?.count ?? 0) > 0;
    });
    return [first, ...rest];
  }, [funnelStages, stageMetrics]);

  if (visibleStages.length === 0) {
    return null;
  }

  function colorForStage(stage: PipelineStageRow): string {
    // Map por id conhecido → classe utilitária Tailwind
    const k = stageKey(stage);
    const map: Record<string, string> = {
      lead: "bg-yellow-400/15 border-yellow-400/40 text-yellow-900 dark:text-yellow-100",
      qualificacao: "bg-blue-400/15 border-blue-400/40 text-blue-900 dark:text-blue-100",
      proposta: "bg-purple-400/15 border-purple-400/40 text-purple-900 dark:text-purple-100",
      negociacao: "bg-pink-400/15 border-pink-400/40 text-pink-900 dark:text-pink-100",
      ganho: "bg-green-400/15 border-green-400/40 text-green-900 dark:text-green-100",
    };
    if (map[k]) return map[k];
    return "bg-muted border-border text-foreground";
  }

  return (
    <div
      className="px-3 py-2 border-b bg-background/60 shrink-0"
      data-testid="pipeline-funnel"
    >
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-3">
        {/* Funnel */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 overflow-x-auto" role="list">
            {visibleStages.map((stage, idx) => {
              const metrics = stageMetrics.get(stage.id) ?? { count: 0, total: 0 };
              const widthPct = maxTotal > 0 ? Math.max(20, Math.round((metrics.total / maxTotal) * 100)) : 20;
              const conv = idx > 0 ? conversionBetween(visibleStages[idx - 1].id, stage.id) : null;
              const colorCls = colorForStage(stage);
              return (
                <div key={stage.id} className="flex items-center gap-1.5 shrink-0" role="listitem">
                  {idx > 0 && (
                    <div className="flex flex-col items-center px-1 shrink-0">
                      <div className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                        {conv === null ? "—" : `${conv}%`}
                      </div>
                      <div className="text-muted-foreground text-xs leading-none" aria-hidden>→</div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onStageClick?.(stage.id)}
                    title={`Ir para coluna "${stage.name}"`}
                    className={cn(
                      "border rounded-md px-2.5 py-1.5 text-left transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40",
                      colorCls,
                    )}
                    style={{ minWidth: `${widthPct * 1.4}px`, maxWidth: "260px" }}
                    data-funnel-stage-id={stage.id}
                  >
                    <div className="text-[11px] font-medium truncate">{stage.name}</div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatEUR(metrics.total)}
                      </span>
                      <span className="text-[10px] opacity-70 tabular-nums">
                        {metrics.count} negócio{metrics.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline Insights */}
        <div
          className="lg:w-[280px] shrink-0 rounded-md border bg-card/60 px-3 py-2 grid grid-cols-2 lg:grid-cols-1 gap-1.5"
          aria-label="Pipeline Insights"
        >
          <div className="flex items-center gap-1.5 text-xs" title="Total em aberto (exclui Ganho e Perdido)">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Aberto:</span>
            <span className="font-semibold tabular-nums">{formatEURFull(insights.openTotal)}</span>
          </div>
          <div
            className="flex items-center gap-1.5 text-xs"
            title="Total ganho nos últimos 30 dias"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-muted-foreground">Ganho 30d:</span>
            <span className="font-semibold tabular-nums">{formatEURFull(insights.wonLast30)}</span>
          </div>
          <div
            className="flex items-center gap-1.5 text-xs"
            title="Taxa de conversão global (Ganho / (Ganho + Perdido) por contagem)"
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-muted-foreground">Conversão:</span>
            <span className="font-semibold tabular-nums">
              {insights.globalRate === null ? "—" : `${insights.globalRate.toFixed(1)}%`}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 text-xs"
            title="Tempo médio desde criação dos negócios abertos (em dias)"
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Idade méd.:</span>
            <span className="font-semibold tabular-nums">
              {insights.avgAgeDays !== null ? `${insights.avgAgeDays}d` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
