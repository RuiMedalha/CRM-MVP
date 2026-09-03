import { SectionCard } from "./ui/SectionCard";
import { EmptyState } from "./ui/EmptyState";
import { StatusBadge } from "./ui/StatusBadge";

interface ContactEntry {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  jobTitle?: string;
  isPrimary?: boolean;
}

interface ContactListPanelProps {
  contacts: ContactEntry[];
}

const ROLE_BADGES: Record<string, { label: string; variant: "success" | "info" | "warning" | "muted" }> = {
  decision_maker: { label: "Principal", variant: "success" },
  financial: { label: "Financeiro", variant: "info" },
  technical: { label: "Chef", variant: "warning" },
  operational: { label: "Operacional", variant: "muted" },
  other: { label: "Contacto", variant: "muted" },
};

export function ContactListPanel({ contacts }: ContactListPanelProps) {
  return (
    <SectionCard title="Contactos">
      {contacts.length === 0 ? (
        <EmptyState icon="👥" message="Ainda não existem contactos para esta empresa." />
      ) : (
        <div className="space-y-1">
          {contacts.map((c) => {
            const badge = ROLE_BADGES[c.role] ?? ROLE_BADGES.other;
            return (
              <div
                key={c.id}
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-accent/50 transition-colors cursor-default"
              >
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary">
                  {c.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">{c.name}</span>
                    <StatusBadge label={badge.label} variant={badge.variant} />
                    {c.isPrimary && <StatusBadge label="★" variant="success" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {c.jobTitle && <span>{c.jobTitle}</span>}
                    {c.phone && <span className="font-mono">📞 {c.phone}</span>}
                    {c.email && <span className="truncate max-w-[140px]">✉️ {c.email}</span>}
                    {c.whatsapp && <span className="font-mono">💬 {c.whatsapp}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
