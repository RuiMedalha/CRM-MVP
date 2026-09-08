import * as React from "react";
import { Flame, Phone, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveProposalView } from "@/hooks/useActiveProposalViews";

export interface ProposalViewToastProps {
  view: ActiveProposalView;
  onDismiss?: (id: ActiveProposalView["quotation_id"]) => void;
  /** Optional callback fired when user clicks "Ligar agora" */
  onCall?: (view: ActiveProposalView) => void;
  /** Optional callback fired when user clicks "WhatsApp" */
  onWhatsApp?: (view: ActiveProposalView) => void;
  className?: string;
}

const TOAST_DURATION_MS = 8_000;
const MAX_TOASTS = 3;

/**
 * Toast visualmente destacado para "Proposta Aberta Agora!" (estilo PandaDoc / Brevo).
 *
 * Não é auto-renderizado — é um *visual* usado por `ProposalViewToastStack`.
 * Mantém-se durante 8 segundos e oferece três acções: Ligar agora, WhatsApp e Fechar.
 *
 * Stack máximo: 3 toasts, FIFO (a `ProposalViewToastStack` controla isso).
 */
export const ProposalViewToast = React.forwardRef<HTMLDivElement, ProposalViewToastProps>(
  function ProposalViewToast({ view, onDismiss, onCall, onWhatsApp, className }, ref) {
    const handleDismiss = React.useCallback(() => {
      onDismiss?.(view.quotation_id);
    }, [onDismiss, view.quotation_id]);

    React.useEffect(() => {
      const t = setTimeout(handleDismiss, TOAST_DURATION_MS);
      return () => clearTimeout(t);
    }, [handleDismiss]);

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        data-testid="proposal-view-toast"
        className={cn(
          "pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-orange-500/50 bg-gradient-to-br from-orange-50 via-red-50 to-amber-50 p-4 pr-10 shadow-lg shadow-orange-500/20 dark:border-orange-500/40 dark:from-orange-950/50 dark:via-red-950/40 dark:to-amber-950/30",
          className,
        )}
      >
        {/* Animated flame icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-md animate-pulse">
          <Flame className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-orange-950 dark:text-orange-100">
            🔥 {view.customer_name} está a ver {view.quotation_number || `#${view.quotation_id}`} neste momento!
          </p>
          <p className="mt-1 text-xs text-orange-900/80 dark:text-orange-200/80">
            Janela de 60 segundos para fazer follow-up.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onCall?.(view)}
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            >
              <Phone className="h-3.5 w-3.5" />
              Ligar agora
            </button>
            <button
              type="button"
              onClick={() => onWhatsApp?.(view)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar alerta"
          className="absolute right-2 top-2 rounded-md p-1 text-orange-900/60 hover:bg-orange-500/10 hover:text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Animated progress bar at the bottom */}
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-1 bg-orange-500/70"
          style={{
            width: "100%",
            animation: `proposal-toast-progress ${TOAST_DURATION_MS}ms linear forwards`,
          }}
        />
        <style>{`
          @keyframes proposal-toast-progress {
            from { width: 100%; }
            to   { width: 0%; }
          }
        `}</style>
      </div>
    );
  },
);

export interface ProposalViewToastStackProps {
  views: ActiveProposalView[];
  onDismiss?: (id: ActiveProposalView["quotation_id"]) => void;
  onCall?: (view: ActiveProposalView) => void;
  onWhatsApp?: (view: ActiveProposalView) => void;
}

/**
 * Renderiza uma stack (máx 3) de `ProposalViewToast` no canto inferior direito.
 * FIFO: o toast mais antigo é descartado quando entra um novo e a stack está cheia.
 */
export function ProposalViewToastStack({
  views,
  onDismiss,
  onCall,
  onWhatsApp,
}: ProposalViewToastStackProps) {
  const visible = React.useMemo(() => views.slice(0, MAX_TOASTS), [views]);
  if (visible.length === 0) return null;
  return (
    <div
      aria-label="Alertas de proposta aberta"
      className="pointer-events-none fixed bottom-24 right-4 z-[220] flex w-full max-w-sm flex-col gap-2 md:bottom-8 md:right-6"
    >
      {visible.map((v) => (
        <ProposalViewToast
          key={`proposal-view-${v.quotation_id}`}
          view={v}
          onDismiss={onDismiss}
          onCall={onCall}
          onWhatsApp={onWhatsApp}
        />
      ))}
    </div>
  );
}

export { MAX_TOASTS as PROPOSAL_VIEW_TOAST_MAX, TOAST_DURATION_MS as PROPOSAL_VIEW_TOAST_DURATION_MS };
