/**
 * React Query hooks for Leads with audited mutations.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuditedMutation } from "@/hooks/useAudit";
import {
  createLead,
  patchLead,
  deleteLead,
  fetchRecentLeads,
  fetchLatestIncomingLead,
  fetchMissedLeads,
  type LeadItem,
} from "@/integrations/directus/leads";

export function useRecentLeads(limit = 200) {
  return useQuery({
    queryKey: ["leads", "recent", limit],
    queryFn: () => fetchRecentLeads(limit),
    staleTime: 30_000,
  });
}

export function useLatestIncomingLead() {
  return useQuery({
    queryKey: ["leads", "incoming"],
    queryFn: fetchLatestIncomingLead,
    staleTime: 10_000,
  });
}

export function useMissedLeads() {
  return useQuery({
    queryKey: ["leads", "missed"],
    queryFn: fetchMissedLeads,
    staleTime: 60_000,
  });
}

export function useCreateLead() {
  return useAuditedMutation({
    collection: "leads",
    action: "create",
    invalidateKeys: [["leads"]],
    mutationFn: async (payload: Partial<LeadItem>) => {
      return await createLead(payload) as any;
    },
  });
}

export function usePatchLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LeadItem> & { id: string }) => {
      return await patchLead(id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteLead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
