import { useState } from "react";
import { useStageTasks, useCreateStageTask, usePatchStageTask, useDeleteStageTask } from "@/hooks/useChecklistSla";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
interface Props { dealId: string; stageId?: string; compact?: boolean; }
export function StageChecklist({ dealId, stageId, compact }: Props) {
  const { data: tasks, isLoading } = useStageTasks(dealId);
  const ct = useCreateStageTask(); const pt = usePatchStageTask(); const dt = useDeleteStageTask();
  const [nt, setNt] = useState("");
  const add = () => { const t = nt.trim(); if (!t) return; ct.mutate({deal_id:dealId,stage_id:stageId||"",text:t,order:(tasks?.length||0)+1}); setNt(""); };
  const toggle = (t) => pt.mutate({id:t.id,done:!t.done});
  const del = (id) => dt.mutate(id);
  const dc = tasks?.filter(t=>t.done).length||0;
  const cls = "space-y-2" + (compact ? " text-xs" : "");
  return (<div className={cls}>
    {!compact && (<div className="flex items-center justify-between"><h4 className="text-sm font-medium">Checklist</h4><Badge variant="outline">{dc}/{tasks?.length||0}</Badge></div>)}
    {isLoading ? <div className="py-4 text-center text-sm text-muted-foreground">A carregar...</div> : (
      <ScrollArea className={compact?"max-h-32":"max-h-64"}>
        {tasks?.map(t=>(<div key={t.id} className="flex items-center gap-2 group hover:bg-muted/50 rounded px-1 py-0.5">
          <Checkbox checked={t.done} onCheckedChange={()=>toggle(t)} className="h-4 w-4 shrink-0" />
          <span className={"flex-1 text-sm"+(t.done?" line-through text-muted-foreground":"")}>{t.text}</span>
          {t.due_at && <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5"><Clock className="h-3 w-3"/>{new Date(t.due_at).toLocaleDateString("pt-PT")}</span>}
          {t.assigned_to_employee_id && <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px]">{typeof t.assigned_to_employee_id==="object"?t.assigned_to_employee_id.full_name?.charAt(0)||"U":"U"}</AvatarFallback></Avatar>}
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={()=>del(t.id)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
        </div>))}
      </ScrollArea>
    )}
    {compact ? <button onClick={e=>e.stopPropagation()} className="text-xs text-primary hover:underline w-full text-left">{dc}/{tasks?.length||0} tarefas</button>
    : <div className="flex items-center gap-2 pt-1"><Input placeholder="Nova tarefa..." value={nt} onChange={e=>setNt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")add();}} className="h-8 text-sm"/><Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={add}><Plus className="h-4 w-4"/></Button></div>}
  </div>);
}
