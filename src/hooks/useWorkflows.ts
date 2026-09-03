/**
 * React Query Hooks for Workflows & Workflow Executions
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflowActive,
  listWorkflowExecutions,
  executeWorkflowTest,
  type WorkflowRow,
  type WorkflowExecutionRow,
} from "@/integrations/directus/workflows";
import { toast } from "@/hooks/use-toast";

export const WORKFLOWS_QUERY_KEY = ["workflows"];
export const WORKFLOW_EXECUTIONS_QUERY_KEY = ["workflow_executions"];

export function useWorkflows(params?: { collection?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: [...WORKFLOWS_QUERY_KEY, params],
    queryFn: () => listWorkflows(params),
    staleTime: 1000 * 30, // 30s
  });
}

export function useWorkflow(id: string | null | undefined) {
  return useQuery({
    queryKey: [...WORKFLOWS_QUERY_KEY, id],
    queryFn: () => (id ? getWorkflow(id) : null),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<WorkflowRow>) => createWorkflow(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      toast({
        title: "Workflow Criado",
        description: "O novo workflow de automação foi guardado com sucesso.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao criar workflow",
        description: err?.message || "Ocorreu um erro ao gravar o workflow.",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkflowRow> }) =>
      updateWorkflow(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...WORKFLOWS_QUERY_KEY, updated.id] });
      toast({
        title: "Workflow Atualizado",
        description: "As alterações foram guardadas com sucesso.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao atualizar",
        description: err?.message || "Não foi possível atualizar o workflow.",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY });
      toast({
        title: "Workflow Removido",
        description: "O workflow foi eliminado com sucesso.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao eliminar",
        description: err?.message || "Não foi possível eliminar o workflow.",
        variant: "destructive",
      });
    },
  });
}

export function useToggleWorkflowActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      toggleWorkflowActive(id, is_active),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY });
      toast({
        title: updated.is_active ? "Workflow Ativado" : "Workflow Pausado",
        description: `O workflow "${updated.name}" está agora ${updated.is_active ? "ativo" : "inativo"}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao alterar estado",
        description: err?.message || "Não foi possível alterar o estado do workflow.",
        variant: "destructive",
      });
    },
  });
}

/**
 * useWorkflowExecutions(workflowId)
 * Lists executions with 30s automatic polling as requested in requirement.
 */
export function useWorkflowExecutions(workflowId?: string, limit: number = 50) {
  return useQuery({
    queryKey: [...WORKFLOW_EXECUTIONS_QUERY_KEY, workflowId, limit],
    queryFn: () => listWorkflowExecutions({ workflow_id: workflowId, limit }),
    refetchInterval: 30000, // Polling 30s
    staleTime: 10000,
  });
}

export function useExecuteWorkflowTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflow, sampleItem }: { workflow: WorkflowRow; sampleItem: Record<string, any> }) =>
      executeWorkflowTest(workflow, sampleItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_EXECUTIONS_QUERY_KEY });
      toast({
        title: "Execução de Teste Concluída",
        description: "O workflow foi executado com o item de teste.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Falha no Teste",
        description: err?.message || "O teste do workflow falhou.",
        variant: "destructive",
      });
    },
  });
}
