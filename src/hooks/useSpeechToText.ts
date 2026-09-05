/**
 * useSpeechToText — Hook de Reconhecimento e Ditado por Voz para o CRM Hotelequip.
 *
 * Utiliza a Web Speech API nativa (SpeechRecognition / webkitSpeechRecognition)
 * com suporte nativo a português (pt-PT / pt-BR).
 * Permite transcrição contínua em tempo real para registo de chamadas e notas.
 */

import { useState, useEffect, useRef, useCallback } from "react";

// Tipos para compatibilidade com Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscriptChange?: (text: string) => void;
  onFinalTranscript?: (finalText: string) => void;
}

export interface UseSpeechToTextReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const {
    lang = "pt-PT",
    continuous = true,
    interimResults = true,
    onTranscriptChange,
    onFinalTranscript,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onTranscriptChange, onFinalTranscript]);

  const win = typeof window !== "undefined" ? (window as unknown as IWindow) : null;
  const isSupported = !!(win && (win.SpeechRecognition || win.webkitSpeechRecognition));

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("O seu navegador não suporta reconhecimento de voz direto. Experimente o Chrome, Edge ou Safari.");
      return;
    }

    try {
      setError(null);
      shouldListenRef.current = true;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }

      const SpeechRecognitionConstructor = win?.SpeechRecognition || win?.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionConstructor();
      recognitionRef.current = recognition;

      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        let newFinalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcriptChunk = result[0]?.transcript || "";

          if (result.isFinal) {
            newFinalChunk += transcriptChunk;
          } else {
            currentInterim += transcriptChunk;
          }
        }

        setInterimTranscript(currentInterim);

        if (newFinalChunk) {
          setTranscript((prev) => {
            const separator = prev.length && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
            const updated = prev + separator + newFinalChunk.trim();
            onTranscriptChangeRef.current?.(updated);
            onFinalTranscriptRef.current?.(newFinalChunk.trim());
            return updated;
          });
          setInterimTranscript("");
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") {
          return;
        }
        if (event.error === "aborted") {
          return;
        }

        let errMsg = `Erro de microfone (${event.error})`;
        if (event.error === "not-allowed") {
          errMsg = "Permissão de microfone negada. Ative o microfone nas permissões do navegador.";
        } else if (event.error === "network") {
          errMsg = "Erro de rede no serviço de voz.";
        }

        setError(errMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        if (shouldListenRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            // falha ao reiniciar
          }
        }
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      setError(err?.message || "Erro ao iniciar o reconhecimento de voz.");
      setIsListening(false);
    }
  }, [isSupported, win, continuous, interimResults, lang]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    setInterimTranscript("");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    onTranscriptChangeRef.current?.("");
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // cleanup
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}
