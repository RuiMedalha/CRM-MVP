/**
 * CommandCenter — últimos acontecimentos relevantes, misturados por importância.
 * Reutilizável: Customer360 (centro), Dashboard (widget).
 */

import { SectionCard } from "./ui/SectionCard";
import { EmptyState } from "./ui/EmptyState";

export interface CommandCenterEvent {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  occurredAt: string;
  priority?: "high" | "medium" | "low";
  actor?: string;
}

interface CommandCenterProps {
  events: CommandCenterEvent[];
  maxItems?: number;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  email: { icon: "📧", color: "border-l-blue-400" },
  whatsapp: { icon: "💬", color: "border-l-green-400" },
  phone: { icon: "📞", color: "border-l-purple-400" },
  proposal_sent: { icon: "📄", color: "border-l-teal-400" },
  proposal_viewed: { icon: "👁", color: "border-l-amber-400" },
  proposal_approved: { icon: "✅", color: "border-l-emerald-400" },
  opportunity: { icon: "🎯", color: "border-l-indigo-400" },
  note: { icon: "📝", color: "border-l-slate-300" },
  meeting: { icon: "🤝", color: "border-l-pink-400" },
  order: { icon: "📦", color: "border-l-orange-400" },
  assistance: { icon: "🔧", color: "border-l-red-400" },
  payment: { icon: "💰", color: "border-l-emerald-400" },
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function CommandCenter({ events, maxItems = 6 }: CommandCenterProps) {
  const visible = events.slice(0, maxItems);

  return (
    <SectionCard title="Acontecimentos recentes">
      {visible.length === 0 ? (
        <EmptyState icon="📋" message="Sem actividade recente." />
      ) : (
        <div className="space-y-0.5">
          {visible.map((ev) => {
            const config = TYPE_CONFIG[ev.type] ?? { icon: "•", color: "border-l-gray-300" };
            return (
              <div
                key={ev.id}
                className={`flex items-start gap-2.5 rounded-lg border-l-[3px] px-3 py-2 hover:bg-accent/30 transition-colors ${config.color}`}
              >
                <span className="text-sm shrink-0 mt-0.5">{config.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground leading-tight truncate">{ev.title}</p>
                  {ev.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{ev.subtitle}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatTimeAgo(ev.occurredAt)}</span>
                  {ev.actor && <p className="text-xs text-muted-foreground/70 mt-0.5">{ev.actor}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
