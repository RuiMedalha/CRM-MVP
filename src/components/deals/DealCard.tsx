import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Euro, Building2, FileText, Clock, CalendarCheck, AlertCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DealNextFollowUp {
  title: string;
  due_at: string;
  type?: string;
  isOverdue?: boolean;
}

interface DealCardProps {
  deal: {
    id: string;
    title: string | null;
    total_amount: number | null;
    date_created?: string | null;
    customer?: { company_name: string } | null;
    quotations?: { id: string; pdf_link: string | null; status: string }[] | null;
  };
  nextFollowUp?: DealNextFollowUp | null;
  onAddNextStep?: () => void;
  onClick: () => void;
  isDragging: boolean;
}

function getDaysAge(dateCreated?: string | null): number | null {
  if (!dateCreated) return null;
  const created = new Date(dateCreated);
  if (isNaN(created.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function getAgeColor(days: number): string {
  if (days <= 7) return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40";
  if (days <= 30) return "text-amber-600 bg-amber-50 dark:bg-amber-950/40";
  return "text-red-600 bg-red-50 dark:bg-red-950/40";
}

export function DealCard({ deal, nextFollowUp, onAddNextStep, onClick, isDragging }: DealCardProps) {
  const pdfQuotation = deal.quotations?.find(q => q.pdf_link);
  const daysAge = getDaysAge(deal.date_created);

  const handlePdfClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pdfQuotation?.pdf_link) {
      window.open(pdfQuotation.pdf_link, '_blank');
    }
  };

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all bg-card select-none",
        isDragging
          ? "shadow-lg ring-2 ring-primary/50 rotate-2 scale-105"
          : "hover:shadow-md hover:scale-[1.02]"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 cursor-grab active:cursor-grabbing" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <p className="font-medium text-sm truncate flex-1">
                {deal.title || "Sem título"}
              </p>
              {pdfQuotation && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-primary hover:text-primary/80"
                  onClick={handlePdfClick}
                  title="Abrir PDF do orçamento"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate">
                {deal.customer?.company_name || "Sem cliente"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 text-sm font-medium">
                <Euro className="h-3 w-3 text-primary" />
                {(deal.total_amount || 0).toLocaleString("pt-PT", {
                  style: "currency",
                  currency: "EUR",
                })}
              </div>
              {daysAge !== null && (
                <span className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium", getAgeColor(daysAge))}>
                  <Clock className="h-2.5 w-2.5" />
                  {daysAge}d
                </span>
              )}
            </div>

            {/* Activity-Based Selling: Próximo Passo */}
            <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px]">
              {nextFollowUp ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium truncate max-w-[190px]",
                    nextFollowUp.isOverdue
                      ? "text-red-600 dark:text-red-400 font-semibold"
                      : "text-emerald-700 dark:text-emerald-400"
                  )}
                  title={`${nextFollowUp.title} (${new Date(nextFollowUp.due_at).toLocaleDateString("pt-PT")})`}
                >
                  {nextFollowUp.isOverdue ? (
                    <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
                  ) : (
                    <CalendarCheck className="h-3 w-3 shrink-0 text-emerald-600" />
                  )}
                  <span className="truncate">{nextFollowUp.title}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddNextStep?.();
                  }}
                  className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 dark:text-amber-400 font-semibold hover:underline"
                  title="Agendar próximo passo para evitar estagnação do negócio"
                >
                  <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
                  <span>Sem próximo passo</span>
                  <Plus className="h-2.5 w-2.5 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
