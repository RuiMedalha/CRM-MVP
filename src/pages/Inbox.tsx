import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useEmailThreads } from "@/hooks/useEmailThreads";
import type { EmailThread } from "@/hooks/useEmailThreads";
import { useConversationStore } from "@/store/conversationStore";
import { useTelecofCallStore } from "@/store/telecofCallStore";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useNavigate } from "react-router-dom";
import { useAssignThread } from "@/hooks/useEmailThreads";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Inbox as InboxIcon,
  X,
  Mail,
  MessageCircle,
  Phone,
  Star,
  Archive,
  Clock,
  ChevronLeft,
} from "lucide-react";
import { InboxOmnichannel, type InboxChannel, type InboxStatus } from "@/components/InboxOmnichannel";
import type { Conversation } from "@/types/conversation";
import type { TelecofCallEventRecord } from "@/types/telecof";

// ─── Adapter: existing unified items → InboxOmnichannel items ─────────────

type LegacyChannel = "email" | "whatsapp" | "call";
type LegacyStatus = "open" | "assigned" | "closed";

interface UnifiedInboxItem {
  id: string;
  channel: LegacyChannel;
  title: string;
  subtitle: string;
  contact: string;
  date: string;
  urgency: "low" | "normal" | "high" | "critical";
  status: LegacyStatus;
  assignedTo: string | number | null;
  slaAt: string | null;
  raw: EmailThread | Conversation | TelecofCallEventRecord;
}

function emailToUnified(t: EmailThread): UnifiedInboxItem {
  let status: LegacyStatus = "open";
  if (t.status === "assigned" || t.status === "replied") status = "assigned";
  if (t.status === "closed") status = "closed";
  return {
    id: `email-${t.id}`,
    channel: "email",
    title: t.subject || "(sem assunto)",
    subtitle: t.ai_summary || "",
    contact: t.from_address || "",
    date: t.date_created,
    urgency: (t.urgency as UnifiedInboxItem["urgency"]) || "normal",
    status,
    assignedTo: t.assigned_to,
    slaAt: t.sla_due_at,
    raw: t,
  };
}

function conversationToUnified(c: Conversation): UnifiedInboxItem {
  let status: LegacyStatus = "open";
  if (c.assignedTo) status = "assigned";
  if (c.status === "resolved" || c.status === "closed") status = "closed";
  return {
    id: `wa-${c.id}`,
    channel: "whatsapp",
    title: c.customerName || c.id,
    subtitle: c.lastMessage || "",
    contact: c.customerName || "",
    date: c.updatedAt,
    urgency: c.priority === "urgent" ? "high" : "normal",
    status,
    assignedTo: c.assignedTo || null,
    slaAt: null,
    raw: c,
  };
}

function callToUnified(e: TelecofCallEventRecord): UnifiedInboxItem {
  let status: LegacyStatus = "open";
  if (e.assignedTo || e.claimedAt) status = "assigned";
  if (e.resolvedAt || e.operationalStatus === "resolved") status = "closed";
  return {
    id: `call-${e.id}`,
    channel: "call",
    title: e.customerName || e.phone,
    subtitle: e.shortMessage || (e.direction === "missed" ? "Chamada perdida" : `Chamada ${e.direction || ""}`),
    contact: e.phone,
    date: e.createdAt,
    urgency: e.operationalStatus === "new" ? "high" : "normal",
    status,
    assignedTo: e.assignedTo || null,
    slaAt: null,
    raw: e,
  };
}

const URGENCY_WEIGHT: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

