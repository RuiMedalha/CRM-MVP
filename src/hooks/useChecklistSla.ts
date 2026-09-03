import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listStageTasks, createStageTask, patchStageTask, deleteStageTask, listActiveSlaBreaches, listAllSlaBreaches, patchSlaBreach } from "@/integrations/directus/checklistSla";
import type { StageTaskRow, SlaBreachRow } from "@/integrations/directus/checklistSla";
export function useStageTasks(d) { return useQuery({queryKey:["stage-tasks",d],queryFn:async()=>{if(!d)return[];return listStageTasks(d);},enabled:!!d,staleTime:3e4}); }
export function useCreateStageTask() { const q=useQueryClient(); return useMutation({mutationFn:async(p)=>{const r=await createStageTask(p);return r;},onSuccess:()=>{q.invalidateQueries({queryKey:["stage-tasks"]})}}); }
export function usePatchStageTask() { const q=useQueryClient(); return useMutation({mutationFn:async({id,...p})=>patchStageTask(id,p),onSuccess:()=>{q.invalidateQueries({queryKey:["stage-tasks"]})}}); }
export function useDeleteStageTask() { const q=useQueryClient(); return useMutation({mutationFn:async(i)=>{await deleteStageTask(i);},onSuccess:()=>{q.invalidateQueries({queryKey:["stage-tasks"]})}}); }
export function useActiveSlaBreaches() { return useQuery({queryKey:["sla-breaches","active"],queryFn:listActiveSlaBreaches,refetchInterval:6e4,staleTime:3e4}); }
export function useAllSlaBreaches() { return useQuery({queryKey:["sla-breaches","all"],queryFn:()=>listAllSlaBreaches(100),staleTime:6e4}); }
export function usePatchSlaBreach() { const q=useQueryClient(); return useMutation({mutationFn:async({id,...p})=>patchSlaBreach(id,p),onSuccess:()=>{q.invalidateQueries({queryKey:["sla-breaches"]})}}); }
