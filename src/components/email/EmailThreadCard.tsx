import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserPlus, ShieldAlert } from "lucide-react";
import type { EmailThread } from "@/hooks/useEmailThreads";
import { findPotentialDuplicateThread } from "@/lib/emailDuplicateDetection";

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  pedido_orcamento:         { label: "Orçamento",     color: "bg-blue-100 text-blue-800" },
  followup_cliente:         { label: "Follow-up",     color: "bg-purple-100 text-purple-800" },
  reclamacao:               { label: "Reclamação",    color: "bg-red-100 text-red-800" },
  compra_cliente:           { label: "Compra",        color: "bg-green-100 text-green-800" },
  fornecedor_sourcing:      { label: "Sourcing",      color: "bg-orange-100 text-orange-800" },
  tabela_precos_fornecedor: { label: "Tabela preços", color: "bg-yellow-100 text-yellow-800" },
  compra_fornecedor:        { label: "Compra forn.",  color: "bg-teal-100 text-teal-800" },
  fatura_administrativo:    { label: "Fatura/Admin",  color: "bg-gray-100 text-gray-700" },
  spam:                     { label: "Spam",          color: "bg-gray-100 text-gray-400" },
  outro:                    { label: "Outro",         color: "bg-gray-100 text-gray-600" },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low:      { label: "Baixa",   color: "bg-gray-100 text-gray-500",   dot: "⚪" },
  normal:   { label: "Normal",  color: "bg-blue-50 text-blue-600",    dot: "🔵" },
  high:     { label: "Alta",    color: "bg-amber-100 text-amber-700", dot: "🟡" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-700",     dot: "🔴" },
};

const STATUS_LABELS: Record<string, string> = {
  queued:   "Na fila",
  assigned: "Assumido",
  replied:  "Respondido",
  closed:   "Fechado",
  snoozed:  "Adiado",
};

const MAILBOX_CONFIG: Record<string, { label: string; color: string }> = {
  "apoio.cliente@hotelequip.pt": { label: "Apoio", color: "bg-blue-100 text-blue-700" },
  "geral@hotelequip.pt":         { label: "Geral", color: "bg-green-100 text-green-700" },
};

function getMailboxBadge(mailbox: string | null | undefined): { label: string; color: string } {
  if (!mailbox) return { label: "?", color: "bg-gray-100 text-gray-600" };
  if (MAILBOX_CONFIG[mailbox]) return MAILBOX_CONFIG[mailbox];
  const short = mailbox.split("@")[0] || mailbox;
  return { label: short.length > 10 ? short.slice(0, 10) + "…" : short, color: "bg-gray-100 text-gray-600" };
}

function formatReceivedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `hoje às ${time}`;
  if (isYesterday) return `ontem às ${time}`;
  return `${date.toLocaleDateString("pt-PT", { day: "numeric", month: "short" })} às ${time}`;
}

function isSlaExceeded(thread: EmailThread): boolean {
  if (!thread.sla_due_at) return false;
  if (thread.status === "replied" || thread.status === "closed") return false;
  return new Date(thread.sla_due_at).getTime() < Date.now();
}

