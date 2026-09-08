/**
 * Sprint B — Vista Calendário Visual da Agenda (FullCalendar v6).
 *
 * Mostra follow-ups/tarefas/chamadas num calendário dia/semana/mês com:
 *   - eventos coloridos por tipo (call=verde, email/whatsapp=âmbar, task=azul)
 *   - eventos vencidos com sobre-cor vermelha (independente do tipo)
 *   - drag-and-drop para reagendar (usa o plugin @fullcalendar/interaction)
 *   - clique no evento abre dialog de detalhes com ações (concluir, reagendar,
 *     abrir deal, ligar)
 *   - botão + Novo e clique num dia vazio abre dialog de criação rápida
 *     com data pré-preenchida
 *   - mobile-first: <768px força dayGridDay, >=768px default timeGridWeek,
 *     >=1280px default dayGridMonth
 *   - dark mode compatível (cores são HSL-friendly via tokens do tema)
 *
 * NÃO mexe em tipos Directus — segue o padrão `any` já existente em Agenda.tsx.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventClickArg,
  EventInput,
  DateSelectArg,
  EventDropArg,
} from "@fullcalendar/core";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Check, Phone, ExternalLink, Pencil, PhoneCall, Mail, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FuRow = {
  id: string;
  status?: string | null;
  type?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  title?: string | null;
  notes?: string | null;
  contact_id?: any;
  quotation_id?: any;
  deal_id?: any;
};

const TYPE_LABELS: Record<string, string> = {
  call: "Chamada",
  email: "Email",
  whatsapp: "WhatsApp",
  task: "Tarefa",
};

const TYPE_COLOR: Record<string, string> = {
  task: "#3b82f6",     // blue-500
  call: "#22c55e",     // green-500
  email: "#f59e0b",    // amber-500
  whatsapp: "#f59e0b", // amber-500 (treated as "follow-up / messaging")
};

function typeIcon(t: string) {
  if (t === "call") return <Phone className="h-4 w-4" />;
  if (t === "email") return <Mail className="h-4 w-4" />;
  if (t === "whatsapp") return <MessageCircle className="h-4 w-4" />;
  return <CalendarClock className="h-4 w-4" />;
}

/** Tailwind breakpoints usados pelo shadcn (md=768, xl=1280). */
function useBreakpoint(): "mobile" | "tablet" | "desktop" {
  const [bp, setBp] = useState<"mobile" | "tablet" | "desktop">(() => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w < 768) return "mobile";
    if (w < 1280) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w < 768) setBp("mobile");
      else if (w < 1280) setBp("tablet");
      else setBp("desktop");
    };
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return bp;
}

type CreateOpts = {
  open: boolean;
  initialDate?: Date | null;
};

type Props = {
  items: FuRow[];
  onComplete: (fu: FuRow) => Promise<void> | void;
  onReschedule: (fu: FuRow, newDueAt: Date) => Promise<void> | void;
  onCreate: (input: { type: string; title: string; notes: string; due_at: string }) => Promise<void> | void;
  onOpenDeal?: (dealId: string) => void;
};

