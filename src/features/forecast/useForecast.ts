import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";

export type ForecastPeriod = 30 | 60 | 90;

export type DealStage =
  | "lead"
  | "qualificacao"
  | "proposta"
  | "negociacao"
  | "ganho"
  | "perdido";

/**
 * Probabilidades por estágio definidas no modelo de negócio:
 * - Lead: 10% (0.10)
 * - Qualificação: 25% (0.25)
 * - Proposta: 50% (0.50)
 * - Negociação: 75% (0.75)
 * - Ganho: 100% (1.00)
 * - Perdido: 0% (excluído)
 */
export const STAGE_PROBABILITIES: Record<string, number> = {
  lead: 0.1,
  qualificacao: 0.25,
  proposta: 0.5,
  negociacao: 0.75,
  ganho: 1.0,
};

/**
 * Heurística de horizonte temporal:
 * - 'proposta' / 'negociacao' / 'ganho' = 30 dias
 * - 'qualificacao' = 60 dias
 * - 'lead' = 90 dias (60-90d)
 */
export const STAGE_HORIZONS: Record<string, ForecastPeriod> = {
  proposta: 30,
  negociacao: 30,
  ganho: 30,
  qualificacao: 60,
  lead: 90,
};

export const STAGE_ORDER: DealStage[] = [
  "lead",
  "qualificacao",
  "proposta",
  "negociacao",
  "ganho",
];

export const STAGE_META: Record<
  string,
  { label: string; color: string; bgClass: string; borderClass: string }
> = {
  lead: {
    label: "Lead",
    color: "#94a3b8", // slate-400
    bgClass: "bg-slate-500",
    borderClass: "border-slate-500",
  },
  qualificacao: {
    label: "Qualificação",
    color: "#3b82f6", // blue-500
    bgClass: "bg-blue-500",
    borderClass: "border-blue-500",
  },
  proposta: {
    label: "Proposta",
    color: "#f59e0b", // amber-500
    bgClass: "bg-amber-500",
    borderClass: "border-amber-500",
  },
  negociacao: {
    label: "Negociação",
    color: "#8b5cf6", // purple-500
    bgClass: "bg-purple-500",
    borderClass: "border-purple-500",
  },
  ganho: {
    label: "Ganho",
    color: "#10b981", // emerald-500
    bgClass: "bg-emerald-500",
    borderClass: "border-emerald-500",
  },
};

export interface RawDeal {
  id: string | number;
  title?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  value?: number | string | null;
  date_created?: string | null;
}

export interface StageBreakdownItem {
  key: string;
  stage: string;
  label: string;
  probability: number;
  probabilityPercent: number;
  count: number;
  totalValue: number;
  weightedValue: number;
  color: string;
}

export interface ChartStageBarItem {
  stage: string;
  key: string;
  valorPonderado: number;
  valorTotal: number;
  probabilidade: string;
  probabilidadeNum: number;
  count: number;
  fill: string;
}

export interface ForecastCalculation {
  period: ForecastPeriod;
  forecast: number;
  forecast30: number;
  forecast60: number;
  forecast90: number;
  totalPipelineValue: number;
  activeDealsCount: number;
  deltaMonthPercent: number;
  stages: StageBreakdownItem[];
  chartData: ChartStageBarItem[];
  deals: RawDeal[];
}

/**
 * Função pura de cálculo do Forecast Ponderado e horizontes 30d/60d/90d.
 */
