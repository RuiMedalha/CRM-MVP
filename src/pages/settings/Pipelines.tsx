/**
 * Pipelines Settings — gerir pipelines e stages (CRUD + drag-to-reorder + color picker + probability).
 */

import { useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  usePipelines,
  useCreatePipeline,
  usePatchPipeline,
  useDeletePipeline,
  useStages,
  useCreateStage,
  usePatchStage,
  useDeleteStage,
  useReorderStages,
} from "@/hooks/usePipelines";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit3, GripVertical, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import type { PipelineRow, PipelineStageRow } from "@/integrations/directus/pipelines";

// ─── Color presets ───
const COLOR_PRESETS = [
  "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899",
  "#22c55e", "#ef4444", "#6366f1", "#14b8a6",
  "#f97316", "#84cc16", "#06b6d4", "#a855f7",
  "#64748b", "#78716c", "#dc2626", "#16a34a",
];

function PipelineColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          className={cn(
            "w-6 h-6 rounded-full border-2 transition-all",
            value === c ? "border-foreground scale-110" : "border-transparent hover:scale-110",
          )}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

// ─── Pipeline Dialog ───
function PipelineDialog({
  open,
  onOpenChange,
  edit,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: PipelineRow | null;
  onSave: (data: { name: string; description?: string; color: string }) => void;
}) {
  const [name, setName] = useState(edit?.name ?? "");
  const [description, setDescription] = useState(edit?.description ?? "");
  const [color, setColor] = useState(edit?.color ?? "#6366f1");

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    onSave({ name: name.trim(), description: description.trim() || undefined, color });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{edit ? "Editar Pipeline" : "Nova Pipeline"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Vendas Geral" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <Label>Cor</Label>
            <PipelineColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{edit ? "Guardar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stage Dialog ───
function StageDialog({
  open,
  onOpenChange,
  edit,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: PipelineStageRow | null;
  onSave: (data: { name: string; color: string; probability: number; sla_hours?: number }) => void;
}) {
  const [name, setName] = useState(edit?.name ?? "");
  const [color, setColor] = useState(edit?.color ?? "#94a3b8");
  const [probability, setProbability] = useState(edit?.probability ?? 0);
  const [slaHours, setSlaHours] = useState(edit?.sla_hours?.toString() ?? "");

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    onSave({
      name: name.trim(),
      color,
      probability,
      sla_hours: slaHours ? parseInt(slaHours, 10) : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{edit ? "Editar Stage" : "Novo Stage"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Qualificação" />
          </div>
          <div>
            <Label>Cor</Label>
            <PipelineColorPicker value={color} onChange={setColor} />
          </div>
          <div>
            <Label>Probabilidade de fecho: {probability}%</Label>
            <Slider
              value={[probability]}
              onValueChange={([v]) => setProbability(v)}
              max={100}
              step={5}
            />
          </div>
          <div>
            <Label>SLA (horas)</Label>
            <Input
              type="number"
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
              placeholder="Opcional"
              min={0}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{edit ? "Guardar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
export default function Pipelines() {
  const { data: pipelines, isLoading } = usePipelines();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const { data: stages } = useStages(selectedPipelineId ?? undefined);

  const createPipeline = useCreatePipeline();
  const patchPipeline = usePatchPipeline();
  const deletePipeline = useDeletePipeline();
  const createStage = useCreateStage();
  const patchStage = usePatchStage();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();

  const [pipeDialog, setPipeDialog] = useState<{ open: boolean; edit?: PipelineRow | null }>({ open: false });
  const [stageDialog, setStageDialog] = useState<{ open: boolean; edit?: PipelineStageRow | null }>({ open: false });

  // Select first pipeline on load
  const selectedPipeline = useMemo(() => {
    if (!pipelines || pipelines.length === 0) return null;
    const sel = selectedPipelineId ? pipelines.find((p) => p.id === selectedPipelineId) : null;
    return sel ?? pipelines[0];
  }, [pipelines, selectedPipelineId]);

  const orderedStages = useMemo(() => {
    if (!stages || !selectedPipeline) return [];
    return [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [stages, selectedPipeline]);

  // ─── Pipeline CRUD ───
  const handleCreatePipeline = async (data: { name: string; description?: string; color: string }) => {
    try {
      const p = await createPipeline.mutateAsync(data);
      setSelectedPipelineId(p.id);
      toast({ title: `Pipeline "${data.name}" criada` });
    } catch {
      toast({ title: "Erro ao criar pipeline", variant: "destructive" });
    }
  };

  const handleUpdatePipeline = async (data: { name: string; description?: string; color: string }) => {
    if (!selectedPipeline) return;
    try {
      await patchPipeline.mutateAsync({ id: selectedPipeline.id, ...data });
      toast({ title: `Pipeline "${data.name}" actualizada` });
    } catch {
      toast({ title: "Erro ao actualizar pipeline", variant: "destructive" });
    }
  };

  const handleDeletePipeline = async () => {
    if (!selectedPipeline) return;
    try {
      await deletePipeline.mutateAsync(selectedPipeline.id);
      setSelectedPipelineId(null);
      toast({ title: `Pipeline "${selectedPipeline.name}" eliminada` });
    } catch {
      toast({ title: "Erro ao eliminar pipeline", variant: "destructive" });
    }
  };

  // ─── Stage CRUD ───
  const handleCreateStage = async (data: { name: string; color: string; probability: number; sla_hours?: number }) => {
    if (!selectedPipeline) return;
    try {
      await createStage.mutateAsync({
        pipeline_id: selectedPipeline.id,
        ...data,
        order: orderedStages.length,
      });
      toast({ title: `Stage "${data.name}" criado` });
    } catch {
      toast({ title: "Erro ao criar stage", variant: "destructive" });
    }
  };

  const handleUpdateStage = async (data: { name: string; color: string; probability: number; sla_hours?: number }) => {
    if (!stageDialog.edit) return;
    try {
      await patchStage.mutateAsync({ id: stageDialog.edit.id, ...data });
      toast({ title: `Stage "${data.name}" actualizado` });
    } catch {
      toast({ title: "Erro ao actualizar stage", variant: "destructive" });
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    try {
      await deleteStage.mutateAsync(stageId);
      toast({ title: "Stage eliminado" });
    } catch {
      toast({ title: "Erro ao eliminar stage", variant: "destructive" });
    }
  };

  // ─── Stage drag-reorder ───
  const handleStageDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = [...orderedStages];
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    const updates = items.map((s, i) => ({ id: s.id, order: i }));
    try {
      await reorderStages.mutateAsync(updates);
      toast({ title: "Ordem actualizada" });
    } catch {
      toast({ title: "Erro ao reordenar", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Pipelines</h1>
          <Button onClick={() => setPipeDialog({ open: true })}>
            <Plus className="h-4 w-4 mr-1" /> Nova Pipeline
          </Button>
        </div>

        {/* Pipeline selector + actions */}
        {pipelines && pipelines.length > 0 && selectedPipeline && (
          <div className="flex items-center gap-3">
            <Select
              value={selectedPipeline.id}
              onValueChange={(v) => setSelectedPipelineId(v)}
            >
              <SelectTrigger className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPipeDialog({ open: true, edit: selectedPipeline })}
            >
              <Edit3 className="h-3 w-3 mr-1" /> Editar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeletePipeline}
              disabled={pipelines.length <= 1}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Eliminar
            </Button>
          </div>
        )}

        {/* Stages */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Stages</CardTitle>
            <Button
              size="sm"
              onClick={() => setStageDialog({ open: true })}
              disabled={!selectedPipeline}
            >
              <Plus className="h-4 w-4 mr-1" /> Novo Stage
            </Button>
          </CardHeader>
          <CardContent>
            {!selectedPipeline && (
              <p className="text-sm text-muted-foreground">Seleccione uma pipeline para gerir os stages.</p>
            )}

            {selectedPipeline && orderedStages.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum stage definido. Clique em "Novo Stage" para adicionar.</p>
            )}

            <DragDropContext onDragEnd={handleStageDragEnd}>
              <Droppable droppableId="stages">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {orderedStages.map((stage, idx) => (
                      <Draggable key={stage.id} draggableId={stage.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border bg-card transition-shadow",
                              snapshot.isDragging && "shadow-lg ring-2 ring-primary/20",
                            )}
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: stage.color ?? "#94a3b8" }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{stage.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Prob: {stage.probability ?? 0}%
                                {stage.sla_hours != null && ` · SLA: ${stage.sla_hours}h`}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setStageDialog({ open: true, edit: stage })}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDeleteStage(stage.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <PipelineDialog
        open={pipeDialog.open}
        onOpenChange={(v) => setPipeDialog({ open: v, edit: v ? pipeDialog.edit : null })}
        edit={pipeDialog.edit}
        onSave={pipeDialog.edit ? handleUpdatePipeline : handleCreatePipeline}
      />
      <StageDialog
        open={stageDialog.open}
        onOpenChange={(v) => setStageDialog({ open: v, edit: v ? stageDialog.edit : null })}
        edit={stageDialog.edit}
        onSave={stageDialog.edit ? handleUpdateStage : handleCreateStage}
      />
    </AppLayout>
  );
}
