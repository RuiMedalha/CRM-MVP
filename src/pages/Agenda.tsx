import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Check, Phone, Mail, MessageCircle, Plus, Search, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getEmployeeByEmail } from "@/integrations/directus/employees";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateFollowUp, useFollowUps, usePatchFollowUp } from "@/hooks/useFollowUps";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/hooks/useRealtime";
import { useCrossTabBus } from "@/store/crossTabBus";
import { Link } from "react-router-dom";

function typeLabel(t: string) {
  if (t === "call") return "Chamada";
  if (t === "email") return "Email";
  if (t === "whatsapp") return "WhatsApp";
  return "Tarefa";
}

function typeIcon(t: string) {
  if (t === "call") return <Phone className="h-4 w-4" />;
  if (t === "email") return <Mail className="h-4 w-4" />;
  if (t === "whatsapp") return <MessageCircle className="h-4 w-4" />;
  return <CalendarClock className="h-4 w-4" />;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

export default function Agenda() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const newLeads = useCrossTabBus((s) => s.newLeads);

  // Realtime subscription for follow-ups and leads
  const { emit } = useRealtime(["leads", "follow_ups", "activity"], {
    queryKeys: [
      ["follow-ups"],
      ["dashboard-overdue-followups"],
      ["agenda"],
    ],
    onEvent: (payload) => {
      if (payload.collection === "follow_ups") {
        qc.invalidateQueries({ queryKey: ["follow-ups"] });
      }
    },
  });

  const employeeQuery = useQuery({
    queryKey: ["me", "employee", user?.email],
    queryFn: async () => (user?.email ? await getEmployeeByEmail(String(user.email)) : null),
    enabled: !!user?.email,
  });
  const meEmp = employeeQuery.data;

  const dueBefore = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 365);
    return d.toISOString();
  }, []);

  const list = useFollowUps({
    search,
    status: "open",
    assignedEmployeeId: meEmp?.id || undefined,
    dueBefore,
    limit: 500,
    page: 1,
  });

  const create = useCreateFollowUp();
  const patch = usePatchFollowUp();

  const [form, setForm] = useState({
    type: "call",
    title: "",
    due_at: "",
    notes: "",
  });

  const saveFollowUp = async () => {
    if (!meEmp?.id) {
      toast({ title: "Sem funcionário", description: "O teu utilizador tem de existir em `employees` (por email).", variant: "destructive" });
      return;
    }
    if (!form.due_at) {
      toast({ title: "Data/hora em falta", variant: "destructive" });
      return;
    }
    try {
      const created = await create.mutateAsync({
        status: "open",
        type: form.type,
        title: form.title || null,
        due_at: new Date(form.due_at).toISOString(),
        notes: form.notes || null,
        assigned_employee_id: meEmp.id,
        created_by_employee_id: meEmp.id,
      } as any);
      toast({ title: "Follow-up criado" });
      emit("create", created, "follow_ups", { userName: user?.email });
      setOpenCreate(false);
      setForm({ type: "call", title: "", due_at: "", notes: "" });
    } catch (e: any) {
      toast({ title: "Erro ao criar follow-up", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const items = list.data || [];
  const isLoading = list.isLoading || employeeQuery.isLoading;

  // Calendar data
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthYear = currentDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  // Map follow-ups by date
  const followUpsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    items.forEach((fu: any) => {
      if (fu.due_at) {
        const date = new Date(fu.due_at).toLocaleDateString("pt-PT");
        if (!map[date]) map[date] = [];
        map[date].push(fu);
      }
    });
    return map;
  }, [items]);

  const calendarDays = useMemo(() => {
    const days = [];
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  }, [daysInMonth, firstDay]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const selectDay = (day: number) => {
    setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    setForm({ ...form, due_at: new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().slice(0, 16) });
  };

  const dayOfWeekNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Agenda</h1>
            <p className="text-muted-foreground">
              Follow-ups atribuídos a {meEmp?.full_name || user?.email || "mim"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo follow-up
            </Button>
            <Badge variant="outline" className="text-base px-3 py-1">
              {items.length}
            </Badge>
          </div>
        </div>

        {/* Real-time incoming leads banner */}
        {newLeads.length > 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-3 dark:bg-emerald-950/30 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <Zap className="h-4 w-4 text-emerald-600 animate-pulse" />
              <span>
                <strong>{newLeads.length} novo(s) lead(s)</strong> recebido(s) em tempo real.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/leads"
                className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Ver Leads &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Calendar Panel */}
          <Card className="min-w-0 lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-sm font-semibold capitalize text-center flex-1">{monthYear}</h2>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendar wrapper: min-width 640px garante que cada célula (640/7=~91px)
                  tem tamanho usável; overflow-x-auto permite scroll horizontal se a
                  coluna do layout (lg:col-span-1 em lg:grid-cols-3) for mais estreita
                  que 640px. Sem isto, botões de dia ficam com 23x25px (blocker #4
                  do F-MOBILE-VALIDATION). */}
              <div className="min-w-[640px] overflow-x-auto">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {dayOfWeekNames.map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="aspect-square" />;
                  }

                  const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  const dateStr = dayDate.toLocaleDateString("pt-PT");
                  const dayFollowUps = followUpsByDate[dateStr] || [];
                  const isToday =
                    dayDate.toDateString() === new Date().toDateString();
                  const isSelected =
                    selectedDate?.toDateString() === dayDate.toDateString();
                  const hasOverdue = dayFollowUps.some(
                    (fu: any) => fu.due_at && new Date(fu.due_at).getTime() < Date.now()
                  );

                  return (
                    <button
                      key={day}
                      onClick={() => selectDay(day)}
                      /* Grelha densa: a área de toque de 44px do bloco coarse em
                         index.css sobrepor-se-ia ao dia vizinho (tracks de ~36px
                         a 360px) e faria abrir o dia errado. A célula já é
                         aspect-square e cresce com o ecrã. */
                      data-no-touch-pad
                      className={cn(
                        "aspect-square rounded-lg border text-xs font-medium transition-colors relative flex flex-col items-center justify-center p-1",
                        isToday && "border-primary bg-primary/10",
                        isSelected && "bg-primary text-primary-foreground",
                        !isToday && !isSelected && "border-border hover:bg-muted",
                        hasOverdue && !isSelected && "border-destructive/50"
                      )}
                    >
                      <span>{day}</span>
                      {dayFollowUps.length > 0 && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {dayFollowUps.length} item{dayFollowUps.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </button>
                  );
                })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* List + Details Panel */}
          <div className="min-w-0 lg:col-span-2 space-y-4">
            {/* Search */}
            <div className="w-full min-w-0 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar…"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Follow-ups List */}
            <div className="grid gap-3">
              {isLoading ? (
                [...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : items.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Sem follow-ups.
                  </CardContent>
                </Card>
              ) : (
                items.map((fu: any) => {
                  const due = fu.due_at ? new Date(fu.due_at) : null;
                  const overdue = due ? due.getTime() < Date.now() : false;
                  const contactName = fu.contact_id?.company_name || fu.contact_id?.id || null;
                  const qNo = fu.quotation_id?.quotation_number || fu.quotation_id?.id || null;
                  return (
                    <Card key={String(fu.id)} className={overdue ? "w-full min-w-0 border-destructive/40" : "w-full min-w-0 border"}>
                      <CardContent className="p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {typeIcon(String(fu.type || "task"))}
                            <div className="font-medium truncate">
                              {fu.title || typeLabel(String(fu.type || "task"))}
                            </div>
                            {overdue ? <Badge variant="destructive">Atrasado</Badge> : <Badge variant="secondary">Aberto</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                            <span>{due ? due.toLocaleString("pt-PT") : "—"}</span>
                            {contactName ? <span className="truncate">Cliente: {String(contactName)}</span> : null}
                            {qNo ? <span className="truncate">Orçamento: {String(qNo)}</span> : null}
                          </div>
                          {fu.notes ? (
                            <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                              {String(fu.notes).slice(0, 180)}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await patch.mutateAsync({
                                id: String(fu.id),
                                patch: { status: "done", completed_at: new Date().toISOString() } as any,
                              });
                              toast({ title: "Concluído" });
                            } catch (e: any) {
                              toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" });
                            }
                          }}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Feito
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo follow-up</DialogTitle>
            <DialogDescription className="sr-only">
              Criar um novo follow-up atribuído a mim.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Chamada</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="task">Tarefa</SelectItem>
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
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Notas opcionais..."
                className="resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setOpenCreate(false)}>
                Cancelar
              </Button>
              <Button onClick={saveFollowUp}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
