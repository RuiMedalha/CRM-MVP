/**
 * AddNoteInline — textarea inline para adicionar uma nota ao dossier.
 *
 * Usa useCustomerDossier().addNote (grava em interactions + activities via dual-write
 * já existente no createInteraction).
 *
 * Usado em:
 *   • CustomerDossierPanel (vista base)
 *   • Pode ser consumido diretamente em outras superfícies se desejado.
 */

import { useState } from "react";
import { Loader2, StickyNote, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCustomerDossier } from "@/hooks/useCustomerDossier";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AddNoteInlineProps {
  contactId?: string | number | null;
  leadId?: string | number | null;
  /** Origem da nota (default "telecof"). Aparece no payload e na timeline. */
  source?: string;
  /** callId para ligar a nota à chamada actual (Telecof). */
  callId?: string;
  /** Tags rápidas (chips abaixo da textarea). */
  quickTags?: string[];
  /** Direção da interação (default "out" — registo interno). */
  direction?: "in" | "out";
  /** Variante visual: telecof (default), hubchat, threec-sixty. */
  variant?: "telecof" | "hubchat" | "threec-sixty";
  /** Desabilitar o input. */
  disabled?: boolean;
  placeholder?: string;
  /** Callback chamado após gravar com sucesso. */
  onSaved?: (noteId: string) => void;
}

const DEFAULT_QUICK_TAGS = ["Reclamar", "Orçamento", "Técnico", "Urgente", "Follow-up"];

export function AddNoteInline({
  contactId,
  leadId,
  source = "telecof",
  callId,
  quickTags = DEFAULT_QUICK_TAGS,
  direction = "out",
  variant = "telecof",
  disabled = false,
  placeholder = "Notas / próximos passos / pedido do cliente…",
  onSaved,
}: AddNoteInlineProps) {
  const dossier = useCustomerDossier({ contactId, leadId });
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!dossier.canAddNote) {
      toast({
        title: "Sem contexto",
        description: "Não há contactId nem leadId associado a este ecrã.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const created = await dossier.addNote(trimmed, {
        tags: tags.length ? tags : undefined,
        source,
        callId,
        direction,
      });
      if (created?.id) {
        setText("");
        setTags([]);
        toast({
          title: "Nota adicionada ao dossiê",
          description: "Visível na timeline do cliente.",
        });
        onSaved?.(String(created.id));
      } else {
        toast({
          title: "Não foi possível guardar a nota",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Erro a guardar nota",
        description: String((err as Error)?.message || err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const compact = variant === "hubchat";

  return (
    <section
      className={cn(
        "space-y-2",
        compact ? "" : "rounded-xl border border-border bg-card p-3",
      )}
    >
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          <StickyNote className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {compact ? "Nova nota" : "Adicionar nota ao dossiê"}
        </h3>
        {!dossier.canAddNote && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" />
            inativo
          </span>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        disabled={disabled || saving || !dossier.canAddNote}
        className={cn(
          "w-full resize-none rounded-lg border border-border bg-background outline-none transition focus:ring-2 focus:ring-primary/30 focus:border-primary",
          compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
          (disabled || !dossier.canAddNote) && "opacity-60 cursor-not-allowed",
        )}
      />

      {quickTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {quickTags.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                disabled={disabled || saving}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition border",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        onClick={handleSave}
        disabled={!text.trim() || saving || !dossier.canAddNote}
        className={cn(
          "w-full font-semibold",
          compact ? "h-8 text-xs" : "h-10 text-sm",
        )}
      >
        {saving ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> A guardar…
          </>
        ) : (
          "Guardar no cliente"
        )}
      </Button>
    </section>
  );
}
