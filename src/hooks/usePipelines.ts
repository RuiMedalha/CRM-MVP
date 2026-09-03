/**
 * React Query hooks for Pipelines + Pipeline Stages.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPipelines,
  createPipeline,
  patchPipeline,
  deletePipeline,
  listStages,
  createStage,
  patchStage,
  deleteStage,
  reorderStages,
  type PipelineRow,
  type PipelineStageRow,
} from "@/integrations/directus/pipelines";

// ─── Pipelines ───

export function usePipelines() {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: listPipelines,
    staleTime: 60_000,
  });
}

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PipelineRow>) => createPipeline(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipelines"] }); },
  });
}

export function usePatchPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PipelineRow> & { id: string }) => patchPipeline(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipelines"] }); },
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await deletePipeline(id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipelines"] }); },
  });
}

// ─── Stages ───

export function useStages(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-stages", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      return listStages(pipelineId);
    },
    enabled: !!pipelineId,
    staleTime: 60_000,
  });
}

export function useCreateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PipelineStageRow>) => createStage(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline-stages"] }); },
  });
}

export function usePatchStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PipelineStageRow> & { id: string }) => patchStage(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline-stages"] }); },
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await deleteStage(id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline-stages"] }); },
  });
}

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stages: { id: string; order: number }[]) => reorderStages(stages),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline-stages"] }); },
  });
}
