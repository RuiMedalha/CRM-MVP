import { Link, useNavigate } from "react-router-dom";
import { SectionCard } from "./ui/SectionCard";
import { StatusBadge } from "./ui/StatusBadge";
import { EmptyState } from "./ui/EmptyState";
import { Button } from "@/components/ui/button";
import { FileText, Plus, ExternalLink, Sparkles } from "lucide-react";

interface ProposalEntry {
  id: string;
  number: string;
  status: string;
  totalAmount?: number;
  sentAt?: string;
  viewedAt?: string;
  approvedAt?: string;
  notes?: string | null;
}

interface ProposalPanelProps {
  proposals: ProposalEntry[];
  contactId?: string;
  contactName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "muted" }> = {
  draft: { label: "Rascunho", variant: "muted" },
  sent: { label: "Enviada", variant: "info" },
  viewed: { label: "Vista", variant: "warning" },
  approved: { label: "Aprovada", variant: "success" },
  rejected: { label: "Recusada", variant: "danger" },
  expired: { label: "Expirada", variant: "muted" },
};

interface VatBreakdownRow {
  rate: number;
  amount: number;
}

export function parseVatBreakdown(notes: string | null | undefined): VatBreakdownRow[] {
  if (!notes) return [];
  const match = notes.match(/\[IVA discriminado\]\s*(.+?)(?:\n|$)/);
  if (!match) return [];
  return match[1]
    .split("|")
    .map((part) => {
      const m = part.trim().match(/^(\d+)%:\s*€([\d.,]+)$/);
      if (!m) return null;
      const rate = Number(m[1]);
      const amount = Number(m[2].replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(rate) || !Number.isFinite(amount)) return null;
      return { rate, amount };
    })
    .filter((r): r is VatBreakdownRow => r !== null)
    .sort((a, b) => b.rate - a.rate);
}

export function isAutoVatProposal(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return /Convertido da Encomenda/i.test(notes);
}

export function ProposalPanel({ proposals, contactId, contactName }: ProposalPanelProps) {
  const navigate = useNavigate();

  return (
    <SectionCard
      title={`Propostas (${proposals.length})`}
      action={
        <div className="flex items-center gap-2">
          {contactId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate("/propostas/nova", {
                  state: { prefill: { contactId, contactName } },
                })
              }
              className="h-6 text-xs gap-1"
            >
              <Plus className="h-3 w-3" /> Nova
            </Button>
          )}
          <Link
            to="/propostas"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
          >
            Ver todas <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      }
    >
      {proposals.length === 0 ? (
        <EmptyState icon="📄" message="Ainda não existem propostas para este cliente." />
      ) : (
        <div className="space-y-2">
          {proposals.map((p) => {
            const config = STATUS_CONFIG[p.status] ?? { label: p.status, variant: "muted" as const };
            const breakdown = parseVatBreakdown(p.notes);
            const autoVat = isAutoVatProposal(p.notes);
            return (
              <div
                key={p.id}
                className="rounded-lg border border-border p-2.5 hover:shadow-sm hover:bg-accent/30 transition-all cursor-pointer"
                onClick={() => navigate(`/propostas/${p.id}/detalhe`)}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{p.number}</span>
                  <div className="flex items-center gap-1">
                    {autoVat && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:text-emerald-300 border border-emerald-200/50"
                        title="Proposta convertida automaticamente de uma encomenda do site"
                      >
                        <Sparkles className="h-2.5 w-2.5" /> Auto-IVA
                      </span>
                    )}
                    <StatusBadge label={config.label} variant={config.variant} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {p.totalAmount != null && (
                        <span className="font-mono font-medium text-foreground text-[12px]">
                          €{p.totalAmount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      {p.sentAt && <span>Enviada {p.sentAt}</span>}
                      {p.viewedAt && <span>👁 Vista</span>}
                      {p.approvedAt && <span>✅ Aceite</span>}
                    </div>
                    {breakdown.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">IVA:</span>
                        {breakdown.map((row) => (
                          <span key={row.rate} className="font-mono">
                            {row.rate}%: €{row.amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/propostas/${p.id}/detalhe`);
                      }}
                      title="Abrir detalhe da proposta"
                    >
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
