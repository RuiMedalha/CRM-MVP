/**
 * useAuditedMutation — hook que wrappa mutations existentes com auditoria.
 * Antes do update: lê o estado actual via directusRequest.
 * Após sucesso: dispara auditMutation (fire-and-forget).
 */

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { auditMutation } from "@/integrations/directus/audit";
import { directusRequest } from "@/integrations/directus/client";
import { useAuth } from "@/contexts/AuthContext";

interface AuditedMutationConfig<TData = unknown> {
  collection: string;
  action: "create" | "update" | "delete";
  mutationFn: (vars: any) => Promise<TData>;
  invalidateKeys?: string[][];
}

export function useAuditedMutation<TData = unknown, TVars = any>(
  config: AuditedMutationConfig<TData>,
): UseMutationResult<TData, Error, TVars> {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<TData, Error, TVars>({
    mutationFn: async (vars: any) => {
      // Before snapshot (only for updates)
      let before: unknown = null;
      if (config.action === "update" && vars.id) {
        try {
          before = await directusRequest<{ data: unknown }>(
            `/items/${config.collection}/${encodeURIComponent(vars.id)}`,
          );
          before = (before as any)?.data ?? null;
        } catch {
          // best-effort: if read fails, proceed without before
        }
      }

      // Execute original mutation
      const result = await config.mutationFn(vars);

      // Fire-and-forget audit (never blocks UI)
      auditMutation(
        config.collection,
        config.action,
        before,
        result,
        {
          source: "ui",
          user_id: user?.id ?? undefined,
          user_email: user?.email ?? undefined,
        },
      ).catch(() => {
        // already queued by auditMutation on failure
      });

      return result;
    },
    onSuccess: () => {
      if (config.invalidateKeys) {
        for (const key of config.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });
}