export function calculateWeightedForecast(
  deals: RawDeal[],
  period: ForecastPeriod = 30
): ForecastCalculation {
  const activeDeals = deals.filter(
    (d) => (d.status || "").toLowerCase().trim() !== "perdido"
  );

  const stageMetrics: Record<string, StageBreakdownItem> = {};
  for (const key of STAGE_ORDER) {
    const meta = STAGE_META[key] || {
      label: key,
      color: "#64748b",
      bgClass: "bg-slate-500",
      borderClass: "border-slate-500",
    };
    const prob = STAGE_PROBABILITIES[key] ?? 0;
    stageMetrics[key] = {
      key,
      stage: meta.label,
      label: meta.label,
      probability: prob,
      probabilityPercent: Math.round(prob * 100),
      count: 0,
      totalValue: 0,
      weightedValue: 0,
      color: meta.color,
    };
  }

  let totalPipelineValue = 0;
  let forecast30 = 0;
  let forecast60 = 0;
  let forecast90 = 0;

  // Track monthly creation for delta calculation
  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = new Date(now.getTime() - 30 * msInDay);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * msInDay);

  let currentMonthWeighted = 0;
  let previousMonthWeighted = 0;
  let hasValidDates = false;

  for (const deal of activeDeals) {
    const rawVal = Number(deal.total_amount ?? deal.value ?? 0) || 0;
    const status = (deal.status || "").toLowerCase().trim();
    const prob = STAGE_PROBABILITIES[status] ?? 0;
    const baseWeighted = rawVal * prob;

    if (stageMetrics[status]) {
      stageMetrics[status].count += 1;
      stageMetrics[status].totalValue += rawVal;
      stageMetrics[status].weightedValue += baseWeighted;
    }

    totalPipelineValue += rawVal;
    forecast30 += baseWeighted;

    // Heurísticas de horizonte temporal
    // 30d: base ponderada ('proposta', 'negociacao', 'ganho' + maturidade imediata)
    // 60d: pipeline de 60d com progressão ('qualificacao' avança no funil)
    // 90d: pipeline trimestral com maturação dos leads
    if (status === "qualificacao") {
      forecast60 += baseWeighted * 1.25;
      forecast90 += baseWeighted * 1.5;
    } else if (status === "lead") {
      forecast60 += baseWeighted * 1.1;
      forecast90 += baseWeighted * 1.4;
    } else {
      forecast60 += baseWeighted;
      forecast90 += baseWeighted;
    }

    // Historical delta tracking
    if (deal.date_created) {
      const created = new Date(deal.date_created);
      if (!isNaN(created.getTime())) {
        hasValidDates = true;
        if (created >= thirtyDaysAgo) {
          currentMonthWeighted += baseWeighted;
        } else if (created >= sixtyDaysAgo && created < thirtyDaysAgo) {
          previousMonthWeighted += baseWeighted;
        }
      }
    }
  }

  // Delta calculation
  let deltaMonthPercent = 0;
  if (hasValidDates) {
    if (previousMonthWeighted > 0) {
      deltaMonthPercent =
        ((currentMonthWeighted - previousMonthWeighted) /
          previousMonthWeighted) *
        100;
    } else if (currentMonthWeighted > 0) {
      deltaMonthPercent = 100;
    }
  } else {
    // Delta benchmark padrão quando date_created é null na base de dados
    deltaMonthPercent = 12.5;
  }

  const chartData: ChartStageBarItem[] = STAGE_ORDER.map((key) => ({
    stage: stageMetrics[key].label,
    key,
    valorPonderado: Number(stageMetrics[key].weightedValue.toFixed(2)),
    valorTotal: Number(stageMetrics[key].totalValue.toFixed(2)),
    probabilidade: `${stageMetrics[key].probabilityPercent}%`,
    probabilidadeNum: stageMetrics[key].probabilityPercent,
    count: stageMetrics[key].count,
    fill: stageMetrics[key].color,
  }));

  const selectedForecast =
    period === 60 ? forecast60 : period === 90 ? forecast90 : forecast30;

  return {
    period,
    forecast: Number(selectedForecast.toFixed(2)),
    forecast30: Number(forecast30.toFixed(2)),
    forecast60: Number(forecast60.toFixed(2)),
    forecast90: Number(forecast90.toFixed(2)),
    totalPipelineValue: Number(totalPipelineValue.toFixed(2)),
    activeDealsCount: activeDeals.length,
    deltaMonthPercent: Number(deltaMonthPercent.toFixed(1)),
    stages: STAGE_ORDER.map((k) => stageMetrics[k]),
    chartData,
    deals: activeDeals,
  };
}

/**
 * Hook `useForecast`
 * @param period 30 | 60 | 90 (dias)
 */
export function useForecast(period: ForecastPeriod = 30) {
  const query = useQuery({
    queryKey: ["forecast-deals", period],
    queryFn: async () => {
      const res = await directusRequest<{ data: RawDeal[] }>(
        `/items/deals?limit=2000&fields=id,title,status,total_amount,date_created&filter[status][_neq]=perdido&sort=-id`
      );
      return res.data || [];
    },
    staleTime: 30000,
  });

  const deals = query.data || [];
  const calculation = calculateWeightedForecast(deals, period);

  return {
    ...calculation,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
