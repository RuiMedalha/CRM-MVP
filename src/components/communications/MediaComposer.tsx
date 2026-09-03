import { type ChangeEvent, type KeyboardEvent, useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  Mic,
  Paperclip,
  Send,
  Smile,
  X,
} from "lucide-react";

import {
  fileToBase64,
  sendAudioViaEvolution,
  sendDocumentViaEvolution,
  sendImageViaEvolution,
  sendTextViaEvolution,
  uploadToDirectus,
} from "@/integrations/evolution/client";
import { createOutboundMessage } from "@/integrations/directus/wa916";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DIRECTUS_URL = "https://api.hotelequip.pt";
import { DIRECTUS_ADMIN_TOKEN as DIRECTUS_TOKEN } from "@/integrations/directus/client";

interface MediaComposerProps {
  contactPhone: string;
  conversationId: string;
  onMessageSent?: () => void;
  /** Callback ao guardar uma nota privada (para refrescar o thread). */
  onNoteSaved?: () => void;
  /** Callback ao mudar o estado de typing (true = a escrever). */
  onTypingChange?: (typing: boolean) => void;
}

// Emojis mais usados em contexto empresarial.
const EMOJIS = [
  "😊", "👍", "👋", "🙏", "✅", "❌", "⚠️", "📞", "📧", "📄",
  "💰", "🔧", "🏨", "🍽️", "⭐", "🎉", "💬", "🔔", "📦", "🚚",
];

type PreviewKind = "image" | "video" | "audio" | "document";

