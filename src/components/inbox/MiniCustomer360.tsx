import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Phone,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ActiveDealCard } from "./ActiveDealCard";
import type { DealRow } from "@/integrations/directus/deals";
import {
  listActiveDealsByCustomerIds,
} from "@/integrations/directus/deals";
import {
  listActiveQuotationsByCustomerIds,
} from "@/integrations/directus/quotations";
import type { ContactItem } from "@/integrations/directus/contacts";

function initials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface MiniCustomer360Props {
  contact: ContactItem | null;
  loading?: boolean;
  customerId?: string | number | null;
  className?: string;
  onCreateQuotation?: (customerId: string | number) => void;
  onChangeStage?: (deal: DealRow, nextStatus: string) => void;
}

export function MiniCustomer360({
  contact,
  loading,
  customerId,
  className,
  onCreateQuotation,
  onChangeStage,
}: MiniCustomer360Props) {
  const hasCustomerId = customerId !== undefined && customerId !== null && customerId !== "";

  const { data: activeDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ["mini-360-deals", String(customerId ?? "")],
    queryFn: () => listActiveDealsByCustomerIds([String(customerId ?? "")], { limit: 5 }),
    enabled: hasCustomerId,
    staleTime: 60_000,
  });

  const { data: openQuotations = [] } = useQuery({
    queryKey: ["mini-360-quotations", String(customerId ?? "")],
    queryFn: () => listActiveQuotationsByCustomerIds([String(customerId ?? "")], { limit: 50 }),
    enabled: hasCustomerId,
    staleTime: 60_000,
  });

  const totalOpen = openQuotations.reduce(
    (sum: number, q: any) => sum + (Number(q?.total_amount ?? 0) || 0),
    0,
  );
  const totalFmt = totalOpen.toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  const primaryDeal = activeDeals[0] as DealRow | undefined;

  return (
    <aside
      aria-label="Mini ficha 360 do cliente"
      className={cn(
        "flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto border-l border-border bg-card/40 p-3",
        className,
      )}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar cliente…
        </div>
      ) : !contact ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-6 w-6 opacity-40" />
          Sem cliente vinculado a esta conversa.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-base font-bold text-primary">
                {initials(
                  contact.company_name ||
                    contact.full_name ||
                    String(contact.id || "?"),
                )}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {contact.company_name || contact.full_name || "Sem nome"}
              </p>
              {contact.company_name && contact.full_name ? (
                <p className="truncate text-xs text-muted-foreground">
                  {contact.full_name}
                </p>
              ) : null}
              {contact.email ? (
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{contact.email}</span>
                </p>
              ) : null}
              {contact.phone ? (
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span className="truncate">{contact.phone}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Propostas em aberto
              </p>
              <p className="text-base font-bold text-foreground">{totalFmt}</p>
              <p className="text-[10px] text-muted-foreground">
                {openQuotations.length} proposta{openQuotations.length === 1 ? "" : "s"}
              </p>
            </div>
            {hasCustomerId && onCreateQuotation ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onCreateQuotation(customerId as string | number)}
                className="h-9 gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Criar Proposta
              </Button>
            ) : null}
          </div>

          {dealsLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> A procurar negócio…
            </div>
          ) : primaryDeal ? (
            <ActiveDealCard
              deal={primaryDeal}
              onChangeStage={(next) =>
                onChangeStage?.(primaryDeal, next as string)
              }
              onCreateQuotation={
                hasCustomerId && onCreateQuotation
                  ? () => onCreateQuotation(customerId as string | number)
                  : undefined
              }
            />
          ) : null}

          {contact.id ? (
            <Link
              to={`/customer360/${String(contact.id)}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Abrir ficha completa <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </>
      )}
    </aside>
  );
}
