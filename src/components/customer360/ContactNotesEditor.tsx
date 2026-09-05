import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { equalNotes, notesDraftKey, notesReducer, restoreNotes, type NotesValue } from "@/lib/workspace/notes";

interface Props { contactId: string; userId: string; notes?: string; internalNotes?: string }

/** Keyed by user AND contact by the parent: no draft or in-flight save crosses identities. */
export function ContactNotesEditor({ contactId, userId, notes = "", internalNotes = "" }: Props) {
  const key = notesDraftKey(userId, contactId);
  const [storageError, setStorageError] = useState(false);
  const [state, dispatch] = useReducer(notesReducer, undefined, () => {
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(key); } catch { /* Memory editing remains available. */ }
    return restoreNotes({ notes, internal_notes: internalNotes }, stored, Date.now());
  });
  const busy = useRef(false);
  const mounted = useRef(true);
  const qc = useQueryClient();
  const dirty = !equalNotes(state.draft, state.saved);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { dispatch({ type: "remote", value: { notes, internal_notes: internalNotes } }); }, [notes, internalNotes]);
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ draft: state.draft, saved: state.saved, at: Date.now() }));
      else sessionStorage.removeItem(key);
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [key, dirty, state.draft, state.saved]);
  useEffect(() => {
    if (!dirty && !state.saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, state.saving]);

  const save = useCallback(async () => {
    if (busy.current || !dirty || state.conflict) return;
    busy.current = true;
    const snapshot = { ...state.draft };
    const endpoint = `/items/contacts/${encodeURIComponent(contactId)}`;
    const readNotes = async (): Promise<NotesValue> => {
      const r = await directusRequest<{ data: { notes?: string | null; internal_notes?: string | null } }>(endpoint + "?fields=notes,internal_notes");
      if (!r.data || !("notes" in r.data) || !("internal_notes" in r.data)) throw new Error("Não foi possível verificar as notas.");
      return { notes: r.data.notes ?? "", internal_notes: r.data.internal_notes ?? "" };
    };
    dispatch({ type: "saving" });
    try {
      const current = await readNotes();
      if (!equalNotes(current, state.saved) && !equalNotes(current, snapshot)) {
        if (mounted.current) {
          dispatch({ type: "remote", value: current });
          dispatch({ type: "failed", message: "As notas foram alteradas noutra sessão. O teu rascunho foi preservado." });
        }
        return;
      }
      if (!equalNotes(current, snapshot)) {
        await directusRequest(endpoint, { method: "PATCH", body: JSON.stringify(snapshot) });
      }
      const verified = await readNotes();
      if (!equalNotes(verified, snapshot)) throw new Error("A confirmação de gravação não corresponde ao rascunho.");
      if (mounted.current) dispatch({ type: "saved", value: snapshot });
      else {
        // A successful late response must not erase edits from a newly mounted editor.
        try {
          const stored = sessionStorage.getItem(key);
          if (stored && equalNotes(JSON.parse(stored).draft, snapshot)) sessionStorage.removeItem(key);
        } catch { /* Keep recoverable data if storage cannot be read. */ }
      }
      void qc.invalidateQueries({ queryKey: ["customer360", contactId] });
    } catch {
      if (mounted.current) dispatch({ type: "failed", message: "Gravação não confirmada. O texto mantém-se aqui. Verifica a ligação e tenta novamente." });
    } finally { busy.current = false; }
  }, [contactId, dirty, key, qc, state.conflict, state.draft, state.saved]);

  useEffect(() => {
    if (!dirty || state.saving || state.error || state.conflict) return;
    const timer = window.setTimeout(() => { void save(); }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, save, state.saving, state.error, state.conflict]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Notas gerais da ficha. Os registos de cada atendimento continuam no histórico.</p>
      <div className="space-y-1.5"><Label htmlFor={key + ":general"}>Notas da ficha</Label><Textarea id={key + ":general"} rows={3} value={state.draft.notes} onChange={(e) => dispatch({ type: "edit", field: "notes", value: e.target.value })} className="min-h-24 text-base" placeholder="Contexto permanente do contacto…" /></div>
      <div className="space-y-1.5"><Label htmlFor={key + ":internal"}>Notas internas</Label><Textarea id={key + ":internal"} rows={3} value={state.draft.internal_notes} onChange={(e) => dispatch({ type: "edit", field: "internal_notes", value: e.target.value })} className="min-h-24 text-base" placeholder="Informação interna da equipa…" /></div>
      {state.error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{state.error}</p>}
      {state.conflict && <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>Existe uma versão diferente no servidor. Copia o teu rascunho antes de carregar essa versão.</p><Button variant="outline" className="min-h-11" onClick={() => { if (window.confirm("Carregar as notas do servidor e substituir este rascunho?")) dispatch({ type: "accept-remote" }); }}>Carregar versão do servidor</Button></div>}
      {storageError && <p role="alert" className="text-sm text-destructive">Recuperação local indisponível. Não feches esta ficha antes de confirmar a gravação.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" className="min-h-11" onClick={() => void save()} disabled={!dirty || state.saving || state.conflict}>{state.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {state.error ? "Tentar novamente" : "Guardar agora"}</Button>
        <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm text-muted-foreground">{state.saving ? "A guardar…" : dirty ? "Não sincronizado" : state.confirmed ? <><Check className="h-4 w-4" />Guardado e confirmado</> : "Sem alterações"}</span>
      </div>
    </div>
  );
}
