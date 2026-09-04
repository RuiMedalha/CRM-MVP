import { useState } from "react";
import { SectionCard } from "./ui/SectionCard";
import { EmptyState } from "./ui/EmptyState";

interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  description?: string;
  occurredAt: string;
  actor?: string;
}

interface TimelinePanelProps {
  events: TimelineEntry[];
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  email: { icon: "📧", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30" },
  whatsapp: { icon: "💬", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30" },
  phone: { icon: "📞", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30" },
  note: { icon: "📝", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30" },
  meeting: { icon: "🤝", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/30" },
  proposal_sent: { icon: "📄", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/30" },
  proposal_approved: { icon: "✅", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
  status_change: { icon: "🔄", color: "text-muted-foreground", bg: "bg-muted" },
  payment: { icon: "💰", color: "text-green-700", bg: "bg-green-50 dark:bg-green-900/30" },
  order: { icon: "📦", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30" },
  assistance: { icon: "🔧", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/30" },
  ai: { icon: "🤖", color: "text-primary", bg: "bg-primary/10" },
  task: { icon: "✓", color: "text-muted-foreground", bg: "bg-muted" },
  system: { icon: "⚙️", color: "text-gray-500", bg: "bg-muted" },
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `hoje ${time}`;
  if (isYesterday) return `ontem ${time}`;
  return `${d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" })} ${time}`;
}

const FILTER_TYPES = [
  { key: "", label: "Tudo" },
  { key: "email", label: "📧 Email" },
  { key: "whatsapp", label: "💬 WhatsApp" },
  { key: "phone", label: "📞 Chamadas" },
  { key: "note", label: "📝 Notas" },
  { key: "proposal", label: "📄 Propostas" },
];

export function TimelinePanel({ events }: TimelinePanelProps) {
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = typeFilter
    ? events.filter((ev) => ev.type.includes(typeFilter))
    : events;

  return (
    <SectionCard title="Timeline" className="h-full">
      {/* Type filters */}
      <div className="flex gap-1 flex-wrap mb-3">
        {FILTER_TYPES.map((f) => (
          <button key={f.key} type="button" onClick={() => setTypeFilter(f.key)} className={`rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${typeFilter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📋" message={typeFilter ? "Sem eventos deste tipo." : "A timeline está vazia."} />
      ) : (
        <div className="space-y-0.5">
          {filtered.map((ev, i) => {
            const config = TYPE_CONFIG[ev.type] ?? { icon: "•", color: "text-gray-500", bg: "bg-gray-50" };
            return (
              <div key={ev.id}>
                {/* Date separator */}
                {i === 0 || new Date(filtered[i - 1].occurredAt).toDateString() !== new Date(ev.occurredAt).toDateString() ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      {new Date(ev.occurredAt).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : null}

                <div
                  className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/40 transition-colors cursor-pointer"
                  onClick={() => {
                    if (ev.type === "email" && ev.id) window.location.href = `/email`;
                    else if (ev.type === "proposal_sent" || ev.type === "proposal_approved") {
                      const propId = ev.id.replace("prop-", "");
                      window.location.href = `/propostas/${propId}/detalhe`;
                    }
                  }}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${config.bg}`}>
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground leading-tight">{ev.title}</p>
                    {ev.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>
                    )}
                    {ev.actor && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{ev.actor}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground whitespace-nowrap shrink-0 tabular-nums mt-0.5">
                    {formatDate(ev.occurredAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
