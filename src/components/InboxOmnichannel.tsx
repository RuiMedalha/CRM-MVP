import { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  MessageCircle,
  Mail,
  Instagram,
  Search,
  Star,
  Archive,
  ArchiveRestore,
  Send,
  Loader2,
  Inbox as InboxIcon,
  Reply,
  PhoneCall,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useConversationStore } from "@/store/conversationStore";
import { useEmailThreads } from "@/hooks/useEmailThreads";
import type { EmailThread } from "@/hooks/useEmailThreads";
import type { Conversation } from "@/types/conversation";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { toast } from "@/hooks/use-toast";

export type InboxChannel = "all" | "whatsapp" | "email" | "instagram";
export type InboxStatus = "all" | "unread" | "starred" | "archived";

export interface InboxItem {
  id: string;
  channel: Exclude<InboxChannel, "all">;
  contactName: string;
  preview: string;
  date: string;
  unread: boolean;
  starred: boolean;
  archived: boolean;
  urgency: "low" | "normal" | "high" | "critical";
  raw: Conversation | EmailThread;
}

function conversationToInboxItem(c: Conversation): InboxItem {
  const ch: InboxItem["channel"] = c.channel === "instagram" ? "instagram" : "whatsapp";
  return {
    id: c.id,
    channel: ch,
    contactName: c.customerName || c.id,
    preview: c.lastMessage || "",
    date: c.updatedAt,
    unread: (c.unreadCount ?? 0) > 0,
    starred: false,
    archived: c.status === "archived" || c.status === "closed",
    urgency: c.priority === "urgent" ? "high" : "normal",
    raw: c,
  };
}

function emailToInboxItem(t: EmailThread): InboxItem {
  return {
    id: t.id,
    channel: "email",
    contactName: t.from_address || t.subject || "(remetente desconhecido)",
    preview: t.ai_summary || t.subject || "",
    date: t.date_created,
    unread: !t.assigned_to,
    starred: false,
    archived: t.status === "closed",
    urgency: (t.urgency as InboxItem["urgency"]) || "normal",
    raw: t,
  };
}

const channelIcon = (ch: InboxItem["channel"]) => {
  switch (ch) {
    case "whatsapp":
      return <MessageCircle className="h-4 w-4" />;
    case "email":
      return <Mail className="h-4 w-4" />;
    case "instagram":
      return <Instagram className="h-4 w-4" />;
  }
};

const channelColor = (ch: InboxItem["channel"]) => {
  switch (ch) {
    case "whatsapp":
      return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40";
    case "email":
      return "text-blue-600 bg-blue-50 dark:bg-blue-950/40";
    case "instagram":
      return "text-pink-600 bg-pink-50 dark:bg-pink-950/40";
  }
};

const urgencyDot = (u: InboxItem["urgency"]) => {
  switch (u) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-amber-500";
    case "normal":
      return "bg-blue-400";
    case "low":
      return "bg-gray-300";
  }
};

const formatDate = (d: string) => {
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
};

// ─── Swipeable row ────────────────────────────────────────────────────────

interface SwipeableRowProps {
  item: InboxItem;
  onOpen: (item: InboxItem) => void;
  onQuickReply: (item: InboxItem, text: string) => void;
  onToggleStar: (id: string) => void;
  onToggleArchive: (id: string) => void;
}

