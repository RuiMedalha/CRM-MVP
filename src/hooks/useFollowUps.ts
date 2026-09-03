import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuditedMutation } from "@/hooks/useAudit";
import { createFollowUp, listFollowUps, patchFollowUp, type FollowUpRow } from "@/integrations/directus/follow-ups";

export function useFollowUps(params?: Parameters<typeof listFollowUps>[0]) {
  return useQuery({
    queryKey: ["follow-ups", params || {}],
    queryFn: async () => await listFollowUps(params),
  });
}

export function useCreateFollowUp() {
  return useAuditedMutation({
    collection: "follow_ups",
    action: "create",
    invalidateKeys: [["follow-ups"]],
    mutationFn: async (payload: Partial<FollowUpRow>) => {
      return await createFollowUp(payload) as any;
    },
  });
}

export function usePatchFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FollowUpRow> }) => await patchFollowUp(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
    },
  });
}