function getSlaCountdown(thread: EmailThread): { text: string; color: string } | null {
  if (!thread.sla_due_at) return null;
  if (thread.status === "replied" || thread.status === "closed") return null;
  const diff = new Date(thread.sla_due_at).getTime() - Date.now();
  if (diff <= 0) {
    const overMs = Math.abs(diff);
    const overH = Math.floor(overMs / 3600000);
    const overM = Math.floor((overMs % 3600000) / 60000);
    return { text: `🔴 Vencido há ${overH}h${overM > 0 ? ` ${overM}m` : ""}`, color: "text-red-600 font-semibold animate-pulse" };
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (diff < 3600000) return { text: `⏱ ${m}m`, color: "text-red-600 font-semibold animate-pulse" };
  if (diff < 14400000) return { text: `⏱ ${h}h ${m}m`, color: "text-amber-600 font-medium" };
  return { text: `⏱ ${h}h ${m}m`, color: "text-green-600" };
}

function getBorderClass(thread: EmailThread): string {
  if (isSlaExceeded(thread)) return "border-l-4 border-l-red-500 bg-red-50/40";
  if (thread.status === "queued" && !thread.assigned_to) return "border-l-4 border-l-amber-400";
  if (thread.status === "assigned") return "border-l-4 border-l-blue-500";
  if (thread.status === "replied") return "border-l-4 border-l-green-500";
  return "border-l-4 border-l-transparent";
}

interface Props {
  thread: EmailThread;
  onClick: () => void;
  onAssign: () => void;
  showAssign: boolean;
  allThreads?: EmailThread[];
  onOpenThread?: (id: string) => void;
  isSelected?: boolean;
  onMarkNoise?: () => void;
}

export function EmailThreadCard({ thread, onClick, onAssign, showAssign, allThreads, onOpenThread, isSelected, onMarkNoise }: Props) {
  const urgency = URGENCY_CONFIG[thread.urgency] ?? URGENCY_CONFIG.normal;
  const category = CATEGORY_CONFIG[thread.category];
  const slaExceeded = isSlaExceeded(thread);
  const slaCountdown = getSlaCountdown(thread);
  const mailboxBadge = getMailboxBadge(thread.mailbox);

  const dateLabel = thread.date_created ? formatReceivedDate(thread.date_created) : "";

  // Duplicate detection
  const duplicate = allThreads ? findPotentialDuplicateThread(thread, allThreads) : null;
  const dupeMailbox = duplicate ? getMailboxBadge(duplicate.mailbox) : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/40 relative",
        getBorderClass(thread),
        isSelected && "bg-accent/60 ring-1 ring-primary/40",
        thread.status === "closed" && "opacity-70 bg-muted/20"
      )}
    >
      {/* Top line: unread dot + mailbox + category + urgency */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {!thread.read_at && (
          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" title="Não lida" />
        )}
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide", mailboxBadge.color)}>
          {mailboxBadge.label}
        </span>
        {category && (
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", category.color)}>
            {category.label}
          </span>
        )}
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1", urgency.color)}>
          <span>{urgency.dot}</span>
          <span>{urgency.label}</span>
        </span>
        {slaCountdown && (
          <span className={cn("text-xs whitespace-nowrap ml-auto", slaCountdown.color)}>
            {slaCountdown.text}
          </span>
        )}
      </div>

      {/* Potential duplicate badge */}
      {duplicate && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenThread?.(duplicate.id);
          }}
          className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5 hover:underline cursor-pointer"
        >
          <span>⚠️ Possível duplicado de</span>
          <span className={cn("rounded px-1 py-0.2 text-[10px] font-semibold", dupeMailbox?.color)}>
            {dupeMailbox?.label}
          </span>
          <span className="truncate max-w-[160px] font-medium">#{duplicate.id.slice(0, 8)}</span>
        </div>
      )}

      {/* From + Subject */}
      <div className="flex items-baseline gap-1 mt-1 text-xs">
        <span className="font-medium truncate">{thread.from_address}</span>
        <span className="text-muted-foreground mx-0.5">→</span>
        <span className="truncate flex-1 text-foreground">{thread.subject || "(sem assunto)"}</span>
      </div>

      {/* AI summary + time + status */}
      <div className="flex items-center gap-2 mt-1">
        {thread.ai_summary && (
          <span className="text-xs text-muted-foreground truncate flex-1">
            💬 "{thread.ai_summary}"
          </span>
        )}
        {!thread.ai_summary && <span className="flex-1" />}
        <span className="text-xs text-muted-foreground whitespace-nowrap">{dateLabel}</span>
        <span className={cn(
          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
          thread.status === "queued" ? "bg-amber-100 text-amber-700" :
          thread.status === "assigned" ? "bg-blue-100 text-blue-700" :
          thread.status === "replied" ? "bg-green-100 text-green-700" :
          thread.status === "closed" ? "bg-gray-100 text-gray-600" :
          "bg-gray-100 text-gray-600"
        )}>
          {(thread.status === "replied" || thread.first_replied_at) && <span>✓</span>}
          {STATUS_LABELS[thread.status] ?? thread.status}
        </span>
      </div>

      {/* Quick Action buttons */}
      <div className="flex justify-end gap-1.5 mt-2">
        {onMarkNoise && thread.status !== "closed" && (
          <Button
            size="sm"
            variant="ghost"
            title="Marcar como Ruído/Spam e arquivar"
            className="h-6 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 px-1.5"
            onClick={(e) => { e.stopPropagation(); onMarkNoise(); }}
          >
            <ShieldAlert className="h-3 w-3" />
            Ruído
          </Button>
        )}
        {showAssign && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs gap-1 px-2"
            onClick={(e) => { e.stopPropagation(); onAssign(); }}
          >
            <UserPlus className="h-3 w-3" />
            Assumir
          </Button>
        )}
      </div>
    </div>
  );
}