function sortByUrgencyAndDate(a: UnifiedInboxItem, b: UnifiedInboxItem): number {
  const aOverdue = a.slaAt && new Date(a.slaAt).getTime() < Date.now() ? -1 : 0;
  const bOverdue = b.slaAt && new Date(b.slaAt).getTime() < Date.now() ? -1 : 0;
  if (aOverdue !== bOverdue) return aOverdue - bOverdue;
  const uA = URGENCY_WEIGHT[a.urgency] ?? 2;
  const uB = URGENCY_WEIGHT[b.urgency] ?? 2;
  if (uA !== uB) return uA - uB;
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function Inbox() {
  const navigate = useNavigate();
  const { employee } = useCurrentEmployee();
  const assignThread = useAssignThread();

  // Page-level filter state (drives InboxOmnichannel initial values)
  const [channelFilter, setChannelFilter] = useState<InboxChannel>("all");
  const [statusFilter, setStatusFilter] = useState<InboxStatus>("all");

  // Selection state — desktop master-detail, mobile bottom sheet
  const [selectedItem, setSelectedItem] = useState<UnifiedInboxItem | null>(null);

  const { data: emailThreads, isLoading: emailLoading } = useEmailThreads({
    status: "",
    mailbox: "",
    category: "",
    onlyUnassigned: false,
  });
  const conversations = useConversationStore((s) => s.conversations);
  const callEvents = useTelecofCallStore((s) => s.events);

  const items = useMemo(() => {
    const emails = (emailThreads ?? []).map(emailToUnified);
    const wa = conversations
      .filter((c) => c.status !== "resolved")
      .map(conversationToUnified);
    const calls = callEvents
      .filter((e) => e.operationalStatus !== "resolved")
      .map(callToUnified);

    let merged = [...emails, ...wa, ...calls];

    if (channelFilter !== "all") {
      const mapped: LegacyChannel | null =
        channelFilter === "whatsapp" ? "whatsapp" :
        channelFilter === "email" ? "email" :
        channelFilter === "instagram" ? "whatsapp" :
        null;
      if (mapped) merged = merged.filter((i) => i.channel === mapped);
    }
    if (statusFilter === "unread") {
      merged = merged.filter((i) => i.status !== "closed" && !i.assignedTo);
    }
    if (statusFilter === "archived") {
      merged = merged.filter((i) => i.status === "closed");
    }

    return merged.sort(sortByUrgencyAndDate);
  }, [emailThreads, conversations, callEvents, channelFilter, statusFilter]);

  const totalPending = items.filter((i) => i.status !== "closed").length;

  const handleItemOpen = (item: UnifiedInboxItem) => {
    setSelectedItem(item);
  };

  const handleAssignToMe = async () => {
    if (!employee || !selectedItem || selectedItem.channel !== "email") return;
    const thread = selectedItem.raw as EmailThread;
    try {
      await assignThread.mutateAsync({ threadId: thread.id, employeeId: employee.id });
      toast({ title: "Assumido", description: "Item atribuído com sucesso" });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const goToSource = (item: UnifiedInboxItem) => {
    switch (item.channel) {
      case "email":
        navigate(`/email?thread=${(item.raw as EmailThread).id}`);
        break;
      case "whatsapp":
        navigate(`/comunicacoes?conversation=${(item.raw as Conversation).id}`);
        break;
      case "call":
        navigate(`/comunicacoes?tab=telecof&call=${(item.raw as TelecofCallEventRecord).id}`);
        break;
    }
  };

  return (
    <AppLayout fullHeight>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">Inbox</h1>
              <Badge variant="secondary" className="text-xs">
                {totalPending} pendentes
              </Badge>
            </div>
          </div>
        </div>

        {/* Master-detail: list (left) + detail (right on desktop) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* List */}
          <div className="min-h-0 overflow-hidden border-r border-border">
            <InboxOmnichannel
              initialChannel={channelFilter}
              initialStatus={statusFilter}
              className="min-h-0 flex-1"
            />
            {/* Page-level filter toolbar (kept in sync with the inner state) */}
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-border bg-muted/20 px-3 py-2 text-[11px]">
              <span className="text-muted-foreground">Página:</span>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as InboxChannel)}
                className="rounded border border-border bg-card px-2 py-1 text-xs"
                aria-label="Filtro de canal"
              >
                <option value="all">Todos os canais</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="instagram">Instagram</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InboxStatus)}
                className="rounded border border-border bg-card px-2 py-1 text-xs"
                aria-label="Filtro de estado"
              >
                <option value="all">Todos os estados</option>
                <option value="unread">Não lidas</option>
                <option value="starred">Com estrela</option>
                <option value="archived">Arquivadas</option>
              </select>
            </div>
          </div>

          {/* Desktop detail pane */}
          <div className="hidden min-h-0 overflow-auto lg:block">
            <DetailPane
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onAssignToMe={handleAssignToMe}
              onGoToSource={goToSource}
              hasEmployee={!!employee}
              assigning={assignThread.isPending}
            />
          </div>
        </div>

        {/* Mobile bottom sheet */}
        <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl px-0 pb-[env(safe-area-inset-bottom)]">
            <SheetHeader className="px-4 pb-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedItem(null)}
                  aria-label="Voltar à lista"
                  className="h-10 w-10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <SheetTitle className="text-base">Detalhes</SheetTitle>
                <div className="w-10" />
              </div>
              <SheetDescription className="sr-only">
                Detalhes da mensagem seleccionada.
              </SheetDescription>
            </SheetHeader>
            <div className="max-h-[calc(85vh-3.5rem)] overflow-auto">
              <DetailPane
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onAssignToMe={handleAssignToMe}
                onGoToSource={goToSource}
                hasEmployee={!!employee}
                assigning={assignThread.isPending}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}

// ─── Detail pane (shared by desktop + sheet) ──────────────────────────────

function DetailPane(props: {
  item: UnifiedInboxItem | null;
  onClose: () => void;
  onAssignToMe: () => void;
  onGoToSource: (item: UnifiedInboxItem) => void;
  hasEmployee: boolean;
  assigning: boolean;
}) {
  const { item, onClose, onAssignToMe, onGoToSource, hasEmployee, assigning } = props;

  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground">
        <InboxIcon className="mb-3 h-12 w-12 opacity-30" />
        <p className="text-sm">Selecione uma mensagem para ver detalhes.</p>
      </div>
    );
  }

  const channelIcon = (ch: LegacyChannel) => {
    switch (ch) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "whatsapp":
        return <MessageCircle className="h-4 w-4" />;
      case "call":
        return <Phone className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Detail header */}
      <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {channelIcon(item.channel)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{item.title}</h2>
          <p className="truncate text-xs text-muted-foreground">{item.contact}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(item.date).toLocaleString("pt-PT", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {item.slaAt && new Date(item.slaAt).getTime() < Date.now() && (
              <Badge variant="destructive" className="text-[10px]">SLA</Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:flex"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        {!item.subtitle ? (
          <p className="text-sm text-muted-foreground">(sem conteúdo)</p>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.subtitle}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card/60 px-4 py-3 sm:px-6">
        {item.channel === "email" && !item.assignedTo && hasEmployee && (
          <Button
            variant="outline"
            size="sm"
            className="h-10 min-h-[44px] gap-1"
            onClick={onAssignToMe}
            disabled={assigning}
          >
            {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Atribuir a mim
          </Button>
        )}
        <Button
          size="sm"
          className="h-10 min-h-[44px]"
          onClick={() => onGoToSource(item)}
        >
          Abrir conversa
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Marcar com estrela">
            <Star className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Arquivar">
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}