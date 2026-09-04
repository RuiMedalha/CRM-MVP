/**
 * AddNoteInline — versão sprint 3, auto-suficiente (não depende do hook
 * useCustomerDossier do sprint Telecof).
 *
 * Textarea com auto-grow que grava nota em `interactions` via createInteraction.
 *
 * Usado por:
 *   • Customer360Shell (tab Geral)
 *   • Pode ser consumido por outras superfícies
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, StickyNote } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createInteraction } from "@/integrations/directus/interactions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AddNoteInlineProps {
  contactId?: string;
  leadId?: string;
  source?: string;
  callId?: string;
  quickTags?: string[];
  variant?: "telecof" | "hubchat" | "threec-sixty";
  disabled?: boolean;
  placeholder?: string;
  onSaved?: (interactionId: string) => void;
}

const DEFAULT_QUICK_TAGS = ["Urgente", "Acompanhamento", "Follow-up", "Reclamação"];

export function AddNoteInline({
  contactId,
  leadId,
  source = "crm",
  callId,
  quickTags = DEFAULT_QUICK_TAGS,
  variant = "telecof",
  disabled = false,
  placeholder = "Escreve à vontade — esta nota fica guardada no dossier do cliente.",
  onSaved,
}: AddNoteInlineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const agentName = user?.first_name ?? user?.email ?? "Agente";
  const compact = variant === "hubchat";

  // Auto-grow (commit sprint-telecof: minHeight 144px / cap 400px)
  const MIN_HEIGHT = variant === "hubchat" ? 48 : 144;
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
    if (!contactId && !leadId) {
      toast({
        title: "Sem contexto",
        description: "Não há contactId nem leadId associado.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type: "note",
        direction: "out",
        status: "done",
        source,
        summary: trimmed.slice(0, 200),
        payload: {
          text: trimmed,
          tags: tags.length ? tags : undefined,
          call_id: callId,
          agent_name: agentName,
        },
      };
      if (contactId) payload.contact_id = contactId;
      if (leadId) payload.lead_id = leadId;

      const created = await createInteraction(payload as any);
      if (created?.id) {
        setText("");
        setTags([]);
        toast({ title: "Nota adicionada ao dossiê", description: "Visível na timeline." });
        // Invalidar caches coerentes
        queryClient.invalidateQueries({ queryKey: ["customer360"] });
        queryClient.invalidateQueries({ queryKey: ["customer-dossier"] });
        queryClient.invalidateQueries({ queryKey: ["interactions"] });
        onSaved?.(String(created.id));
      } else {
        toast({ title: "Não foi possível guardar", variant: "destructive" });
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

  return (
    <section className={cn("space-y-2", compact ? "" : "")}>
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          <StickyNote className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {compact ? "Nova nota" : "Notas do dossiê"}
        </h3>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={variant === "hubchat" ? 2 : 6}
        disabled={disabled || saving}
        style={{ minHeight: MIN_HEIGHT }}
        className={cn(
          "w-full resize-none rounded-lg border border-border bg-background outline-none transition focus:ring-2 focus:ring-primary/30 focus:border-primary leading-relaxed",
          compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
          disabled && "opacity-60 cursor-not-allowed",
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

      <button
        type="button"
        onClick={handleSave}
        disabled={!text.trim() || saving || disabled}
        className={cn(
          "w-full font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
          compact ? "h-8 text-xs" : "h-10 text-sm",
        )}
      >
        {saving ? (
          <>
            <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> A guardar…
          </>
        ) : (
          "Guardar no cliente"
        )}
      </button>
    </section>
  );
}