function SwipeableRow({ item, onOpen, onQuickReply, onToggleStar, onToggleArchive }: SwipeableRowProps) {
  const x = useMotionValue(0);
  const leftOpacity = useTransform(x, [-80, -40, 0], [1, 0.5, 0]);
  const rightOpacity = useTransform(x, [0, 40, 80], [0, 0.5, 1]);
  const [reply, setReply] = useState("");
  const [showReply, setShowReply] = useState(false);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    if (offset < -100) {
      onToggleArchive(item.id);
      x.set(0);
    } else if (offset > 100) {
      onToggleStar(item.id);
      x.set(0);
    } else {
      x.set(0);
    }
  };

  const submitReply = () => {
    const trimmed = reply.trim();
    if (!trimmed) return;
    onQuickReply(item, trimmed);
    setReply("");
    setShowReply(false);
  };

  return (
    <div className="relative overflow-hidden border-b border-border bg-card">
      <motion.div
        style={{ opacity: leftOpacity }}
        className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-amber-500 text-white"
      >
        <Star className="h-5 w-5" />
      </motion.div>
      <motion.div
        style={{ opacity: rightOpacity }}
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-slate-500 text-white"
      >
        <Archive className="h-5 w-5" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        style={{ x, touchAction: "pan-y" }}
        className="relative bg-card"
      >
        <button
          type="button"
          onClick={() => onOpen(item)}
          className={cn(
            "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:px-4",
            "min-h-[44px]",
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              channelColor(item.channel),
            )}
          >
            {channelIcon(item.channel)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", urgencyDot(item.urgency))} />
              <p
                className={cn(
                  "truncate text-sm flex-1",
                  item.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
                )}
              >
                {item.contactName}
              </p>
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(item.date)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p
                className={cn(
                  "truncate text-xs flex-1",
                  item.unread ? "text-foreground/80" : "text-muted-foreground",
                )}
              >
                {item.preview || "(sem preview)"}
              </p>
              {item.starred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />}
              {item.archived && <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              {item.unread && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="não lida" />
              )}
            </div>
          </div>
        </button>

        <AnimatePresence>
          {showReply && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-t border-border bg-muted/30 px-3 py-2 sm:px-4"
            >
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitReply();
                    }
                    if (e.key === "Escape") setShowReply(false);
                  }}
                  placeholder="Resposta rápida…"
                  className="h-10 flex-1 text-sm"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  onClick={submitReply}
                  aria-label="Enviar resposta"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showReply && (
          <div className="flex items-center gap-1 px-3 pb-2 sm:px-4">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs"
              onClick={() => setShowReply(true)}
            >
              <Reply className="h-3.5 w-3.5" />
              Responder
            </Button>
            {item.channel === "whatsapp" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => toast({ title: "A iniciar chamada…", description: item.contactName })}
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Ligar
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggleStar(item.id)}
                aria-label="Marcar com estrela"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    item.starred && "fill-amber-400 text-amber-500",
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => onToggleArchive(item.id)}
                aria-label={item.archived ? "Desarquivar" : "Arquivar"}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                {item.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export interface InboxOmnichannelProps {
  compact?: boolean;
  maxItems?: number;
  onItemOpen?: (item: InboxItem) => void;
  initialChannel?: InboxChannel;
  initialStatus?: InboxStatus;
  className?: string;
}

export function InboxOmnichannel({
  compact = false,
  maxItems,
  onItemOpen,
  initialChannel = "all",
  initialStatus = "all",
  className,
}: InboxOmnichannelProps) {
  const [channel, setChannel] = useState<InboxChannel>(initialChannel);
  const [status, setStatus] = useState<InboxStatus>(initialStatus);
  const [query, setQuery] = useState("");
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const conversations = useConversationStore((s) => s.conversations);
  const { data: emailThreads, isLoading: emailLoading } = useEmailThreads({
    status: "",
    mailbox: "",
    category: "",
    onlyUnassigned: false,
  });
  const recordActivity = useConversationStore((s) => s.recordConversationMessageActivity);
  const { employee } = useCurrentEmployee();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo<InboxItem[]>(() => {
    const wa = conversations.map(conversationToInboxItem);
    const em = (emailThreads ?? []).map(emailToInboxItem);
    const all = [...wa, ...em];

    return all
      .map((it) => ({
        ...it,
        starred: starredIds.has(it.id) || it.starred,
        archived: archivedIds.has(it.id) || it.archived,
      }))
      .filter((it) => (channel === "all" ? true : it.channel === channel))
      .filter((it) => {
        if (status === "all") return !it.archived || channel === "all";
        if (status === "unread") return it.unread;
        if (status === "starred") return it.starred;
        if (status === "archived") return it.archived;
        return true;
      })
      .filter((it) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          it.contactName.toLowerCase().includes(q) ||
          it.preview.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [conversations, emailThreads, channel, status, starredIds, archivedIds, query]);

  const visibleItems = maxItems ? items.slice(0, maxItems) : items;

  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleArchive = (id: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toast({
      title: archivedIds.has(id) ? "Reaberto" : "Arquivado",
      description: "Item movido com sucesso",
    });
  };

  const handleQuickReply = (item: InboxItem, text: string) => {
    if (item.channel === "whatsapp") {
      const conv = item.raw as Conversation;
      recordActivity(conv.id, text, { incrementUnread: false });
      toast({ title: "Enviado", description: `Resposta enviada a ${item.contactName}` });
    } else {
      toast({
        title: "Rascunho criado",
        description: `Email de resposta para ${item.contactName}`,
      });
    }
  };

  const handleOpen = (item: InboxItem) => {
    if (onItemOpen) {
      onItemOpen(item);
      return;
    }
    if (item.channel === "email") {
      window.location.href = `/email?thread=${(item.raw as EmailThread).id}`;
    } else {
      window.location.href = `/comunicacoes?conversation=${(item.raw as Conversation).id}`;
    }
  };

  const channels: { id: InboxChannel; label: string; icon?: typeof MessageCircle }[] = [
    { id: "all", label: "Todos", icon: InboxIcon },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "email", label: "Email", icon: Mail },
    { id: "instagram", label: "IG", icon: Instagram },
  ];

  const statuses: { id: InboxStatus; label: string; icon?: typeof Star }[] = [
    { id: "all", label: "Todas" },
    { id: "unread", label: "Não lidas", icon: AlertCircle },
    { id: "starred", label: "Com estrela", icon: Star },
    { id: "archived", label: "Arquivadas", icon: Archive },
  ];

  return (
    <div ref={containerRef} className={cn("flex flex-col", className)}>
      {!compact && (
        <div className="space-y-2 px-3 pb-2 pt-3 sm:px-4">
          <div className="flex flex-wrap gap-1.5">
            {channels.map((c) => {
              const Icon = c.icon;
              const active = channel === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  className={cn(
                    "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground/70 hover:bg-muted",
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => {
              const Icon = s.icon;
              const active = status === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id)}
                  className={cn(
                    "flex min-h-[32px] items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-foreground/30 bg-foreground/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar conversas…"
              className="h-10 pl-9 text-sm"
              inputMode="search"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {emailLoading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <InboxIcon className="mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">Sem mensagens neste filtro.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visibleItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <SwipeableRow
                  item={item}
                  onOpen={handleOpen}
                  onQuickReply={handleQuickReply}
                  onToggleStar={toggleStar}
                  onToggleArchive={toggleArchive}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {!compact && (
        <div className="flex items-center justify-between border-t border-border bg-card/60 px-3 py-2 text-[11px] text-muted-foreground sm:px-4">
          <span>
            {visibleItems.length} de {items.length} mensagem{items.length === 1 ? "" : "ns"}
          </span>
          {employee && (
            <Badge variant="outline" className="text-[10px]">
              {employee.first_name ?? "Utilizador"}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default InboxOmnichannel;