export function CalendarView({ items, onComplete, onReschedule, onCreate, onOpenDeal }: Props) {
  const breakpoint = useBreakpoint();
  const calendarRef = useRef<FullCalendar | null>(null);
  const { toast } = useToast();

  // Dialog state
  const [detailsFor, setDetailsFor] = useState<FuRow | null>(null);
  const [create, setCreate] = useState<CreateOpts>({ open: false, initialDate: null });
  const [rescheduleFor, setRescheduleFor] = useState<FuRow | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");

  // Form state for create dialog
  const [form, setForm] = useState<{ type: string; title: string; notes: string; due_at: string }>({
    type: "task",
    title: "",
    notes: "",
    due_at: "",
  });

  // Ajusta initialView quando o breakpoint muda
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const target =
      breakpoint === "mobile" ? "timeGridDay" :
      breakpoint === "tablet" ? "timeGridWeek" :
      "dayGridMonth";
    if (api.view.type !== target) {
      api.changeView(target);
    }
  }, [breakpoint]);

  // Mapear follow-ups -> eventos FullCalendar
  const events: EventInput[] = useMemo(() => {
    return items
      .filter((fu) => fu.due_at)
      .map((fu) => {
        const type = String(fu.type || "task");
        const baseColor = TYPE_COLOR[type] || TYPE_COLOR.task;
        const isOverdue =
          fu.status === "open" && fu.due_at && new Date(fu.due_at).getTime() < Date.now();
        return {
          id: String(fu.id),
          title: fu.title || TYPE_LABELS[type] || "Tarefa",
          start: fu.due_at as string,
          // Cor: vermelho se overdue, senão cor do tipo
          backgroundColor: isOverdue ? "#ef4444" : baseColor,
          borderColor: isOverdue ? "#dc2626" : baseColor,
          textColor: "#ffffff",
          extendedProps: {
            fu,
            isOverdue,
            type,
          },
        } as EventInput;
      });
  }, [items]);

  // Click num dia vazio -> abre dialog de criação com data pré-preenchida
  const handleDateSelect = (arg: DateSelectArg) => {
    const initial = arg.start;
    setCreate({ open: true, initialDate: initial });
    // datetime-local precisa de "YYYY-MM-DDTHH:mm"
    const pad = (n: number) => String(n).padStart(2, "0");
    const localStr = `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}T${pad(initial.getHours())}:${pad(initial.getMinutes())}`;
    setForm({ type: "task", title: "", notes: "", due_at: localStr });
  };

  // Click num evento -> abre painel de detalhes
  const handleEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    const fu = arg.event.extendedProps.fu as FuRow;
    setDetailsFor(fu);
  };

  // Drag-and-drop para reagendar
  const handleEventDrop = async (arg: EventDropArg) => {
    const fu = arg.event.extendedProps.fu as FuRow;
    if (!arg.event.start) {
      arg.revert();
      return;
    }
    try {
      await onReschedule(fu, arg.event.start);
      toast({ title: "Reagendado" });
    } catch (e: any) {
      toast({ title: "Erro ao reagendar", description: String(e?.message || e), variant: "destructive" });
      arg.revert();
    }
  };

  const openCreateWithToday = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const localStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setForm({ type: "task", title: "", notes: "", due_at: localStr });
    setCreate({ open: true, initialDate: now });
  };

  const submitCreate = async () => {
    if (!form.due_at) {
      toast({ title: "Data/hora em falta", variant: "destructive" });
      return;
    }
    try {
      await onCreate({ ...form });
      toast({ title: "Follow-up criado" });
      setCreate({ open: false, initialDate: null });
      setForm({ type: "task", title: "", notes: "", due_at: "" });
    } catch (e: any) {
      toast({ title: "Erro ao criar", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleFor || !rescheduleDate) return;
    try {
      await onReschedule(rescheduleFor, new Date(rescheduleDate));
      toast({ title: "Reagendado" });
      setRescheduleFor(null);
      setRescheduleDate("");
    } catch (e: any) {
      toast({ title: "Erro ao reagendar", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const initialView =
    breakpoint === "mobile" ? "timeGridDay" :
    breakpoint === "tablet" ? "timeGridWeek" :
    "dayGridMonth";

  return (
    <div className="space-y-3">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        buttonText={{
          today: "Hoje",
          month: "Mês",
          week: "Semana",
          day: "Dia",
        }}
        locale="pt"
        firstDay={1}
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        height="auto"
        contentHeight={700}
        expandRows={true}
        selectable={true}
        selectMirror={true}
        editable={true}
        eventClick={handleEventClick}
        select={handleDateSelect}
        eventDrop={handleEventDrop}
        events={events}
        dayMaxEvents={true}
        nowIndicator={true}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      />

      {/* Botão + Novo (sticky no fundo, visível em qualquer vista) */}
      <div className="flex justify-end">
        <Button onClick={openCreateWithToday} className="shadow-md">
          <CalendarClock className="h-4 w-4 mr-2" />
          Novo follow-up
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-semibold">Legenda:</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: TYPE_COLOR.task }} />Tarefa</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: TYPE_COLOR.call }} />Chamada</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: TYPE_COLOR.whatsapp }} />Email/WhatsApp</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "#ef4444" }} />Vencido</span>
      </div>

      {/* Dialog: Detalhes do evento */}
      <Dialog open={!!detailsFor} onOpenChange={(o) => !o && setDetailsFor(null)}>
        <DialogContent className="max-w-lg">
          {detailsFor && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {typeIcon(String(detailsFor.type || "task"))}
                  {detailsFor.title || TYPE_LABELS[String(detailsFor.type || "task")] || "Tarefa"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detalhes do follow-up.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{TYPE_LABELS[String(detailsFor.type || "task")] || detailsFor.type}</Badge>
                  <Badge variant={detailsFor.status === "done" ? "outline" : (detailsFor.due_at && new Date(detailsFor.due_at).getTime() < Date.now() ? "destructive" : "secondary")}>
                    {detailsFor.status === "done" ? "Concluído" : (detailsFor.due_at && new Date(detailsFor.due_at).getTime() < Date.now() ? "Atrasado" : "Aberto")}
                  </Badge>
                </div>

                {detailsFor.due_at && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Vencimento: </span>
                    <span className="font-medium">{new Date(detailsFor.due_at).toLocaleString("pt-PT")}</span>
                  </div>
                )}

                {detailsFor.notes && (
                  <div className="text-sm whitespace-pre-wrap rounded-md bg-muted/40 p-3">
                    {String(detailsFor.notes)}
                  </div>
                )}

                {detailsFor.contact_id && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Cliente: </span>
                    <span className="font-medium">{detailsFor.contact_id?.company_name || detailsFor.contact_id?.id}</span>
                  </div>
                )}

                {detailsFor.quotation_id && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Orçamento: </span>
                    <span className="font-medium">{detailsFor.quotation_id?.quotation_number || detailsFor.quotation_id?.id}</span>
                  </div>
                )}

                {detailsFor.deal_id && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Deal: </span>
                    <span className="font-medium">{detailsFor.deal_id?.title || detailsFor.deal_id?.id}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await onComplete(detailsFor);
                        toast({ title: "Concluído" });
                        setDetailsFor(null);
                      } catch (e: any) {
                        toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" });
                      }
                    }}
                    disabled={detailsFor.status === "done"}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Marcar concluído
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRescheduleFor(detailsFor);
                      setRescheduleDate(
                        detailsFor.due_at
                          ? new Date(detailsFor.due_at).toISOString().slice(0, 16)
                          : new Date().toISOString().slice(0, 16)
                      );
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Reagendar
                  </Button>
                  {detailsFor.deal_id && onOpenDeal && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenDeal(String(detailsFor.deal_id?.id || detailsFor.deal_id))}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir deal
                    </Button>
                  )}
                  {detailsFor.type === "call" && detailsFor.contact_id?.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <a href={`tel:${detailsFor.contact_id.phone}`}>
                        <PhoneCall className="h-4 w-4 mr-2" />
                        Ligar
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Criar novo follow-up */}
      <Dialog open={create.open} onOpenChange={(o) => !o && setCreate({ open: false, initialDate: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo follow-up</DialogTitle>
            <DialogDescription className="sr-only">
              Criar um novo follow-up com data pré-preenchida.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Tarefa</SelectItem>
                    <SelectItem value="call">Chamada</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data/Hora</Label>
                <Input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="resize-none"
                placeholder="Notas opcionais..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setCreate({ open: false, initialDate: null })}>
                Cancelar
              </Button>
              <Button onClick={submitCreate}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reagendar */}
      <Dialog open={!!rescheduleFor} onOpenChange={(o) => !o && setRescheduleFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reagendar</DialogTitle>
            <DialogDescription className="sr-only">
              Escolher nova data/hora para o follow-up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nova data/hora</Label>
              <Input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRescheduleFor(null)}>
                Cancelar
              </Button>
              <Button onClick={submitReschedule}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
