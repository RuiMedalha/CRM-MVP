import { useEffect, useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDeals, useUpdateDeal } from "@/hooks/useDeals";
import { usePipelines, useStages } from "@/hooks/usePipelines";
import { useContacts } from "@/hooks/useContacts";
import { useManufacturers } from "@/hooks/useManufacturers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Euro, ChevronLeft, ChevronRight, Filter, X, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { DealDialog } from "@/components/deals/DealDialog";
import { DealCard } from "@/components/deals/DealCard";
import { useStageTasks, useActiveSlaBreaches } from "@/hooks/useChecklistSla";
import { getSlaBreachState } from "@/integrations/directus/checklistSla";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast, notifyRealtimeDeal } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listFollowUps } from "@/integrations/directus/follow-ups";
import { QuickNextStepDialog } from "@/components/common/QuickNextStepDialog";
import { SavedFiltersPopover } from "@/components/SavedFiltersPopover";
import type { PipelineStageRow } from "@/integrations/directus/pipelines";
import { useRealtime } from "@/hooks/useRealtime";
import { useCrossTabBus } from "@/store/crossTabBus";
import { useAuth } from "@/contexts/AuthContext";

const PIPELINE_COLORS: Record<string, string> = {
  "lead": "border-t-yellow-400",
  "qualificacao": "border-t-blue-400",
  "proposta": "border-t-purple-400",
  "negociacao": "border-t-pink-400",
  "ganho": "border-t-green-400",
  "perdido": "border-t-red-400",
};

const DEFAULT_STAGES: PipelineStageRow[] = [
  { id: "lead", pipeline_id: "default", name: "Lead", color: "#facc15", order: 1 },
  { id: "qualificacao", pipeline_id: "default", name: "Qualificação", color: "#60a5fa", order: 2 },
  { id: "proposta", pipeline_id: "default", name: "Proposta", color: "#c084fc", order: 3 },
  { id: "negociacao", pipeline_id: "default", name: "Negociação", color: "#f472b6", order: 4 },
  { id: "ganho", pipeline_id: "default", name: "Ganho", color: "#4ade80", order: 5 },
  { id: "perdido", pipeline_id: "default", name: "Perdido", color: "#f87171", order: 6 },
];

function getStageColor(stage: PipelineStageRow): string {
  const key = (stage.id || stage.name || "").toLowerCase();
  if (PIPELINE_COLORS[key]) {
    return PIPELINE_COLORS[key];
  }
  const nameKey = (stage.name || "").toLowerCase();
  if (PIPELINE_COLORS[nameKey]) {
    return PIPELINE_COLORS[nameKey];
  }
  return stage.color ? `border-t-[${stage.color}]` : "border-t-slate-300";
}

