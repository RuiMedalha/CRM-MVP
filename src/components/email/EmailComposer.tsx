import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { listMessageTemplates, type MessageTemplate } from "@/integrations/directus/messageTemplates";
import {
  aiSuggestReply,
  aiImprove,
  aiTranslate,
  type EmailContext,
} from "@/integrations/ai/emailAssistant";
import {
  Bold, Italic, List, Link2, Paperclip, Sparkles, Wand2, Languages,
  Send, StickyNote, FileText, Loader2, X,
} from "lucide-react";

/**
 * EmailComposer — editor rico de email com templates, IA de apoio e anexos.
 * Inspirado no UniversalComposer (design freeze), reconstruído para o CRM real:
 *  - IA via proxy n8n (emailAssistant) — NUNCA envia, só preenche o rascunho.
 *  - Templates lidos de message_templates (Directus).
 *  - Envio via webhook n8n `send-email` (a criar) — enquanto não existir, grava rascunho.
 * Modos: "reply" (email ao cliente) | "note" (nota interna, nunca sai para o cliente).
 */

export interface EmailComposerProps {
  to?: string;
  subject?: string;
  /** contexto para a IA: email recebido, nome do cliente, texto da thread */
  context?: EmailContext;
  threadText?: string;
  /** chamado ao Enviar (email real) — se ausente, só permite guardar rascunho */
  onSend?: (payload: { to: string; subject: string; bodyHtml: string; attachments: File[] }) => Promise<void> | void;
  /** chamado ao guardar rascunho */
  onSaveDraft?: (payload: { subject: string; bodyHtml: string }) => Promise<void> | void;
  onCancel?: () => void;
}

type Mode = "reply" | "note";

export function EmailComposer({
  to: initialTo = "",
  subject: initialSubject = "",
  context,
  threadText,
  onSend,
  onSaveDraft,
  onCancel,
}: EmailComposerProps) {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("reply");
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiBusy, setAiBusy] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    listMessageTemplates().then((t) =>
      setTemplates(t.filter((x) => x.channel === "email" || x.channel === "all")),
    );
  }, []);

  // ─── Formatação rica (execCommand — suportado nos browsers alvo) ──────────
  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };
  const getHtml = () => editorRef.current?.innerHTML ?? "";
  const setHtml = (html: string) => {
    if (editorRef.current) editorRef.current.innerHTML = html;
  };
  const getText = () => editorRef.current?.innerText ?? "";

  // ─── Templates ────────────────────────────────────────────────────────────
  const applyTemplate = (t: MessageTemplate) => {
    setHtml(t.content.replace(/\n/g, "<br>"));
    setShowTemplates(false);
    toast({ title: `Template "${t.name}" aplicado` });
  };

  // ─── IA (sempre preenche o rascunho; nunca envia) ────────────────────────
  const runAI = async (kind: "suggest" | "improve" | "translate") => {
    try {
      setAiBusy(kind);
      const ctx: EmailContext = { ...context, subject, draft: getText() };
      let result = "";
      if (kind === "suggest") result = await aiSuggestReply(ctx);
      else if (kind === "improve") result = await aiImprove(ctx);
      else result = await aiTranslate(ctx, "inglês");
      setHtml(result.replace(/\n/g, "<br>"));
      toast({ title: "Sugestão da IA inserida", description: "Revê antes de enviar." });
    } catch {
      toast({ title: "IA indisponível", description: "Tenta novamente.", variant: "destructive" });
    } finally {
      setAiBusy("");
    }
  };

  // ─── Anexos ───────────────────────────────────────────────────────────────
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  };
  const removeFile = (i: number) => setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  // ─── Enviar / guardar ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (mode === "note") {
      await onSaveDraft?.({ subject, bodyHtml: getHtml() });
      toast({ title: "Nota interna guardada" });
      return;
    }
    if (!onSend) {
      await onSaveDraft?.({ subject, bodyHtml: getHtml() });
      toast({ title: "Guardado como rascunho", description: "Envio directo ainda não activo (webhook send-email)." });
      return;
    }
    try {
      setSending(true);
      await onSend({ to, subject, bodyHtml: getHtml(), attachments });
      toast({ title: "Email enviado" });
    } catch {
      toast({ title: "Falha no envio", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const isNote = mode === "note";

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Modo */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <button
          onClick={() => setMode("reply")}
          className={`rounded-md px-3 py-1 text-xs font-medium ${!isNote ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Responder
        </button>
        <button
          onClick={() => setMode("note")}
          className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium ${isNote ? "bg-amber-100 text-amber-800" : "text-muted-foreground hover:bg-muted"}`}
        >
          <StickyNote className="h-3.5 w-3.5" /> Nota interna
        </button>
        {isNote && <span className="ml-2 text-xs text-amber-700">não visível ao cliente</span>}
      </div>

      {/* Cabeçalho email */}
      {!isNote && (
        <div className="space-y-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="w-12 text-xs text-muted-foreground">Para</span>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="cliente@email.pt" className="h-8 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-12 text-xs text-muted-foreground">Assunto</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" className="h-8 text-sm" />
          </div>
        </div>
      )}

      {/* Barra de formatação */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-1.5">
        <ToolBtn onClick={() => exec("bold")} title="Negrito"><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Itálico"><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Lista"><List className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => { const url = prompt("URL:"); if (url) exec("createLink", url); }} title="Link"><Link2 className="h-3.5 w-3.5" /></ToolBtn>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolBtn onClick={() => setShowTemplates((v) => !v)} title="Templates"><FileText className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => fileRef.current?.click()} title="Anexar"><Paperclip className="h-3.5 w-3.5" /></ToolBtn>
        <div className="mx-1 h-4 w-px bg-border" />
        {!isNote && (
          <>
            <AiBtn busy={aiBusy === "suggest"} onClick={() => runAI("suggest")}><Sparkles className="h-3.5 w-3.5" /> Sugerir</AiBtn>
            <AiBtn busy={aiBusy === "improve"} onClick={() => runAI("improve")}><Wand2 className="h-3.5 w-3.5" /> Melhorar</AiBtn>
            <AiBtn busy={aiBusy === "translate"} onClick={() => runAI("translate")}><Languages className="h-3.5 w-3.5" /> Traduzir</AiBtn>
          </>
        )}
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
      </div>

      {/* Templates dropdown */}
      {showTemplates && (
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem templates. Cria em Definições → Templates.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {templates.map((t) => (
                <button key={t.id} onClick={() => applyTemplate(t)} className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted">
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={`min-h-[140px] px-3 py-3 text-sm outline-none ${isNote ? "bg-amber-50/40" : ""}`}
        data-placeholder="Escreve a mensagem…"
      />

      {/* Anexos */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
          {attachments.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3" /> {f.name}
              <button onClick={() => removeFile(i)} className="ml-1 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      {/* Rodapé */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {isNote ? "A nota fica só no CRM" : onSend ? "Envio via n8n" : "Envio directo por activar — guarda rascunho"}
        </span>
        <div className="flex gap-2">
          {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>}
          <Button size="sm" onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : isNote ? <StickyNote className="mr-1 h-3.5 w-3.5" /> : <Send className="mr-1 h-3.5 w-3.5" />}
            {isNote ? "Guardar nota" : onSend ? "Enviar" : "Guardar rascunho"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
      {children}
    </button>
  );
}

function AiBtn({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}
