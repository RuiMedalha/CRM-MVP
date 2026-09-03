/**
 * Hook para buscar dados de AI Call Runs.
 */

import { useQuery } from "@tanstack/react-query";
import { getAiCallRunsByCall, listAiCallRuns, AiCallRun } from "../../integrations/directus/ai-call-runs";

export function useAiCallRunByCall(callId: number | string | undefined) {
  return useQuery<AiCallRun[]>({
    queryKey: ["ai-call-run", callId],
    queryFn: () => getAiCallRunsByCall(callId!),
    enabled: !!callId,
    staleTime: 30_000,
  });
}

export function useAiCallRunsList(params?: {
  limit?: number;
  sentiment?: string;
  status?: string;
}) {
  return useQuery<AiCallRun[]>({
    queryKey: ["ai-call-runs", params],
    queryFn: () => listAiCallRuns(params),
    staleTime: 15_000,
  });
}

export function useLatestCallRunByContact(callIds: (number | string)[] | undefined) {
  // Busca o run mais recente para uma lista de call IDs
  return useQuery<AiCallRun | null>({
    queryKey: ["ai-call-run-latest", callIds],
    queryFn: async () => {
      if (!callIds || callIds.length === 0) return null;
      // Busca do mais recente primeiro
      for (const cid of callIds.slice(0, 5)) {
        const runs = await getAiCallRunsByCall(cid);
        if (runs.length > 0) return runs[0];
      }
      return null;
    },
    enabled: !!callIds && callIds.length > 0,
    staleTime: 30_000,
  });
}