export function MediaComposer({
  contactPhone,
  conversationId,
  onMessageSent,
  onNoteSaved,
  onTypingChange,
}: MediaComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ file: File; type: PreviewKind } | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isPrivateNote, setIsPrivateNote] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSendText = async () => {
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      await sendTextViaEvolution(contactPhone, text.trim());
      await createOutboundMessage(conversationId, text.trim(), "text");
      setText("");
      onMessageSent?.();
    } catch {
      setError("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type: PreviewKind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : "document";
    setPreview({ file, type });
    e.target.value = "";
  };

  const handleSendFile = async () => {
    if (!preview) return;
    setSending(true);
    setError("");
    const { file, type } = preview;
    try {
      if (type === "image" || type === "video") {
        const url = await uploadToDirectus(file);
        await sendImageViaEvolution(contactPhone, url, text.trim() || undefined, type === "video");
        await createOutboundMessage(conversationId, text.trim() || `[${type}]`, type, [
          { type, url, s3Url: url, mime_type: file.type, filename: file.name, base64: null },
        ]);
      } else if (type === "audio") {
        const url = await uploadToDirectus(file);
        await sendAudioViaEvolution(contactPhone, url);
        await createOutboundMessage(conversationId, "[áudio]", "audio", [
          { type: "audio", url, s3Url: url, mime_type: file.type, filename: file.name, base64: null },
        ]);
      } else {
        // Documento — base64 puro para a Evolution; URL no Directus para preview/registo.
        const b64 = await fileToBase64(file);
        await sendDocumentViaEvolution(contactPhone, b64, file.type, file.name);
        const docUrl = await uploadToDirectus(file);
        await createOutboundMessage(conversationId, `[${file.name}]`, "file", [
          { type: "file", url: docUrl, s3Url: docUrl, mime_type: file.type, filename: file.name, base64: null },
        ]);
      }
      setPreview(null);
      setText("");
      onMessageSent?.();
    } catch {
      setError("Erro ao enviar ficheiro");
    } finally {
      setSending(false);
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        stopStream();
        setRecording(false);
        void sendRecordedAudio(blob, mime);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Sem acesso ao microfone");
      stopStream();
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    chunksRef.current = [];
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    stopStream();
    setRecording(false);
    setSeconds(0);
  };

  const sendRecordedAudio = async (blob: Blob, mime: string) => {
    if (!blob.size) return;
    setSending(true);
    setError("");
    try {
      const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : "webm";
      const fileName = `voice_message.${ext}`;
      const file = new File([blob], fileName, { type: mime });
      const url = await uploadToDirectus(file);
      await sendAudioViaEvolution(contactPhone, url);
      await createOutboundMessage(conversationId, "[áudio]", "audio", [
        { type: "audio", url, s3Url: url, mime_type: mime, filename: fileName, base64: null },
      ]);
      onMessageSent?.();
    } catch {
      setError("Erro ao enviar áudio");
    } finally {
      setSending(false);
      setSeconds(0);
    }
  };

  const handleSavePrivateNote = async () => {
    if (!text.trim() || !conversationId) return;
    setSending(true);
    try {
      await fetch(`${DIRECTUS_URL}/items/conversation_notes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: text.trim(),
          type: "private",
          created_by: "crm",
          created_at: new Date().toISOString(),
        }),
      });
      setText("");
      setIsPrivateNote(false);
      onTypingChange?.(false);
      onNoteSaved?.();
      toast({ title: "Nota interna guardada 🔒" });
    } catch {
      toast({ title: "Erro ao guardar nota", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !preview && !isPrivateNote) {
      e.preventDefault();
      void handleSendText();
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const disabled = sending || (!text.trim() && !preview);

  // Modo de gravação: ocupa a barra com indicador + cancelar/enviar.
  if (recording) {
    return (
      <div className="shrink-0 border-t border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            A gravar… {mmss}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={cancelRecording}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white transition-colors hover:bg-amber-600"
            title="Parar e enviar"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "shrink-0 border-t border-border bg-card",
        isPrivateNote && "border-amber-200",
      )}
    >
      {/* Preview do ficheiro seleccionado */}
      {preview && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
          {preview.type === "image" ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          <span className="flex-1 truncate">{preview.file.name}</span>
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Erro */}
      {error && <p className="mx-3 mt-1 text-xs text-destructive">{error}</p>}

      {/* Picker de emojis */}
      {showEmojis && (
        <div className="mx-3 mt-2 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded p-1 text-lg transition-colors hover:bg-muted"
              onClick={() => {
                setText((t) => t + e);
                setShowEmojis(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border/50 px-3 pb-1 pt-2">
        <button
          type="button"
          title="Anexar ficheiro"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Emoji"
          onClick={() => setShowEmojis((s) => !s)}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
        >
          <Smile className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setIsPrivateNote((v) => !v)}
          title="Nota interna (não enviada ao cliente)"
          className={cn(
            "flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors",
            isPrivateNote
              ? "bg-amber-100 font-medium text-amber-800"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Lock className="h-3.5 w-3.5" />
          {isPrivateNote ? "Nota interna ON" : "Nota interna"}
        </button>
      </div>

      {/* Input file oculto */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFileSelect}
      />

      {/* Textarea principal */}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onTypingChange?.(e.target.value.length > 0);
        }}
        onBlur={() => onTypingChange?.(false)}
        onKeyDown={onKeyDown}
        placeholder={
          isPrivateNote
            ? "Nota interna — visível só para a equipa, não enviada ao cliente..."
            : preview
              ? "Legenda (opcional)..."
              : "Escreve uma mensagem..."
        }
        disabled={sending}
        className={cn(
          "w-full resize-y px-3 py-2 text-sm outline-none font-sans transition-colors disabled:opacity-60",
          "min-h-[80px] max-h-[200px]",
          isPrivateNote
            ? "bg-amber-50 dark:bg-amber-950/20 placeholder:text-amber-700/50"
            : "bg-background placeholder:text-muted-foreground",
        )}
        style={{ minHeight: 80, maxHeight: 200 }}
      />

      {/* Footer */}
      <div
        className={cn(
          "flex items-center justify-between px-3 pb-2 pt-1",
          isPrivateNote && "bg-amber-50 dark:bg-amber-950/20",
        )}
      >
        <span className="text-xs text-muted-foreground">
          {isPrivateNote
            ? "🔒 Nota interna — não será enviada"
            : "Enter para enviar · Shift+Enter nova linha"}
        </span>

        {/* Mic (quando sem texto/preview e não é nota) ou botão de acção */}
        {!isPrivateNote && !preview && !text.trim() ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={sending}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
            title="Gravar mensagem de voz"
          >
            <Mic className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={
              isPrivateNote
                ? handleSavePrivateNote
                : preview
                  ? handleSendFile
                  : handleSendText
            }
            disabled={!text.trim() && !preview}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40",
              isPrivateNote
                ? "bg-amber-600 text-white hover:bg-amber-500"
                : "bg-amber-500 text-white hover:bg-amber-600",
            )}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isPrivateNote ? "Guardar nota" : sending ? "A enviar…" : "Enviar"}
          </button>
        )}
      </div>
    </div>
  );
}

export default MediaComposer;
