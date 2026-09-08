import { useEffect, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { realtimeClient, type RealtimeMessagePayload } from "@/services/realtime/client";
import { toast } from "@/hooks/use-toast";
import { useActiveProposalViews, type ActiveProposalView } from "@/hooks/useActiveProposalViews";

// ─── Backend placeholder ──────────────────────────────────────────────────────
// FUTURE WEB SOCKET ENDPOINT (not implemented in this sprint):
//   GET  wss://<host>/realtime/proposal-views
//   - auth: ?token=<jwt> or subprotocol header
//   - server pushes: { event: "view", quotation_id, customer_name, last_viewed_at }
//   - server pushes: { event: "leave", quotation_id }  (when client closes tab)
//   - heartbeat: server sends {type:"ping"} every 20s; client replies {type:"pong"}
//
// Until that endpoint exists, we (a) subscribe to the existing `quotations`
// collection (Directus WS already broadcasts item updates on PATCH) and
// (b) fall back to a 30s HTTP poll against /items/quotations filtered by
// last_viewed_at >= now-60s.
//
// In this sprint we do NOT add a backend endpoint.

const ACTIVE_WINDOW_MS = 60_000;
const POLL_FALLBACK_MS = 30_000;
const TOAST_DURATION_MS = 8_000;

// Minimal shape we expect from a quotations item. We use a typed narrow view
// instead of `any` so strict-mode TS stays happy.
interface QuotationPatchPayload {
  id: string | number;
  customer_name?: string;
  quotation_number?: string;
  last_viewed_at?: string;
}

interface ProposalViewAlertEvent {
  quotation_id: string | number;
  customer_name: string;
  quotation_number?: string;
  last_viewed_at: string;
}

interface UseProposalViewAlertsOptions {
  /** Show toast on each new active view (default true). */
  showToast?: boolean;
  /** Enable polling fallback when WS disconnects (default true). */
  enablePollingFallback?: boolean;
}

/**
 * Hook que escuta o evento "cliente está a ver a proposta agora" (≤ 60s).
 *
 * - Subscreve a `quotations.last_viewed_at` via realtimeClient (WebSocket / BroadcastChannel)
 * - Fallback: polling HTTP a cada 30s caso o WS esteja desligado
 * - Dispara toast personalizado (ProposalViewToast) e mantém uma lista singleton
 *   partilhada com `useActiveProposalViews` para badge no sidebar e futuro dashboard.
 *
 * Chamar uma única vez na raiz do app (ex: App.tsx).
 */
export function useProposalViewAlerts(options: UseProposalViewAlertsOptions = {}): void {
  const { showToast = true, enablePollingFallback = true } = options;
  const queryClient = useQueryClient();
  const { setActiveViews } = useActiveProposalViews();
  const seenRef = useRef<Map<string | number, string>>(new Map());
  // AudioContext ref — created lazily on first user interaction (browser policy).
  const audioCtxRef = useRef<AudioContext | null>(null);

  const enabled = showToast || enablePollingFallback;

  // ─── Audio cue (best-effort, never auto-plays without user gesture) ──────
  const tryPlayNotificationSound = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") return; // browser policy: needs user gesture first
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // never crash on audio errors
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Helper: parse a realtime event payload into a ProposalViewAlertEvent.
    const parsePayload = (raw: unknown): ProposalViewAlertEvent | null => {
      if (!raw || typeof raw !== "object") return null;
      const obj = raw as Record<string, unknown>;
      const id = obj.id ?? obj.quotation_id;
      const lastViewedAt = obj.last_viewed_at;
      if (id === undefined || typeof lastViewedAt !== "string") return null;
      const ts = Date.parse(lastViewedAt);
      if (!Number.isFinite(ts)) return null;
      if (Date.now() - ts > ACTIVE_WINDOW_MS) return null;
      const customerName =
        typeof obj.customer_name === "string" && obj.customer_name.trim().length > 0
          ? obj.customer_name
          : "Cliente";
      const quotationNumber =
        typeof obj.quotation_number === "string" ? obj.quotation_number : undefined;
      return {
        quotation_id: id as string | number,
        customer_name: customerName,
        quotation_number: quotationNumber,
        last_viewed_at: lastViewedAt,
      };
    };

    // Helper: refresh the active-views list (deduplicated, newest first).
    const upsertActive = (event: ProposalViewAlertEvent) => {
      const key = String(event.quotation_id);
      const previous = seenRef.current.get(event.quotation_id);
      seenRef.current.set(event.quotation_id, event.last_viewed_at);

      // Only fire toast when last_viewed_at advances (new visit, not same tab refresh).
      const isNewVisit =
        previous === undefined || Date.parse(event.last_viewed_at) > Date.parse(previous);

      if (isNewVisit && showToast) {
        fireToast(event);
      }

      // Rebuild store snapshot from seenRef + parsed values.
      const snapshot: ActiveProposalView[] = [];
      const now = Date.now();
      for (const [idKey, lastViewedAt] of seenRef.current.entries()) {
        const ts = Date.parse(lastViewedAt);
        if (!Number.isFinite(ts) || now - ts > ACTIVE_WINDOW_MS) continue;
        // We don't keep full customer_name in seenRef; rely on what we know.
        // Use the latest event we have for this id if it matches, else a placeholder.
        const isCurrent = idKey === key;
        snapshot.push({
          quotation_id: idKey,
          customer_name: isCurrent ? event.customer_name : "Cliente",
          quotation_number: isCurrent ? event.quotation_number : undefined,
          last_viewed_at: lastViewedAt,
        });
      }
      // Newest first.
      snapshot.sort((a, b) => Date.parse(b.last_viewed_at) - Date.parse(a.last_viewed_at));
      setActiveViews(snapshot);

      // Invalidate proposal queries so UI refreshes.
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    };

    const fireToast = (event: ProposalViewAlertEvent) => {
      const number = event.quotation_number || String(event.quotation_id);
      toast({
        title: `🔥 ${event.customer_name} está a ver ${number} neste momento!`,
        description: "Janela de 60 segundos para fazer follow-up.",
        duration: TOAST_DURATION_MS,
        className:
          "border-orange-500/60 bg-gradient-to-br from-orange-50 to-red-50 text-orange-950 shadow-orange-500/30 shadow-lg dark:from-orange-950/40 dark:to-red-950/40 dark:text-orange-100",
      });
      tryPlayNotificationSound();
    };

    // ─── Subscribe to quotations collection via WS ─────────────────────────
    const unsubscribe = realtimeClient.subscribe<QuotationPatchPayload | QuotationPatchPayload[]>(
      "quotations",
      (payload: RealtimeMessagePayload<QuotationPatchPayload | QuotationPatchPayload[]>) => {
        if (payload.event !== "update" && payload.event !== "create") return;
        const items = Array.isArray(payload.data) ? payload.data : [payload.data];
        for (const item of items) {
          const event = parsePayload(item);
          if (event) upsertActive(event);
        }
      },
    );

    // ─── Polling fallback (HTTP GET /items/quotations filtered) ────────────
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    if (enablePollingFallback) {
      const poll = async () => {
        try {
          const { directusAdminFetch } = await import("@/integrations/directus/client");
          const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
          const res = await directusAdminFetch<{ data?: QuotationPatchPayload[] }>(
            `/items/quotations?filter[last_viewed_at][_gte]=${encodeURIComponent(cutoff)}&fields=id,customer_name,quotation_number,last_viewed_at&limit=50`,
            { method: "GET" },
          );
          const rows = Array.isArray(res?.data) ? res.data : [];
          for (const row of rows) {
            const event = parsePayload(row);
            if (event) upsertActive(event);
          }
        } catch {
          // best-effort, ignore
        } finally {
          pollTimer = setTimeout(poll, POLL_FALLBACK_MS);
        }
      };
      pollTimer = setTimeout(poll, POLL_FALLBACK_MS);
    }

    return () => {
      unsubscribe();
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [enabled, showToast, enablePollingFallback, queryClient, setActiveViews, tryPlayNotificationSound]);
}

// Re-export the payload type for convenience in consumers.
export type { ProposalViewAlertEvent };
