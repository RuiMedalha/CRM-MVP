import { SectionCard } from "./ui/SectionCard";
import { StatusBadge } from "./ui/StatusBadge";
import { EmptyState } from "./ui/EmptyState";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

interface ProposalEntry {
  id: string;
  number: string;
  status: string;
  totalAmount?: number;
  sentAt?: string;
  viewedAt?: string;
  approvedAt?: string;
}

interface ProposalPanelProps {
  proposals: ProposalEntry[];
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "muted" }> = {
  draft: { label: "Rascunho", variant: "muted" },
  sent: { label: "Enviada", variant: "info" },
  viewed: { label: "Vista", variant: "warning" },
  approved: { label: "Aprovada", variant: "success" },
  rejected: { label: "Recusada", variant: "danger" },
  expired: { label: "Expirada", variant: "muted" },
};

export function ProposalPanel({ proposals }: ProposalPanelProps) {
  return (
    <SectionCard title="Propostas">
      {proposals.length === 0 ? (
        <EmptyState icon="📄" message="Ainda não existem propostas para este cliente." />
      ) : (
        <div className="space-y-2">
          {proposals.map((p) => {
            const config = STATUS_CONFIG[p.status] ?? { label: p.status, variant: "muted" as const };
            return (
              <div key={p.id} className="rounded-lg border border-border p-2.5 hover:shadow-sm hover:bg-accent/30 transition-all cursor-pointer" onClick={() => window.location.href = `/propostas/${p.id}/detalhe`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{p.number}</span>
                  <StatusBadge label={config.label} variant={config.variant} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {p.totalAmount && <span className="font-mono font-medium text-foreground text-[12px]">€{p.totalAmount.toLocaleString("pt-PT")}</span>}
                    {p.sentAt && <span>Enviada {p.sentAt}</span>}
                    {p.viewedAt && <span>👁 Vista</span>}
                    {p.approvedAt && <span>✅ Aceite</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); window.location.href = `/propostas/${p.id}/detalhe`; }}>
                      <FileText className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
