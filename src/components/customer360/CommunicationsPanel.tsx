/**
 * CommunicationsPanel — últimas comunicações por canal.
 * Reutilizável: Customer360, Contact detail.
 */

import { SectionCard } from "./ui/SectionCard";
import { EmptyState } from "./ui/EmptyState";

export interface CommunicationEntry {
  id: string;
  channel: "email" | "whatsapp" | "phone";
  title: string;
  date: string;
  actor?: string;
}

interface CommunicationsPanelProps {
  items: CommunicationEntry[];
}

const CHANNEL_CONFIG = {
  email: { icon: "📧", label: "Email" },
  whatsapp: { icon: "💬", label: "WhatsApp" },
  phone: { icon: "📞", label: "Chamada" },
};

export function CommunicationsPanel({ items }: CommunicationsPanelProps) {
  return (
    <SectionCard title="Comunicações">
      {items.length === 0 ? (
        <EmptyState icon="💬" message="Sem comunicações recentes." />
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const config = CHANNEL_CONFIG[item.channel] ?? { icon: "•", label: item.channel };
            return (
              <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/40 transition-colors">
                <span className="text-sm shrink-0">{config.icon}</span>
                <span className="text-[12px] text-foreground truncate flex-1">{item.title}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{item.date}</span>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
