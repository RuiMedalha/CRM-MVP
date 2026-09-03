import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  realtimeClient,
  type RealtimeEventType,
  type RealtimeMessagePayload,
} from "@/services/realtime/client";
import { useCrossTabBus } from "@/store/crossTabBus";
import { toast } from "@/hooks/use-toast";

export interface UseRealtimeOptions<T = any> {
  event?: RealtimeEventType;
  queryKeys?: (string | unknown[])[];
  onEvent?: (payload: RealtimeMessagePayload<T>) => void;
  showToast?: boolean | ((payload: RealtimeMessagePayload<T>) => { title: string; description?: string; variant?: "default" | "destructive" } | null);
  enabled?: boolean;
}

// Default queries to invalidate per collection
const DEFAULT_INVALIDATE_MAP: Record<string, string[][]> = {
  leads: [
    ["leads"],
    ["leads-page"],
    ["leads-pending-count"],
    ["leads-recent-dashboard"],
    ["monitor-leads"],
    ["dashboard"],
  ],
  deals: [
    ["deals"],
    ["deal"],
    ["pipeline"],
    ["dashboard"],
    ["monitor-deals"],
  ],
  contacts: [
    ["contacts"],
    ["contacts-directus"],
    ["customer360"],
    ["dashboard"],
  ],
  activity: [
    ["activity"],
    ["activities"],
    ["monitor-leads"],
    ["monitor-emails"],
    ["monitor-deals"],
  ],
  whatsapp_messages: [
    ["messages"],
    ["conversations"],
    ["unread-count"],
    ["dashboard"],
  ],
  messages: [
    ["messages"],
    ["conversations"],
    ["unread-count"],
    ["dashboard"],
  ],
  email_threads: [
    ["dashboard-email-stats"],
    ["emails"],
    ["email-threads"],
    ["monitor-emails"],
    ["dashboard"],
  ],
  quotations: [
    ["quotations"],
    ["proposals"],
    ["monitor-proposals"],
    ["dashboard-email-stats"],
  ],
  follow_ups: [
    ["follow-ups"],
    ["dashboard-overdue-followups"],
    ["agenda"],
  ],
};

export function useRealtime<T = any>(
  collectionOrCollections: string | string[],
  options: UseRealtimeOptions<T> = {}
) {
  const queryClient = useQueryClient();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const collections = Array.isArray(collectionOrCollections)
    ? collectionOrCollections
    : [collectionOrCollections];

  const collectionsKey = collections.join(",");

  useEffect(() => {
    if (options.enabled === false) return;

    const unsubs = collections.map((col) => {
      return realtimeClient.subscribe<T>(col, (payload) => {
        const currentOptions = optionsRef.current;
        const targetEvent = currentOptions.event || "*";

        // Filter event type if specified
        if (targetEvent !== "*" && payload.event !== targetEvent) {
          return;
        }

        // 1. Invalidate React Query keys
        const customKeys = currentOptions.queryKeys;
        const defaultKeys = DEFAULT_INVALIDATE_MAP[payload.collection] || [];
        const keysToInvalidate = customKeys || defaultKeys;

        keysToInvalidate.forEach((k) => {
          const queryKey = Array.isArray(k) ? k : [k];
          queryClient.invalidateQueries({ queryKey });
        });

        // 2. Custom onEvent callback
        if (currentOptions.onEvent) {
          try {
            currentOptions.onEvent(payload);
          } catch (e) {
            console.error(`[useRealtime] Error in onEvent callback for ${col}:`, e);
          }
        }

        // 3. Optional Toast notification
        if (currentOptions.showToast) {
          if (typeof currentOptions.showToast === "function") {
            const toastInfo = currentOptions.showToast(payload);
            if (toastInfo) {
              toast(toastInfo);
            }
          } else {
            // Default toast format
            const item = Array.isArray(payload.data) ? payload.data[0] : payload.data;
            const name = item?.display_name || item?.contact_name || item?.title || item?.name || "Item";
            const action =
              payload.event === "create"
                ? "criado"
                : payload.event === "update"
                ? "atualizado"
                : "removido";

            toast({
              title: `${payload.collection.toUpperCase()}: ${name}`,
              description: `Registo ${action} em tempo real.`,
            });
          }
        }
      });
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [collectionsKey, options.enabled, queryClient]);

  // Method to emit events from the hook
  const emit = useCallback(
    (
      event: RealtimeEventType,
      data: T,
      targetCollection?: string,
      meta?: Record<string, any>
    ) => {
      const col = targetCollection || collections[0] || "activity";
      useCrossTabBus.getState().emit(col, event as any, data, meta);
    },
    [collections]
  );

  return {
    emit,
    isSocketOpen: realtimeClient.isSocketOpen(),
    tabId: realtimeClient.getTabId(),
  };
}
