import { useDeal } from "@/hooks/useDeals";
import { StageChecklist } from "@/components/pipeline/StageChecklist";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Euro, Building2, User } from "lucide-react";
interface Props { dealId: string; }
export function DealDetail({ dealId }: Props) {
  const { data: deal, isLoading } = useDeal(dealId);
  if (isLoading) return <div className="space-y-4 p-4"><Skeleton className="h-6 w-48"/><Skeleton className="h-20 w-full"/></div>;
  if (!deal) return <div className="p-4 text-sm text-muted-foreground">Negocio nao encontrado</div>;
  return (<div className="space-y-4 p-4">
    <div><h2 className="text-lg font-semibold">{deal.title||"Sem titulo"}</h2>
    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
      <span className="flex items-center gap-1"><Euro className="h-3.5 w-3.5"/>{(deal.total_amount||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</span>
      {deal.customer&&<span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5"/>{deal.customer.company_name||"Sem cliente"}</span>}
      {deal.status&&<Badge variant="outline">{deal.status}</Badge>}
    </div></div>
    <Tabs defaultValue="tasks"><TabsList><TabsTrigger value="tasks">Tarefas</TabsTrigger><TabsTrigger value="detalhes">Detalhes</TabsTrigger></TabsList>
    <TabsContent value="tasks" className="mt-2"><StageChecklist dealId={dealId} stageId={deal.stage_id}/></TabsContent>
    <TabsContent value="detalhes" className="mt-2 space-y-3 text-sm">
      <div><span className="text-muted-foreground">Criado em: </span>{deal.date_created?new Date(deal.date_created).toLocaleDateString("pt-PT"):"-"}</div>
      {deal.owner_employee_id&&<div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground"/><span>{typeof deal.owner_employee_id==="object"?deal.owner_employee_id.full_name:"Responsavel"}</span></div>}
    </TabsContent></Tabs>
  </div>);
}
