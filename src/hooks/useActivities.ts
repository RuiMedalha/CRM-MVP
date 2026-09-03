/**
 * React Query hooks for the Activity Ledger.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createActivity, listActivities, type ActivityRow } from "@/integrations/directus/activities";

export type { ActivityRow };

/**
 * Lista actividades de um contacto (para timeline unificada).
 */
export function useActivities(contactId?: string | number, options?: { limit?: number; type?: string }) {
  return useQuery({
    queryKey: ["activities", contactId, options?.type],
    queryFn: () => listActivities({ contactId, limit: options?.limit ?? 50, type: options?.type }),
    enabled: !!contactId,
    staleTime: 30_000,
  });
}

/**
 * Mutation para criar uma actividade.
 */
export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Omit<ActivityRow, "id">>) => await createActivity(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
