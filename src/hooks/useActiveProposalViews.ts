import { useEffect, useState, useCallback, useMemo } from "react";

/**
 * Hook utilitário para manter a lista de "visualizações activas" (últimos 60s).
 * Não fala com o backend — apenas normaliza a lista de quotations activas.
 * Quem produz essa lista é `useProposalViewAlerts`, que pode chamar
 * `setActiveViews(...)` para alimentar este hook.
 *
 * Retorna a lista de `(quotation_id, customer_name, last_viewed_at)` para uso
 * em componentes (futuro dashboard, contador no sidebar, etc.).
 */
export interface ActiveProposalView {
  quotation_id: string | number;
  customer_name: string;
  quotation_number?: string;
  last_viewed_at: string; // ISO
}

export interface UseActiveProposalViewsApi {
  activeViews: ActiveProposalView[];
  activeCount: number;
  /** Inject / refresh the list from the producer (alert hook). */
  setActiveViews: (views: ActiveProposalView[]) => void;
  /** Clear all active views (used on logout, etc.). */
  clear: () => void;
}

// ─── Module-level singleton store ─────────────────────────────────────────────
// Keeps the list outside React tree so producer (alerts hook) and consumer
// (sidebar badge, dashboard) see the same data without prop drilling.
let _store: ActiveProposalView[] = [];
const _listeners = new Set<() => void>();

function _emit() {
  for (const cb of _listeners) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}

function _filterActive(now: number): ActiveProposalView[] {
  const WINDOW_MS = 60_000;
  return _store.filter((v) => {
    const ts = Date.parse(v.last_viewed_at);
    if (!Number.isFinite(ts)) return false;
    return now - ts <= WINDOW_MS;
  });
}

export function useActiveProposalViews(): UseActiveProposalViewsApi {
  const [, force] = useState(0);

  useEffect(() => {
    const cb = () => force((n) => n + 1);
    _listeners.add(cb);
    return () => {
      _listeners.delete(cb);
    };
  }, []);

  const activeViews = useMemo(() => _filterActive(Date.now()), [/* re-eval on store changes */]);

  const setActiveViews = useCallback((next: ActiveProposalView[]) => {
    _store = Array.isArray(next) ? next : [];
    _emit();
  }, []);

  const clear = useCallback(() => {
    _store = [];
    _emit();
  }, []);

  return {
    activeViews,
    activeCount: activeViews.length,
    setActiveViews,
    clear,
  };
}
