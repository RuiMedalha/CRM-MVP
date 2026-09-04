/**
 * CompactTimeline — lista compacta das últimas N interações (default 5).
 *
 * Reutilizável em:
 *   • TelecofCallWorkspace (variant=telecof)
 *   • ComunicacoesCliente360Panel (variant=hubchat)
 *   • Customer360Actions (variantes internas)
 *
 * Renderiza tipo + direção + data relativa + summary + agente.
 * Empty state quando não há interações.
 */

import { useMemo, useState } from "react";
import {
  Phone,
  Mail,
  MessageCircle,
  FileText,
  StickyNote,
  Target,
  Wrench,
  Sparkles,
  Activity,
} from "lucide-react";

import type { InteractionRow } from "@/integrations/directus/interactions";
import { cn } from "@/lib/utils";

interface CompactTimelineProps {
  interactions: InteractionRow[];
  maxItems?: number;
  /** "default" (timeline) ou "hubchat" (painel lateral mais compacto). */
  variant?: "default" | "hubchat";
  /** Título custom (default "Histórico"). */
  title?: string;
  emptyMessage?: string;
}

interface TypeConfig {
  icon: typeof Phone;
  color: string;
  bg: string;
  label: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  call: {
    icon: Phone,
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    label: "Chamada",
  },
  email: {
    icon: Mail,
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    label: "Email",
  },
  whatsapp: {
    icon: MessageCircle,
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    label: "WhatsApp",
  },
  note: {
    icon: StickyNote,
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    label: "Nota",
  },
  opportunity: {
    icon: Target,
    color: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    label: "Oportunidade",
  },
  conversion: {
    icon: Sparkles,
    color: "text-pink-700 dark:text-pink-300",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    label: "Conversão",
  },
  assistance: {
    icon: Wrench,
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-950/40",
    label: "Assistência",
  },
};

const DEFAULT_CONFIG: TypeConfig = {
  icon: Activity,
  color: "text-muted-foreground",
  bg: "bg-muted",
  label: "Interação",
};

function formatRelative(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function formatFull(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function agentNameOf(i: InteractionRow): string | null {
  const p = i.payload;
  if (!p) return null;
  if (typeof p === "string") {
    try {
      const parsed = JSON.parse(p) as Record<string, unknown>;
      return typeof parsed?.agent_name === "string" ? parsed.agent_name : null;
    } catch {
      return null;
    }
  }
  if (typeof p === "object") {
    const v = (p as Record<string, unknown>).agent_name;
    return typeof v === "string" ? v : null;
  }
  return null;
}

export function CompactTimeline({
  interactions,
  maxItems = 5,
  variant = "default",
  title = "Histórico",
  emptyMessage = "Sem interações registadas.",
}: CompactTimelineProps) {
  const [filter, setFilter] = useState<string>("");

  const filtered = useMemo(() => {
    let items = interactions.slice(0, maxItems);
    if (filter) {
      items = items.filter((i) => String(i.type || "").includes(filter));
    }
    return items;
  }, [interactions, maxItems, filter]);

  const filterPills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of interactions.slice(0, maxItems)) {
      const t = String(i.type || "");
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries()).slice(0, 4);
  }, [interactions, maxItems]);

  const compact = variant === "hubchat";

  return (
    <section
      className={cn(
        "space-y-2",
        compact ? "" : "rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 bg-card p-3",
      )}
    >
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "font-semibold uppercase tracking-wider text-muted-foreground",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          {title} ({filtered.length})
        </h3>
      </div>

      {filterPills.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilter("")}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors",
              filter === ""
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            Tudo
          </button>
          {filterPills.map(([typeKey, count]) => {
            const cfg = TYPE_CONFIG[typeKey] ?? DEFAULT_CONFIG;
            const active = filter === typeKey;
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setFilter(active ? "" : typeKey)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p
          className={cn(
            "rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground",
            compact ? "text-xs p-2" : "text-xs p-3",
          )}
        >
          {emptyMessage}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {filtered.map((i) => {
            const cfg = TYPE_CONFIG[String(i.type || "")] ?? DEFAULT_CONFIG;
            const Icon = cfg.icon;
            const agent = agentNameOf(i);
            const when = i.occurred_at || i.date_created;
            return (
              <li
                key={i.id}
                className={cn(
                  "flex items-start gap-2 rounded-md border border-border/60 bg-card",
                  compact ? "p-1.5" : "p-2",
                )}
              >
                <div
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-md font-semibold",
                    cfg.bg,
                    cfg.color,
                    compact ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs",
                  )}
                  title={cfg.label}
                >
                  <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-muted-foreground",
                      compact ? "text-[10px]" : "text-[11px]",
                    )}
                  >
                    <span className={cn("font-semibold uppercase", cfg.color)}>
                      {cfg.label}
                      {i.direction === "out" ? " ↑" : i.direction === "in" ? " ↓" : ""}
                    </span>
                    <span className="ml-auto font-mono tabular-nums" title={formatFull(when)}>
                      {formatRelative(when)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-foreground line-clamp-2 leading-snug",
                      compact ? "text-[11px] mt-0.5" : "text-xs mt-0.5",
                    )}
                  >
                    {i.summary || "Sem descrição"}
                  </p>
                  {agent && (
                    <p
                      className={cn(
                        "text-muted-foreground/80",
                        compact ? "text-[10px] mt-0.5" : "text-[11px] mt-0.5",
                      )}
                    >
                      por {agent}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
