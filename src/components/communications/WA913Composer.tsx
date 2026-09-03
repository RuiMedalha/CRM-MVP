import { type KeyboardEvent, useState } from "react";
import { FileText, Loader2, Send } from "lucide-react";

import {
  createWA913OutboundMessage,
  sendTemplateViaWA913,
  sendTextViaWA913,
  WA913_TEMPLATES,
} from "@/integrations/directus/wa913";

interface Props {
  contactPhone: string;
  conversationId: string;
  onMessageSent?: () => void;
}

export function WA913Composer({ contactPhone, conversationId, onMessageSent }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSendText = async () => {
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      await sendTextViaWA913(contactPhone, text.trim());
      await createWA913OutboundMessage(conversationId, text.trim(), "text");
      setText("");
      onMessageSent?.();
    } catch {
      setError("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async (tpl: (typeof WA913_TEMPLATES)[number]) => {
    setSending(true);
    setError("");
    try {
      await sendTemplateViaWA913(contactPhone, tpl.name, tpl.language, tpl.components);
      await createWA913OutboundMessage(conversationId, tpl.preview, "template");
      setShowTemplates(false);
      onMessageSent?.();
    } catch {
      setError("Erro ao enviar template");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendText();
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-card p-3">
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      {showTemplates && (
        <div className="mb-2 space-y-1 rounded-lg border border-border bg-background p-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">Templates aprovados</p>
          {WA913_TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => handleSendTemplate(tpl)}
              disabled={sending}
              className="w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <span className="font-medium text-foreground">{tpl.label}</span>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{tpl.preview}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setShowTemplates((s) => !s)}
          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Templates WABA"
        >
          <FileText className="h-[18px] w-[18px]" />
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escreve uma mensagem..."
          rows={1}
          disabled={sending}
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        />

        <button
          type="button"
          onClick={handleSendText}
          disabled={sending || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          title="Enviar"
        >
          {sending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  );
}

export default WA913Composer;
