/**
 * Voice Transcription Service
 * Transcreve audio de chamadas Telecof via OpenAI Whisper (default) ou Deepgram (fallback).
 */

import { aiRouter } from "../ai/router";
import { AICompletionResult } from "../ai/types";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  transcript: string;
  provider: "openai_whisper" | "deepgram";
  model: string;
  tokens?: number;
  latencyMs: number;
  costEstimate: number;
  raw?: unknown;
}

// ─── Custo por minuto (aproximado) ─────────────────────────────────────────
// Whisper: $0.006 / minuto (modelo whisper-1)
// Deepgram: $0.0059 / minuto (nova-2), $0.0043 / minuto (nova-2-med)
const WHISPER_COST_PER_MIN = 0.006;
const DEEPGRAM_COST_PER_MIN = 0.0059;
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

function estimateCost(durationSeconds: number, provider: string): number {
  const minutes = durationSeconds / 60;
  const rate = provider === "deepgram" ? DEEPGRAM_COST_PER_MIN : WHISPER_COST_PER_MIN;
  return parseFloat((minutes * rate).toFixed(6));
}

// ─── Download helper ───────────────────────────────────────────────────────

async function downloadAudio(audioUrl: string): Promise<Blob> {
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Falha ao descarregar audio (HTTP ${res.status})`);
  return await res.blob();
}

// ─── Whisper ───────────────────────────────────────────────────────────────

async function transcribeWhisper(
  audioBlob: Blob,
  apiKey: string,
  model: string = "whisper-1",
): Promise<{ transcript: string; raw: unknown }> {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.wav");
  formData.append("model", model);
  formData.append("language", "pt");
  formData.append("response_format", "json");

  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Whisper API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { transcript: (data.text || "").trim(), raw: data };
}

// ─── Deepgram ──────────────────────────────────────────────────────────────

async function transcribeDeepgram(
  audioBlob: Blob,
  apiKey: string,
  model: string = "nova-2",
): Promise<{ transcript: string; raw: unknown }> {
  const url = `https://api.deepgram.com/v1/listen?model=${model}&language=pt&smart_format=true&punctuate=true`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": audioBlob.type || "audio/wav",
    },
    body: audioBlob,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Deepgram API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const transcript =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  return { transcript: transcript.trim(), raw: data };
}

// ─── Função principal ─────────────────────────────────────────────────────

export async function transcribeCall(
  audioUrl: string,
  durationSeconds: number,
  preferredProvider: "openai_whisper" | "deepgram" = "openai_whisper",
): Promise<TranscriptionResult> {
  const startTime = performance.now();

  // Tenta Whisper primeiro (default), fallback para Deepgram
  const providers = preferredProvider === "deepgram"
    ? ["deepgram", "openai_whisper"] as const
    : ["openai_whisper", "deepgram"] as const;

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const audioBlob = await downloadAudio(audioUrl);

      if (provider === "openai_whisper") {
        // Busca a API key do router (provider OpenAI)
        const openaiProvider = await aiRouter.getProvider("openai");
        if (!openaiProvider || !openaiProvider.meta.api_key) {
          throw new Error("OpenAI provider nao configurado ou sem API key");
        }

        // Tenta obter whisper key do setting, ou usa a mesma da OpenAI
        const whisperKey = openaiProvider.meta.api_key;

        const result = await transcribeWhisper(audioBlob, whisperKey);
        const latencyMs = Math.round(performance.now() - startTime);

        return {
          transcript: result.transcript,
          provider: "openai_whisper",
          model: "whisper-1",
          latencyMs,
          costEstimate: estimateCost(durationSeconds, "openai_whisper"),
          raw: result.raw,
        };
      }

      if (provider === "deepgram") {
        // Deepgram precisa de API key configurada à parte (env ou settings)
        const deepgramKey =
          (typeof import.meta !== "undefined"
            ? import.meta.env.VITE_DEEPGRAM_API_KEY
            : process.env.VITE_DEEPGRAM_API_KEY) || "";

        if (!deepgramKey) throw new Error("Deepgram API key nao configurada");

        const result = await transcribeDeepgram(audioBlob, deepgramKey);
        const latencyMs = Math.round(performance.now() - startTime);

        return {
          transcript: result.transcript,
          provider: "deepgram",
          model: "nova-2",
          latencyMs,
          costEstimate: estimateCost(durationSeconds, "deepgram"),
          raw: result.raw,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[voice:transcribe] ${provider} falhou:`, lastError.message);
    }
  }

  throw lastError || new Error("Todos os provedores de transcricao falharam");
}
