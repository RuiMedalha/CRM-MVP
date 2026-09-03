/**
 * PipelineKanban — visão compacta do pipeline de uma Organization.
 * Apenas visual, sem drag&drop.
 * Reutilizável: Customer360, Pipeline page (filtrado por org).
 */

import { cn } from "@/lib/utils";

interface PipelineKanbanProps {
  currentStage: string;
}

const STAGES = [
  { key: "lead", label: "Lead" },
  { key: "qualificacao", label: "Qualificação" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "ganho", label: "Ganho" },
];

export function PipelineKanban({ currentStage }: PipelineKanbanProps) {
  const activeIndex = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-0.5">
      {STAGES.map((stage, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        return (
          <div
            key={stage.key}
            className={cn(
              "flex-1 text-center py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors",
              isActive && "bg-primary text-primary-foreground",
              isPast && "bg-primary/15 text-primary",
              !isActive && !isPast && "bg-muted text-muted-foreground"
            )}
          >
            {stage.label}
          </div>
        );
      })}
    </div>
  );
}
