import { SectionCard } from "./ui/SectionCard";
import { StatusBadge } from "./ui/StatusBadge";
import { EmptyState } from "./ui/EmptyState";

interface OpportunityEntry {
  id: string;
  title: string;
  stage: string;
  value?: number;
  probability?: number;
  assignedTo?: string;
  lastActivity?: string;
  nextAction?: string;
}

interface OpportunityPanelProps {
  opportunities: OpportunityEntry[];
}

const STAGE_CONFIG: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "muted" }> = {
  lead: { label: "Lead", variant: "muted" },
  qualificacao: { label: "Qualificação", variant: "info" },
  proposta: { label: "Proposta", variant: "warning" },
  negociacao: { label: "Negociação", variant: "warning" },
  ganho: { label: "Ganha", variant: "success" },
  perdido: { label: "Perdida", variant: "danger" },
};

export function OpportunityPanel({ opportunities }: OpportunityPanelProps) {
  return (
    <SectionCard title="Pipeline">
      {opportunities.length === 0 ? (
        <EmptyState icon="🎯" message="Ainda não existem oportunidades para esta empresa." />
      ) : (
        <div className="space-y-2">
          {opportunities.map((opp) => {
            const config = STAGE_CONFIG[opp.stage] ?? { label: opp.stage, variant: "muted" as const };
            return (
              <div key={opp.id} className="rounded-lg border border-border p-2.5 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[13px] font-medium truncate">{opp.title}</span>
                  <StatusBadge label={config.label} variant={config.variant} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {opp.value && <span className="font-mono font-medium text-foreground">€{opp.value.toLocaleString("pt-PT")}</span>}
                  {opp.probability != null && <span>{opp.probability}% prob.</span>}
                  {opp.assignedTo && <span>👤 {opp.assignedTo}</span>}
                  {opp.lastActivity && <span>🕐 {opp.lastActivity}</span>}
                </div>
                {opp.nextAction && (
                  <div className="mt-1 text-xs text-primary font-medium">→ {opp.nextAction}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
