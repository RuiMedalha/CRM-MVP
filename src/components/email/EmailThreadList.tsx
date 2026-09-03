import { useState } from "react";
import { Loader2, InboxIcon, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailThread } from "@/hooks/useEmailThreads";
import { EmailThreadCard } from "./EmailThreadCard";

interface Props {
  threads: EmailThread[] | undefined;
  isLoading: boolean;
  currentEmployeeId: number | null;
  search: string;
  onSelect: (thread: EmailThread) => void;
  onAssign: (thread: EmailThread) => void;
}

const CATEGORY_ORDER = [
  "pedido_orcamento",
  "followup_cliente",
  "reclamacao",
  "compra_cliente",
  "fornecedor_sourcing",
  "compra_fornecedor",
  "fatura_administrativo",
  "outro",
  "spam",
] as const;

const CATEGORY_HEADERS: Record<string, { emoji: string; label: string }> = {
  pedido_orcamento:         { emoji: "📋", label: "Pedidos de orçamento" },
  followup_cliente:         { emoji: "🔄", label: "Follow-ups" },
  reclamacao:               { emoji: "⚠️", label: "Reclamações" },
  compra_cliente:           { emoji: "📦", label: "Compras" },
  fornecedor_sourcing:      { emoji: "🏭", label: "Fornecedores (sourcing)" },
  compra_fornecedor:        { emoji: "🏭", label: "Fornecedores (compras)" },
  fatura_administrativo:    { emoji: "🧾", label: "Faturas" },
  outro:                    { emoji: "📌", label: "Outro" },
  spam:                     { emoji: "🚫", label: "Spam" },
};

export function EmailThreadList({ threads, isLoading, currentEmployeeId, search, onSelect, onAssign }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ spam: true });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Client-side search filter
  const filtered = (threads ?? []).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (t.subject ?? "").toLowerCase().includes(q) ||
      (t.from_address ?? "").toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <InboxIcon className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm">Nenhuma thread encontrada</p>
      </div>
    );
  }

  // Group by category
  const grouped: Record<string, EmailThread[]> = {};
  for (const thread of filtered) {
    const cat = thread.category || "outro";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(thread);
  }

  const toggle = (cat: string) => setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const header = CATEGORY_HEADERS[cat] || { emoji: "📌", label: cat };
        const isCollapsed = collapsed[cat] ?? false;

        return (
          <div key={cat}>
            <button
              type="button"
              onClick={() => toggle(cat)}
              className="flex items-center gap-2 w-full text-left px-1 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>{header.emoji} {header.label}</span>
              <span className="text-xs text-muted-foreground/70">({items.length})</span>
            </button>

            {!isCollapsed && (
              <div className="space-y-2 pl-1">
                {items.map((thread) => {
                  const canAssign =
                    (thread.status === "queued" && !thread.assigned_to) ||
                    (thread.assigned_to !== null && thread.assigned_to !== currentEmployeeId);

                  return (
                    <EmailThreadCard
                      key={thread.id}
                      thread={thread}
                      onClick={() => onSelect(thread)}
                      onAssign={() => onAssign(thread)}
                      showAssign={!!currentEmployeeId && canAssign}
                      allThreads={threads}
                      onOpenThread={(id) => { const t = threads?.find(x => x.id === id); if (t) onSelect(t); }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
