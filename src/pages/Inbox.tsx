import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useEmailThreads } from "@/hooks/useEmailThreads";
import type { EmailThread } from "@/hooks/useEmailThreads";
import { useConversationStore } from "@/store/conversationStore";
import { useTelecofCallStore } from "@/store/telecofCallStore";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useNavigate } from "react-router-dom";
import { useAssignThread } from "@/hooks/useEmailThreads";
import { cn } from "@/lib/utils";
import { Mail, MessageCircle, Phone, Inbox as InboxIcon, Filter, Clock, User, Loader2, UserPlus, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { Conversation } from "@/types/conversation";
import type { TelecofCallEventRecord } from "@/types/telecof";

// ─── Unified item type ───────────────────────────────────────────────────

type InboxChannel = "email" | "whatsapp" | "call";
type InboxStatus = "open" | "assigned" | "closed";

interface UnifiedInboxItem {
  id: string;
  channel: InboxChannel;
  title: string;
  subtitle: string;
  contact: string;
  date: string;
  urgency: "low" | "normal" | "high" | "critical";
  status: InboxStatus;
  assignedTo: string | number | null;
  slaAt: string | null;
  raw: EmailThread | Conversation | TelecofCallEventRecord;
}

// ─── Adapters ────────────────────────────────────────────────────────────

function emailToUnified(t: EmailThread): UnifiedInboxItem {
  let status: InboxStatus = "open";
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
  let status: InboxStatus = "open";
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
  let status: InboxStatus = "open";
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

// ─── Sort by urgency + date ──────────────────────────────────────────────

const URGENCY_WEIGHT: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

function sortByUrgencyAndDate(a: UnifiedInboxItem, b: UnifiedInboxItem): number {
  // SLA overdue first
  const aOverdue = a.slaAt && new Date(a.slaAt).getTime() < Date.now() ? -1 : 0;
  const bOverdue = b.slaAt && new Date(b.slaAt).getTime() < Date.now() ? -1 : 0;
  if (aOverdue !== bOverdue) return aOverdue - bOverdue;

  // Then urgency
  const uA = URGENCY_WEIGHT[a.urgency] ?? 2;
  const uB = URGENCY_WEIGHT[b.urgency] ?? 2;
  if (uA !== uB) return uA - uB;

  // Then most recent first
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

// ─── Filter types ────────────────────────────────────────────────────────

type ChannelFilter = "all" | InboxChannel;
type AssignFilter = "all" | "mine" | "unassigned";
type StatusFilter = "open" | "all" | "closed";

// ─── Component ───────────────────────────────────────────────────────────

export default function Inbox() {
  const navigate = useNavigate();
  const { employee } = useCurrentEmployee();
  const assignThread = useAssignThread();

  // Filters
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");

  // Data sources
  const { data: emailThreads, isLoading: emailLoading } = useEmailThreads({ status: "", mailbox: "", category: "", onlyUnassigned: false });
  const conversations = useConversationStore((s) => s.conversations);
  const callEvents = useTelecofCallStore((s) => s.events);

  // Merge all into unified list
  const items = useMemo(() => {
    const emails = (emailThreads ?? []).map(emailToUnified);
    const wa = conversations
      .filter((c) => c.status !== "resolved")
      .map(conversationToUnified);
    const calls = callEvents
      .filter((e) => e.operationalStatus !== "resolved")
      .map(callToUnified);

    let merged = [...emails, ...wa, ...calls];

    // Apply filters
    if (channelFilter !== "all") {
      merged = merged.filter((i) => i.channel === channelFilter);
    }
    if (assignFilter === "mine") {
      merged = merged.filter((i) => i.assignedTo && String(i.assignedTo) === String(employee?.id));
    } else if (assignFilter === "unassigned") {
      merged = merged.filter((i) => !i.assignedTo);
    }
    if (statusFilter === "open") {
      merged = merged.filter((i) => i.status !== "closed");
    } else if (statusFilter === "closed") {
      merged = merged.filter((i) => i.status === "closed");
    }

    return merged.sort(sortByUrgencyAndDate);
  }, [emailThreads, conversations, callEvents, channelFilter, assignFilter, statusFilter, employee?.id]);

  const handleItemClick = (item: UnifiedInboxItem) => {
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

  const handleAssignToMe = async (e: React.MouseEvent, item: UnifiedInboxItem) => {
    e.stopPropagation();
    if (!employee || item.channel !== "email") return;
    const thread = item.raw as EmailThread;
    try {
      await assignThread.mutateAsync({ threadId: thread.id, employeeId: employee.id });
      toast({ title: "Assumido", description: "Item atribuído com sucesso" });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const channelIcon = (ch: InboxChannel) => {
    switch (ch) {
      case "email": return <Mail className="h-4 w-4" />;
      case "whatsapp": return <MessageCircle className="h-4 w-4" />;
      case "call": return <Phone className="h-4 w-4" />;
    }
  };

  const channelColor = (ch: InboxChannel) => {
    switch (ch) {
      case "email": return "text-blue-600 bg-blue-50 dark:bg-blue-950/40";
      case "whatsapp": return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40";
      case "call": return "text-amber-600 bg-amber-50 dark:bg-amber-950/40";
    }
  };

  const urgencyDot = (u: UnifiedInboxItem["urgency"]) => {
    switch (u) {
      case "critical": return "bg-red-500";
      case "high": return "bg-amber-500";
      case "normal": return "bg-blue-400";
      case "low": return "bg-gray-300";
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Ontem";
    return date.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
  };

  const totalPending = items.filter((i) => i.status !== "closed").length;

  return (
    <AppLayout>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-3 py-4 sm:px-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">Inbox</h1>
              <Badge variant="secondary" className="text-xs">
                {totalPending} pendentes
              </Badge>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {/* Channel */}
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-0.5 sm:flex sm:flex-wrap sm:items-center">
              {(["all", "email", "whatsapp", "call"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    channelFilter === ch ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {ch === "all" ? <Filter className="h-3.5 w-3.5" /> : channelIcon(ch as InboxChannel)}
                  {ch === "all" ? "Todos" : ch === "email" ? "Email" : ch === "whatsapp" ? "WhatsApp" : "Chamadas"}
                </button>
              ))}
            </div>

            {/* Assignment */}
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-0.5 sm:flex sm:flex-wrap sm:items-center">
              {(["all", "mine", "unassigned"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAssignFilter(a)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    assignFilter === a ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  {a === "all" ? "Todos" : a === "mine" ? "Meus" : "Não atribuídos"}
                </button>
              ))}
            </div>

            {/* Status */}
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-0.5 sm:flex sm:flex-wrap sm:items-center">
              {(["open", "all", "closed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === s ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "open" ? "Abertos" : s === "all" ? "Todos" : "Fechados"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Item list */}
        <div className="min-w-0 flex-1 overflow-auto">
          {emailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <InboxIcon className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Inbox vazia — está tudo em dia!</p>
            </div>
          ) : (
            <div>
              {items.map((item) => (
                <div key={item.id} className="group border-b border-border hover:bg-muted/50 transition-colors">
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left"
                  >
                    {/* Channel icon */}
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", channelColor(item.channel))}>
                      {channelIcon(item.channel)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", urgencyDot(item.urgency))} />
                        <p className="text-sm font-medium truncate flex-1">{item.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(item.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate flex-1">
                          {item.contact}{item.subtitle ? ` — ${item.subtitle}` : ""}
                        </p>
                        {item.slaAt && new Date(item.slaAt).getTime() < Date.now() && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">SLA</Badge>
                        )}
                        {item.status === "assigned" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Atribuído</Badge>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Quick actions (hidden on hover) */}
                  <div className="hidden group-hover:flex items-center gap-1 px-5 py-2 bg-muted/30 border-t border-border">
                    {!item.assignedTo && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => handleAssignToMe(e, item)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Atribuir a mim
                      </Button>
                    )}
                    {item.channel === "email" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}>
                        <Reply className="h-3.5 w-3.5" />
                        Responder
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
