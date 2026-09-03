/**
 * FollowUpsPanel — lista e criação de follow-ups ligados a um contacto.
 * Substitui o placeholder "módulo em migração" no Customer360Shell.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Phone, Mail, MessageCircle, Calendar, CheckSquare, MapPin } from "lucide-react";
import { useFollowUps, useCreateFollowUp, usePatchFollowUp } from "@/hooks/useFollowUps";
import { toast } from "@/hooks/use-toast";

interface FollowUpsPanelProps {
  contactId: string | undefined;
}

const TYPE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  task: CheckSquare,
  visit: MapPin,
};

const TYPE_LABELS: Record<string, string> = {
  call: "Chamada",
  email: "Email",
  whatsapp: "WhatsApp",
  task: "Tarefa",
  visit: "Visita",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 border-amber-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  done: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function FollowUpsPanel({ contactId }: FollowUpsPanelProps) {
  const { data: followUps, isLoading } = useFollowUps(
    contactId ? { contactId: Number(contactId) } : undefined
  );
  const createFollowUp = useCreateFollowUp();
  const patchFollowUp = usePatchFollowUp();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("task");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");

  const handleCreate = useCallback(async () => {
    if (!contactId || !title.trim()) return;
    try {
      await createFollowUp.mutateAsync({
        contact_id: Number(contactId),
        title: title.trim(),
        type: type,
        status: "open",
        notes: notes || undefined,
        due_at: dueAt || undefined,
      });
      toast({ title: "Follow-up criado" });
      setDialogOpen(false);
      setTitle("");
      setType("task");
      setNotes("");
      setDueAt("");
    } catch {
      toast({ title: "Erro ao criar follow-up", variant: "destructive" });
    }
  }, [contactId, title, type, notes, dueAt, createFollowUp]);

  const handleComplete = useCallback(async (id: string) => {
    try {
      await patchFollowUp.mutateAsync({ id, patch: { status: "done", completed_at: new Date().toISOString() } });
      toast({ title: "Marcado como concluído" });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  }, [patchFollowUp]);

  const pending = (followUps || []).filter((f) => f.status === "open");
  const completed = (followUps || []).filter((f) => f.status === "done");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Follow-ups</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">A carregar...</p>}

      {!isLoading && pending.length === 0 && completed.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Sem follow-ups para este contacto.</p>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Pendentes ({pending.length})</p>
          {pending.map((f) => {
            const Icon = TYPE_ICONS[f.type || "task"] || CheckSquare;
            return (
              <div key={f.id} className="flex items-start gap-2 rounded-md border p-2.5">
                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.title || "Sem título"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-xs px-1.5 py-0 h-4 ${STATUS_COLORS.open}`}>
                      {TYPE_LABELS[f.type || "task"] || f.type}
                    </Badge>
                    {f.due_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(f.due_at).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                  {f.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{f.notes}</p>}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => handleComplete(f.id)} title="Marcar como concluído">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Concluídos ({completed.length})</p>
          {completed.slice(0, 5).map((f) => {
            const Icon = TYPE_ICONS[f.type || "task"] || CheckSquare;
            return (
              <div key={f.id} className="flex items-start gap-2 rounded-md border border-dashed p-2 opacity-60">
                <Icon className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs line-through truncate">{f.title || "Sem título"}</p>
                  {f.completed_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.completed_at).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para confirmar entrega" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Tarefa</SelectItem>
                    <SelectItem value="call">Chamada</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="visit">Visita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data limite</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas opcionais..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!title.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
