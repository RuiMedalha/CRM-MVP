/**
 * PriorityPanel — mostra itens que requerem atenção imediata.
 * Reutilizável: Customer360, Dashboard, Inbox.
 */

import { SectionCard } from "./ui/SectionCard";
import { EmptyState } from "./ui/EmptyState";
import { cn } from "@/lib/utils";

export interface PriorityItem {
  id: string;
  title: string;
  type: string;
  priority: "P1" | "P2" | "P3";
  dueAt?: string;
}

interface PriorityPanelProps {
  items: PriorityItem[];
}

const PRIORITY_CONFIG = {
  P1: { label: "P1", bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  P2: { label: "P2", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  P3: { label: "P3", bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
};

const TYPE_ICONS: Record<string, string> = {
  proposal_no_response: "📄",
  whatsapp_pending: "💬",
  email_urgent: "📧",
  visit_scheduled: "📍",
  payment_pending: "💰",
  assistance_critical: "🔧",
  call_missed: "📞",
  sla_exceeded: "⏱",
};

export function PriorityPanel({ items }: PriorityPanelProps) {
  return (
    <SectionCard title="Prioridades">
      {items.length === 0 ? (
        <EmptyState icon="✅" message="Sem itens prioritários." />
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const config = PRIORITY_CONFIG[item.priority];
            return (
              <div key={item.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-accent/40 transition-colors">
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
                <span className="text-sm shrink-0">{TYPE_ICONS[item.type] ?? "•"}</span>
                <span className="text-[12px] font-medium text-foreground truncate flex-1">{item.title}</span>
                <span className={cn("font-mono text-xs font-bold px-1.5 py-0.5 rounded", config.bg, config.text)}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
