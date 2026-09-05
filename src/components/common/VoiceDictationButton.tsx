/**
 * VoiceDictationButton — Botão de ditado por voz para registo rápido de notas e chamadas.
 *
 * Exibe estado de gravação em tempo real (anel pulsante vermelho, animação de ondas sonoras)
 * e insere o texto transcrito diretamente no campo pretendido.
 */

import React from "react";
import { Mic, MicOff, Radio, AlertCircle } from "lucide-react";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VoiceDictationButtonProps {
  onTranscriptChunk?: (chunk: string) => void;
  onFullTranscript?: (fullText: string) => void;
  lang?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  showLabel?: boolean;
  disabled?: boolean;
}

export function VoiceDictationButton({
  onTranscriptChunk,
  onFullTranscript,
  lang = "pt-PT",
  size = "sm",
  variant = "outline",
  className,
  showLabel = true,
  disabled = false,
}: VoiceDictationButtonProps) {
  const {
    isListening,
    isSupported,
    interimTranscript,
    error,
    toggleListening,
  } = useSpeechToText({
    lang,
    continuous: true,
    interimResults: true,
    onTranscriptChange: onFullTranscript,
    onFinalTranscript: (chunk) => {
      onTranscriptChunk?.(chunk);
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) {
      toast({
        title: "Reconhecimento de voz não suportado",
        description: "Utilize o Google Chrome, Microsoft Edge ou Safari para utilizar o ditado por voz.",
        variant: "destructive",
      });
      return;
    }

    if (error) {
      toast({
        title: "Microfone",
        description: error,
        variant: "destructive",
      });
    }

    toggleListening();
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        size={size}
        variant={isListening ? "destructive" : variant}
        onClick={handleClick}
        disabled={disabled}
        title={
          isListening
            ? "Parar ditado por voz"
            : "Iniciar ditado por voz em português (pt-PT)"
        }
        className={cn(
          "relative transition-all duration-200",
          isListening && "animate-pulse bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20",
          className,
        )}
      >
        {isListening ? (
          <>
            <Radio className="h-3.5 w-3.5 animate-spin text-white mr-1" />
            <span className="relative flex h-2 w-2 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            {showLabel && <span className="font-semibold text-xs">A Gravar…</span>}
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 mr-1 text-primary" />
            {showLabel && <span className="text-xs font-medium">Ditado por Voz</span>}
          </>
        )}
      </Button>

      {isListening && interimTranscript && (
        <span className="inline-block max-w-[200px] truncate text-[11px] italic text-muted-foreground animate-pulse px-2 py-0.5 bg-muted rounded border border-border">
          "{interimTranscript}"
        </span>
      )}
    </div>
  );
}
