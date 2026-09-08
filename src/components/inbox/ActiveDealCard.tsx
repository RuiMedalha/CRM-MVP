import { Flame, ArrowRight, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DealRow, DealStatus } from "@/integrations/directus/deals";

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  qualificacao: "Qualificação",
  proposta: "Proposta",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

const STAGES_ORDER: DealStatus[] = [
  "lead",
  "qualificacao",
  "proposta",
  "negociacao",
  "ganho",
  "perdido",
];

export interface ActiveDealCardProps {
  deal: DealRow;
  className?: string;
  changingStage?: boolean;
  onChangeStage?: (next: DealStatus) => void;
  onCreateQuotation?: () => void;
}

export function ActiveDealCard({
  deal,
  className,
  changingStage,
  onChangeStage,
  onCreateQuotation,
}: ActiveDealCardProps) {
  const currentIdx = STAGES_ORDER.indexOf(deal.status || "lead");
  const total = (deal.total_amount ?? 0).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  const nextStage = currentIdx >= 0 ? STAGES_ORDER[currentIdx + 1] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <Flame className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {deal.title || "Negócio ativo"}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{total}</span>
            {" · "}
            Fase: {STAGE_LABEL[deal.status || "lead"] || deal.status || "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {nextStage && onChangeStage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={changingStage}
            onClick={() => onChangeStage(nextStage)}
            className="h-9 text-xs"
          >
            {changingStage ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="mr-1 h-3.5 w-3.5" />
            )}
            Mudar Fase
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            Sem próxima fase
          </span>
        )}
        {onCreateQuotation ? (
          <Button
            type="button"
            size="sm"
            onClick={onCreateQuotation}
            className="h-9 text-xs"
          >
            <FileText className="mr-1 h-3.5 w-3.5" />
            Criar Proposta
          </Button>
        ) : null}
      </div>
    </div>
  );
}
