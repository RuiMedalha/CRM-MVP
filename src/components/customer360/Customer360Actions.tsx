/**
 * Customer360Actions — toolbar with 9 quick-action buttons.
 * Each button performs a real action tied to the current contact.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Phone, Mail, MessageCircle, FileText, Target, StickyNote, CheckSquare, MapPin, Wrench, Loader2 } from "lucide-react";
import { useCreateFollowUp } from "@/hooks/useFollowUps";
import { useCreateInteraction } from "@/hooks/useInteractions";
import { useCompanySettings } from "@/hooks/useSettings";
import { useCreateDeal, DEAL_STATUSES } from "@/hooks/useDeals";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Customer360ActionsProps {
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactEmailAssistencia?: string;
}

export function Customer360Actions({ contactId, contactName, contactPhone, contactEmail, contactEmailAssistencia }: Customer360ActionsProps) {
  const navigate = useNavigate();
  const createFollowUp = useCreateFollowUp();
  const createInteraction = useCreateInteraction();
  const { data: settings } = useCompanySettings();

  // Dialog states
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("task");
  const [taskNotes, setTaskNotes] = useState("");
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistEquip, setAssistEquip] = useState("");
  const [assistDesc, setAssistDesc] = useState("");
  const [assistUrgency, setAssistUrgency] = useState("normal");
  const [assistContact, setAssistContact] = useState("telefone");
  const [dealOpen, setDealOpen] = useState(false);

  // 1. Ligar
  const handleCall = useCallback(() => {
    if (!contactPhone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    // Open tel: link (triggers Wavoip/system dialer)
    window.open(`tel:${contactPhone}`, "_self");
    if (contactId) {
      createInteraction.mutate({ type: "call", direction: "out", status: "done", contact_id: contactId, phone: contactPhone, display_name: contactName || "", summary: `Chamada para ${contactName || contactPhone}` });
    }
  }, [contactPhone, contactId, contactName, createInteraction]);

  // 2. WhatsApp
  const handleWhatsApp = useCallback(() => {
    if (!contactPhone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    navigate(`/comunicacoes?phone=${encodeURIComponent(contactPhone)}&name=${encodeURIComponent(contactName || "")}`);
  }, [contactPhone, contactName, navigate]);

  // 3. Email
  const handleEmail = useCallback(() => {
    if (!contactEmail) { toast({ title: "Sem email", variant: "destructive" }); return; }
    window.open(`mailto:${contactEmail}?subject=Contacto - ${contactName || ""}`, "_self");
    if (contactId) {
      createInteraction.mutate({ type: "email", direction: "out", status: "done", contact_id: contactId, email: contactEmail, display_name: contactName || "", summary: `Email para ${contactEmail}` });
    }
  }, [contactEmail, contactId, contactName, createInteraction]);

  // 4. Nova proposta
  const handleNewProposal = useCallback(() => {
    if (!contactId) return;
    navigate('/propostas/nova', {
      state: {
        prefill: {
          contactId,
          contactName: contactName || undefined,
          email: contactEmail || undefined,
          phone: contactPhone || undefined,
        },
      },
    });
  }, [contactId, contactName, contactEmail, contactPhone, navigate]);

  // 5. Nova oportunidade (inline)
  const createDeal = useCreateDeal();
  const [dealTitle, setDealTitle] = useState("");
  const [dealStatus, setDealStatus] = useState("lead");
  const [dealAmount, setDealAmount] = useState("");

  const handleSaveDeal = useCallback(async () => {
    if (!contactId || !dealTitle.trim()) return;
    try {
      await createDeal.mutateAsync({
        title: dealTitle,
        status: dealStatus as any,
        total_amount: dealAmount ? Number(dealAmount) : 0,
        customer_id: contactId,
      });
      toast({ title: "Oportunidade criada", description: `"${dealTitle}" adicionada ao pipeline.` });
      setDealOpen(false);
      setDealTitle("");
      setDealStatus("lead");
      setDealAmount("");
    } catch {
      toast({ title: "Erro ao criar oportunidade", variant: "destructive" });
    }
  }, [contactId, dealTitle, dealStatus, dealAmount, createDeal]);

  // 6. Nova nota
  const handleSaveNote = useCallback(async () => {
    if (!contactId || !noteText.trim()) return;
    try {
      await createInteraction.mutateAsync({
        type: "note", direction: "out", status: "done",
        contact_id: contactId,
        display_name: contactName || "",
        summary: noteText.slice(0, 200),
      });
      toast({ title: "Nota criada" });
      setNoteOpen(false);
      setNoteText("");
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }, [contactId, contactName, noteText, createInteraction]);

  // 7. Nova tarefa / 8. Agendar visita
  const handleSaveTask = useCallback(async () => {
    if (!contactId || !taskTitle.trim()) return;
    try {
      await createFollowUp.mutateAsync({
        contact_id: contactId,
        title: taskTitle,
        type: taskType as "task" | "call" | "email" | "whatsapp" | "visit",
        status: "open",
        notes: taskNotes || undefined,
      });
      toast({ title: taskType === "visit" ? "Visita agendada" : "Tarefa criada" });
      setTaskOpen(false);
      setTaskTitle("");
      setTaskType("task");
      setTaskNotes("");
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }, [contactId, taskTitle, taskType, taskNotes, createFollowUp]);

  // 9. Assistência
  const handleSaveAssist = useCallback(async () => {
    if (!contactId || !assistEquip.trim() || !assistDesc.trim()) {
      toast({ title: "Preenche equipamento e descrição", variant: "destructive" });
      return;
    }
    try {
      // Create interaction/note in timeline
      await createInteraction.mutateAsync({
        type: "note", direction: "out", status: "done",
        contact_id: contactId,
        display_name: contactName || "",
        summary: `[ASSISTÊNCIA] ${assistEquip}: ${assistDesc.slice(0, 100)}`,
      });

      // Open email composer pre-filled
      const assistEmail = (settings as unknown as Record<string, unknown>)?.email_assistencia_interna || "apoio.cliente@hotelequip.pt";
      const subject = encodeURIComponent(`Pedido de Assistência - ${contactName || "Cliente"} - ${assistEquip}`);
      const body = encodeURIComponent(
        `Pedido de Assistência\n\n` +
        `Cliente: ${contactName || "-"}\n` +
        `Equipamento: ${assistEquip}\n` +
        `Descrição: ${assistDesc}\n` +
        `Urgência: ${assistUrgency}\n` +
        `Contacto preferido: ${assistContact}\n` +
        `Telefone: ${contactPhone || "-"}\n` +
        `Email cliente: ${contactEmailAssistencia || contactEmail || "-"}`
      );
      window.open(`mailto:${assistEmail}?subject=${subject}&body=${body}`, "_self");

      toast({ title: "Assistência registada", description: "Email aberto para envio." });
      setAssistOpen(false);
      setAssistEquip("");
      setAssistDesc("");
      setAssistUrgency("normal");
      setAssistContact("telefone");
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }, [contactId, contactName, contactPhone, contactEmail, contactEmailAssistencia, assistEquip, assistDesc, assistUrgency, assistContact, settings, createInteraction]);

  return (
    <>
      <div className="flex flex-wrap gap-1">
        <ActionBtn icon={Phone} label="Ligar" onClick={handleCall} variant="green" />
        <ActionBtn icon={MessageCircle} label="WhatsApp" onClick={handleWhatsApp} variant="green" />
        <ActionBtn icon={Mail} label="Email" onClick={handleEmail} variant="blue" />
        <ActionBtn icon={FileText} label="Nova proposta" onClick={handleNewProposal} />
        <ActionBtn icon={Target} label="Nova oportunidade" onClick={() => setDealOpen(true)} />
        <ActionBtn icon={StickyNote} label="Nova nota" onClick={() => setNoteOpen(true)} />
        <ActionBtn icon={CheckSquare} label="Nova tarefa" onClick={() => setTaskOpen(true)} />
        <ActionBtn icon={MapPin} label="Agendar visita" onClick={() => { setTaskType("visit"); setTaskOpen(true); }} />
        <ActionBtn icon={Wrench} label="Assistência" onClick={() => setAssistOpen(true)} />
      </div>

      {/* Nova nota dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Nota</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nota</Label>
              <textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Escreve a nota..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNote} disabled={!noteText.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova tarefa / Agendar visita dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{taskType === "visit" ? "Agendar Visita" : "Nova Tarefa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={taskType === "visit" ? "Visita a..." : "Título da tarefa"} className="mt-1" />
            </div>
            {taskType !== "visit" && (
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Tarefa</SelectItem>
                    <SelectItem value="call">Chamada</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Notas</Label>
              <textarea rows={3} value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)} placeholder="Notas opcionais..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTaskOpen(false); setTaskType("task"); }}>Cancelar</Button>
            <Button onClick={handleSaveTask} disabled={!taskTitle.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assistência dialog */}
      <Dialog open={assistOpen} onOpenChange={setAssistOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registar Assistência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Equipamento / Produto</Label>
              <Input value={assistEquip} onChange={(e) => setAssistEquip(e.target.value)} placeholder="Ex: Forno Convotherm" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Descrição da avaria</Label>
              <textarea rows={3} value={assistDesc} onChange={(e) => setAssistDesc(e.target.value)} placeholder="Descreve o problema..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Urgência</Label>
                <Select value={assistUrgency} onValueChange={setAssistUrgency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Contacto preferido</Label>
                <Select value={assistContact} onValueChange={setAssistContact}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssistOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAssist} disabled={!assistEquip.trim() || !assistDesc.trim()}>Registar e Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova oportunidade dialog */}
      <Dialog open={dealOpen} onOpenChange={setDealOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Oportunidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="Ex: Equipamento cozinha Hotel X" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Etapa</Label>
                <Select value={dealStatus} onValueChange={setDealStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEAL_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor (€)</Label>
                <Input type="number" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} placeholder="0" className="mt-1" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Cliente: {contactName || "—"}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDealOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDeal} disabled={!dealTitle.trim() || createDeal.isPending}>
              {createDeal.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const VARIANT_CLASSES = {
  green: "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40",
  blue: "text-blue-700 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40",
  default: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
} as const;

function ActionBtn({ icon: Icon, label, onClick, variant = "default" }: { icon: typeof Phone; label: string; onClick?: () => void; variant?: keyof typeof VARIANT_CLASSES }) {
  return (
    <Button variant="ghost" size="sm" className={cn("h-7 text-xs gap-1.5 rounded-md px-2", VARIANT_CLASSES[variant])} onClick={onClick}>
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
