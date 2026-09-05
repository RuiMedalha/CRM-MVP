import { useMemo, useState } from "react";
import { CheckSquare, Square, Download, X } from "lucide-react";
import { SectionCard } from "./ui/SectionCard";
import { EmptyState } from "./ui/EmptyState";
import { StatusBadge } from "./ui/StatusBadge";
import { cn } from "@/lib/utils";

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
  /** Identificador da organização (para CSV header e nome do ficheiro). */
  organizationName?: string;
}

const ROLE_BADGES: Record<string, { label: string; variant: "success" | "info" | "warning" | "muted" }> = {
  decision_maker: { label: "Principal", variant: "success" },
  financial: { label: "Financeiro", variant: "info" },
  technical: { label: "Chef", variant: "warning" },
  operational: { label: "Operacional", variant: "muted" },
  other: { label: "Contacto", variant: "muted" },
};

/**
 * CSV-escape RFC 4180 — campos com vírgula, aspas ou newline são
 * envolvidos por aspas duplas; aspas internas duplicadas.
 */
function csvEscape(value: string | undefined | null): string {
  const v = String(value ?? "");
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Serializa uma lista de contactos em CSV e dispara download no browser. */
export function exportContactsCsv(contacts: ContactEntry[], organizationName = "contactos"): void {
  const headers = ["name", "role", "job_title", "phone", "email", "whatsapp", "is_primary"];
  const rows = contacts.map((c) =>
    [
      c.name,
      ROLE_BADGES[c.role]?.label ?? c.role,
      c.jobTitle,
      c.phone,
      c.email,
      c.whatsapp,
      c.isPrimary ? "sim" : "não",
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  // BOM para Excel PT abrir com UTF-8
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${organizationName.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase()}_contactos.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ContactListPanel({ contacts, organizationName = "organizacao" }: ContactListPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const selectedCount = selected.size;
  const selectedContacts = useMemo(
    () => contacts.filter((c) => selected.has(c.id)),
    [contacts, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedCount === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  }

  function exitBulk() {
    setSelected(new Set());
    setBulkMode(false);
  }

  function handleExport() {
    const toExport = selectedCount > 0 ? selectedContacts : contacts;
    exportContactsCsv(toExport, organizationName);
  }

  return (
    <SectionCard
      title="Contactos"
      action={
        <div className="flex items-center gap-1">
          {bulkMode ? (
            <>
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                title={selectedCount === contacts.length ? "Desmarcar todos" : "Marcar todos"}
              >
                {selectedCount === contacts.length ? (
                  <CheckSquare className="h-3 w-3 text-primary" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
                {selectedCount > 0 ? `${selectedCount}/${contacts.length}` : "Todos"}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={selectedCount === 0}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                title="Exportar contactos seleccionados em CSV"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
              <button
                type="button"
                onClick={exitBulk}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                title="Sair do modo bulk"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setBulkMode(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              title="Seleccionar contactos para exportar ou editar em lote"
            >
              <CheckSquare className="h-3 w-3" /> Selecionar
            </button>
          )}
        </div>
      }
    >
      {contacts.length === 0 ? (
        <EmptyState icon="👥" message="Ainda não existem contactos para esta empresa." />
      ) : (
        <div className="space-y-1">
          {contacts.map((c) => {
            const badge = ROLE_BADGES[c.role] ?? ROLE_BADGES.other;
            const isSelected = selected.has(c.id);
            return (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors",
                  bulkMode ? "cursor-pointer" : "cursor-default",
                  isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent/50",
                )}
                onClick={() => bulkMode && toggle(c.id)}
              >
                {/* Bulk checkbox */}
                {bulkMode && (
                  <div className="shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                )}

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
