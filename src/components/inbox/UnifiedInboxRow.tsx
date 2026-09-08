import { Mail, MessageCircle, Phone, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxChannelKey, UnifiedInboxItem } from "./types";
import { isOverdue } from "./inboxFilters";

const CHANNEL_META: Record<
  InboxChannelKey,
  { icon: typeof Mail; tint: string; bg: string; label: string }
> = {
  whatsapp: {
    icon: MessageCircle,
    tint: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "WhatsApp",
  },
  email: {
    icon: Mail,
    tint: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    label: "Email",
  },
  call: {
    icon: Phone,
    tint: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    label: "Chamada",
  },
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMin = Math.round((Date.now() - t) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
  });
}

export interface UnifiedInboxRowProps {
  item: UnifiedInboxItem;
  active: boolean;
  onSelect: () => void;
}

export function UnifiedInboxRow({ item, active, onSelect }: UnifiedInboxRowProps) {
  const channel = CHANNEL_META[item.channel];
  const ChannelIcon = channel.icon;
  const overdue = isOverdue(item.slaAt);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
        active
          ? "bg-primary/8 border-l-2 border-l-primary"
          : "hover:bg-muted/60 border-l-2 border-l-transparent",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          channel.bg,
          channel.tint,
        )}
      >
        <ChannelIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {item.title || channel.label}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatRelative(item.date)}
          </span>
        </div>
        {item.subtitle ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.subtitle}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 font-semibold",
              channel.bg,
              channel.tint,
            )}
          >
            {channel.label}
          </span>
          {item.unread ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-bold text-primary">
              Não lido
            </span>
          ) : null}
          {overdue ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 font-semibold text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" /> SLA
            </span>
          ) : null}
          {item.urgency === "critical" || item.urgency === "high" ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-semibold",
                item.urgency === "critical"
                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                  : "bg-orange-500/15 text-orange-600 dark:text-orange-400",
              )}
            >
              {item.urgency === "critical" ? "Crítico" : "Alto"}
            </span>
          ) : null}
          {item.slaAt && !overdue ? (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {new Date(item.slaAt).toLocaleString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
