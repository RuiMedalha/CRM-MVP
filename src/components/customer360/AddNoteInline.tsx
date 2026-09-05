/**
 * AddNoteInline — textarea inline para adicionar uma nota ao dossier.
 *
 * Usa useCustomerDossier().addNote (grava em interactions + activities via dual-write
 * já existente no createInteraction).
 *
 * Usado em:
 *   • CustomerDossierPanel (vista base)
 *   • Customer360Shell (tab Geral)
 *   • Telecof e superfícies omnichannel
 */

import { useEffect, useRef, useState } from "react";
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
  noteQuickTags?: string[];
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

const DEFAULT_QUICK_TAGS = ["Urgente", "Acompanhamento", "Follow-up", "Reclamação", "Orçamento", "Técnico"];

export function AddNoteInline({
  contactId,
  leadId,
  source = "c360",
  callId,
  quickTags,
  noteQuickTags,
  direction = "out",
  variant = "telecof",
  disabled = false,
  placeholder = "Escreve à vontade — esta nota fica guardada no dossier do cliente.",
  onSaved,
}: AddNoteInlineProps) {
  const dossier = useCustomerDossier({ contactId, leadId });
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const availableTags = quickTags || noteQuickTags || DEFAULT_QUICK_TAGS;

  /**
   * Auto-grow da textarea: ajusta a altura ao conteúdo com cap a MAX_HEIGHT.
   * - MIN_HEIGHT garante ~6 linhas visíveis no arranque (variant telecof/threec-sixty).
   * - MAX_HEIGHT impede que a textarea ocupe a página inteira.
   */
  const MIN_HEIGHT = variant === "hubchat" ? 48 : 120;
  const MAX_HEIGHT = 400;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [text, variant, MIN_HEIGHT]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || text) return;
    el.style.height = `${MIN_HEIGHT}px`;
    el.style.overflowY = "hidden";
  }, [text, MIN_HEIGHT]);

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
        compact ? "" : variant === "threec-sixty" ? "" : "rounded-xl border border-border bg-card p-3",
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
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={variant === "hubchat" ? 2 : 5}
        disabled={disabled || saving || !dossier.canAddNote}
        style={{ minHeight: MIN_HEIGHT }}
        className={cn(
          "w-full resize-none rounded-lg border border-border bg-background outline-none transition focus:ring-2 focus:ring-primary/30 focus:border-primary leading-relaxed",
          compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
          (disabled || !dossier.canAddNote) && "opacity-60 cursor-not-allowed",
        )}
      />

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {availableTags.map((tag) => {
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