export default function Pipeline() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: pipelines } = usePipelines();
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const { data: stages, isLoading: stagesLoading } = useStages(activePipelineId ?? undefined);

  const effectiveStages = useMemo<PipelineStageRow[]>(() => {
    if (stages && stages.length > 0) return stages;
    return DEFAULT_STAGES;
  }, [stages]);
  const { data: contacts } = useContacts();
  const { data: manufacturers } = useManufacturers();
  const updateDeal = useUpdateDeal();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const { data: slaBreaches } = useActiveSlaBreaches();
  const breachedDealIds = useMemo(() => new Set((slaBreaches || []).map((b) => b.deal_id)), [slaBreaches]);

  // Activity-Based Selling: Follow-ups em aberto ligados a deals
  const { data: openFollowUps } = useQuery({
    queryKey: ["follow_ups"],
    queryFn: () => listFollowUps({ status: "open", limit: 500 }),
  });

  const followUpsByDealId = useMemo(() => {
    const map = new Map<string, { title: string; due_at: string; type?: string; isOverdue?: boolean }>();
    if (!openFollowUps) return map;
    const now = new Date();
    for (const fu of openFollowUps) {
      const dealId = typeof fu.deal_id === "object" ? fu.deal_id?.id : fu.deal_id;
      if (dealId && !map.has(dealId)) {
        const isOverdue = fu.due_at ? new Date(fu.due_at) < now : false;
        map.set(dealId, {
          title: fu.title || "Seguimento",
          due_at: fu.due_at || "",
          type: fu.type || undefined,
          isOverdue,
        });
      }
    }
    return map;
  }, [openFollowUps]);

  const [nextStepDeal, setNextStepDeal] = useState<{
    id: string;
    title: string;
    contactId?: string | null;
    customerName?: string | null;
  } | null>(null);

  // Cross-tab Realtime deals subscription
  const { emit } = useRealtime("deals", {
    onEvent: (payload) => {
      if (payload.event === "update" && payload.data) {
        const item = Array.isArray(payload.data) ? payload.data[0] : payload.data;
        const dealTitle = item?.title || "Negócio";
        const stageName = payload.meta?.stageName || item?.stage_id || "nova etapa";
        notifyRealtimeDeal(dealTitle, stageName, payload.meta?.userName);
      }
    },
  });

  // Filtros
  const [filters, setFilters] = useState({
    search: "",
    customerId: "",
    manufacturerId: "",
    minValue: "",
    maxValue: "",
  });

  // Select active pipeline: from URL, or default, or first
  useEffect(() => {
    if (!pipelines || pipelines.length === 0) return;
    const fromUrl = searchParams.get("pipeline");
    if (fromUrl) {
      setActivePipelineId(fromUrl);
      return;
    }
    const def = pipelines.find((p) => p.is_default);
    if (def) {
      setActivePipelineId(def.id);
      return;
    }
    setActivePipelineId(pipelines[0].id);
  }, [pipelines, searchParams]);

  // Deep-link: /pipeline?dealId=...
  useEffect(() => {
    const dealId = searchParams.get("dealId");
    if (dealId) setSelectedDealId(String(dealId));
  }, [searchParams]);

  // Aplicar filtros
  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    return deals.filter((deal) => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const mt = deal.title?.toLowerCase().includes(s);
        const mc = (deal as any).customer?.company_name?.toLowerCase().includes(s);
        if (!mt && !mc) return false;
      }
      if (filters.customerId && deal.customer_id !== filters.customerId) return false;
      if (filters.manufacturerId && deal.manufacturer_id !== filters.manufacturerId) return false;
      if (filters.minValue) {
        const min = parseFloat(filters.minValue);
        if (!isNaN(min) && (deal.total_amount || 0) < min) return false;
      }
      if (filters.maxValue) {
        const max = parseFloat(filters.maxValue);
        if (!isNaN(max) && (deal.total_amount || 0) > max) return false;
      }
      return true;
    });
  }, [deals, filters]);

  const hasActiveFilters =
    filters.search || filters.customerId || filters.manufacturerId || filters.minValue || filters.maxValue;

  const clearFilters = () => {
    setFilters({ search: "", customerId: "", manufacturerId: "", minValue: "", maxValue: "" });
  };

  // Agrupar deals por stage_id (fallback: status string para deals sem pipeline)
  const getDealsByStage = useCallback(
    (stage: PipelineStageRow) => {
      return filteredDeals.filter((deal) => {
        if ((deal as any).stage_id) {
          return (deal as any).stage_id === stage.id;
        }
        // Fallback para deals sem pipeline: mapeia status antigo para stage id ou nome
        const st = (deal.status ?? "").toLowerCase();
        return st === stage.id.toLowerCase() || st === stage.name.toLowerCase();
      });
    },
    [filteredDeals],
  );

  const getColumnTotal = useCallback(
    (stage: PipelineStageRow) => {
      return getDealsByStage(stage).reduce(
        (sum, deal) => sum + Number((deal as any).total_amount || 0),
        0,
      );
    },
    [getDealsByStage],
  );

  const toggleColumn = (id: string) => {
    setCollapsedColumns((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      const targetStageId = destination.droppableId;
      const deal = deals?.find((d) => String(d.id) === draggableId);
      if (!deal) return;

      try {
        await updateDeal.mutateAsync({
          id: draggableId,
          stage_id: targetStageId,
          status: targetStageId,
          pipeline_id: activePipelineId ?? undefined,
        } as any);
        const stageLabel = effectiveStages.find((s) => s.id === targetStageId)?.name ?? targetStageId;
        toast({ title: `Movido para ${stageLabel}`, duration: 2000 });
        emit(
          "update",
          { id: draggableId, stage_id: targetStageId, title: deal.title, total_amount: deal.total_amount },
          "deals",
          { userName: user?.email || "Utilizador", stageName: stageLabel }
        );

        // Activity-Based Selling (Pipedrive/HubSpot): ao mudar de etapa, garantir que o negócio tem próximo passo
        const isClosedStage = ["ganho", "perdido", "fechado"].includes(stageLabel.toLowerCase());
        const hasFollowUp = followUpsByDealId.has(deal.id);
        if (!isClosedStage && !hasFollowUp) {
          setNextStepDeal({
            id: deal.id,
            title: deal.title || "Negócio",
            contactId: deal.customer_id,
            customerName: deal.customer?.company_name,
          });
        }
      } catch {
        toast({ title: "Erro ao mover negócio", variant: "destructive", duration: 3000 });
      }
    },
    [deals, effectiveStages, activePipelineId, updateDeal, emit, user, followUpsByDealId],
  );

  const activePipeline = pipelines?.find((p) => p.id === activePipelineId);
  const isLoading = dealsLoading || (stagesLoading && !!activePipelineId);

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Pipeline</h1>
            {pipelines && pipelines.length > 1 && (
              <Select
                value={activePipelineId ?? ""}
                onValueChange={(v) => setActivePipelineId(v)}
              >
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Selecionar pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <SavedFiltersPopover
              variant="pipeline"
              filters={filters}
              onApply={(saved) => setFilters(saved as any)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-1 w-2 h-2 bg-primary rounded-full inline-block" />
              )}
            </Button>
            <Button size="sm" onClick={() => setIsNewDealOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo Negócio
            </Button>
          </div>
        </div>

        {/* Filtros expansíveis */}
        {showFilters && (
          <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs">Pesquisa</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Título ou cliente..."
                    className="pl-7 h-8 text-sm"
                    value={filters.search}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  />
                </div>
              </div>
              <div className="w-40">
                <Label className="text-xs">Cliente</Label>
                <Select
                  value={filters.customerId}
                  onValueChange={(v) => setFilters((f) => ({ ...f, customerId: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name || c.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs">Fornecedor</Label>
                <Select
                  value={filters.manufacturerId}
                  onValueChange={(v) => setFilters((f) => ({ ...f, manufacturerId: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers?.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <Label className="text-xs">Valor min</Label>
                <Input
                  type="number"
                  className="h-8 text-sm"
                  value={filters.minValue}
                  onChange={(e) => setFilters((f) => ({ ...f, minValue: e.target.value }))}
                />
              </div>
              <div className="w-28">
                <Label className="text-xs">Valor max</Label>
                <Input
                  type="number"
                  className="h-8 text-sm"
                  value={filters.maxValue}
                  onChange={(e) => setFilters((f) => ({ ...f, maxValue: e.target.value }))}
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Pipeline Columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-3 min-h-0 h-full">
            <DragDropContext onDragEnd={handleDragEnd}>
              {(!effectiveStages || effectiveStages.length === 0) && !isLoading && (
                <div className="flex items-center justify-center w-full text-muted-foreground">
                  <p>Nenhuma etapa de pipeline configurada.</p>
                </div>
              )}
              {isLoading &&
                [...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-64 lg:w-72">
                    <Card className="h-full">
                      <CardHeader className="pb-2 px-3 pt-3">
                        <Skeleton className="h-4 w-20 mb-2" />
                        <Skeleton className="h-3 w-16" />
                      </CardHeader>
                      <CardContent className="px-2 pb-2">
                        <Skeleton className="h-20 w-full mb-2" />
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  </div>
                ))}
              {effectiveStages.map((stage) => {
                const columnDeals = getDealsByStage(stage);
                const columnTotal = getColumnTotal(stage);
                const isCollapsed = collapsedColumns.includes(stage.id);

                if (isCollapsed) {
                  return (
                    <div key={stage.id} className="flex-shrink-0 w-12">
                      <Card className={cn("h-full", getStageColor(stage))}>
                        <CardContent className="p-2 flex flex-col items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleColumn(stage.id)}
                            title="Expandir coluna"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {columnDeals.length}
                          </Badge>
                          <div className="text-[10px] font-medium text-muted-foreground [writing-mode:vertical-lr] rotate-180">
                            {stage.name}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                }

                return (
                  <div key={stage.id} className="flex-shrink-0 w-64 lg:w-72">
                    <Card className={cn("h-full", getStageColor(stage))}>
                      <CardHeader className="pb-2 px-3 pt-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                            {stage.name}
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {columnDeals.length}
                            </Badge>
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleColumn(stage.id)}
                            title="Colapsar coluna"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Euro className="h-3 w-3" />
                          {columnTotal.toLocaleString("pt-PT", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </div>
                      </CardHeader>

                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <CardContent
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "space-y-2 max-h-[calc(100vh-320px)] min-h-[100px] overflow-y-auto scrollbar-thin px-2 pb-2 transition-colors",
                              snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset rounded-lg",
                            )}
                          >
                            {columnDeals.length === 0 && !snapshot.isDraggingOver ? (
                              <div className="text-center py-6 text-muted-foreground text-xs">
                                Sem negócios
                              </div>
                            ) : (
                              columnDeals.map((deal, index) => (
                                <Draggable
                                  key={String(deal.id)}
                                  draggableId={String(deal.id)}
                                  index={index}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      style={provided.draggableProps.style}
                                    >
                                      <DealCard
                                        deal={deal as any}
                                        onClick={() => setSelectedDealId(deal.id)}
                                        isDragging={snapshot.isDragging}
                                        nextFollowUp={followUpsByDealId.get(deal.id) || null}
                                        onAddNextStep={() =>
                                          setNextStepDeal({
                                            id: deal.id,
                                            title: deal.title || "Negócio",
                                            contactId: deal.customer_id,
                                            customerName: deal.customer?.company_name,
                                          })
                                        }
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))
                            )}
                            {provided.placeholder}
                          </CardContent>
                        )}
                      </Droppable>
                    </Card>
                  </div>
                );
              })}
            </DragDropContext>
          </div>
        </div>
      </div>

      {/* Quick Next Step Dialog (Activity-Based Selling) */}
      {nextStepDeal && (
        <QuickNextStepDialog
          open={!!nextStepDeal}
          onClose={() => setNextStepDeal(null)}
          dealId={nextStepDeal.id}
          dealTitle={nextStepDeal.title}
          contactId={nextStepDeal.contactId}
          customerName={nextStepDeal.customerName}
          onDone={() => setNextStepDeal(null)}
        />
      )}

      {/* Deal Dialog */}
      <DealDialog
        dealId={selectedDealId}
        open={!!selectedDealId || isNewDealOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDealId(null);
            setIsNewDealOpen(false);
          }
        }}
      />
    </AppLayout>
  );
}
