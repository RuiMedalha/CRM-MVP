/**
 * Voice AI Pipeline
 * Orquestra o fluxo completo: receber webhook -> download audio -> transcrever -> sumarizar -> persistir.
 */

import { transcribeCall } from "./transcribe";
import { summarizeCall, CallSummary } from "./summarize";
import { createAiCallRun, updateAiCallRun } from "../../integrations/directus/ai-call-runs";
import { createActivity } from "../../integrations/directus/activities";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface TelecofCallEndedPayload {
  call_id: number | string;
  contact_id?: string | number;
  audio_url?: string;
  duration_seconds?: number;
  phone?: string;
  direction?: "inbound" | "outbound";
  start_time?: string;
  end_time?: string;
  agent_name?: string;
}

export interface PipelineResult {
  aiRunId: number | null;
  transcript: string;
  summary: CallSummary;
  durationMs: number;
}

// ─── Pipeline principal ────────────────────────────────────────────────────

export async function runVoicePipeline(
  payload: TelecofCallEndedPayload,
): Promise<PipelineResult> {
  const pipelineStart = performance.now();

  // 1. Validacao
  if (!payload.call_id) throw new Error("call_id é obrigatório");
  if (!payload.audio_url) throw new Error("audio_url é obrigatório");

  // 2. Criar registro pending
  const run = await createAiCallRun({
    call_id: typeof payload.call_id === "string" ? parseInt(payload.call_id, 10) || null : payload.call_id,
    status: "processing",
    provider: "openai_whisper",
  });

  const runId = run?.id ?? null;

  try {
    // 3. Transcricao
    const durationSec = payload.duration_seconds ?? 60;
    const transcription = await transcribeCall(
      payload.audio_url,
      durationSec,
    );

    // 4. Summarize
    const summary = await summarizeCall(transcription.transcript);

    // 5. Persistir resultado
    const costTotal =
      transcription.costEstimate +
      (summary.keyTopics.length > 0 ? 0.002 : 0); // estimativa custo LLM

    if (runId) {
      await updateAiCallRun(runId, {
        status: "done",
        transcript: transcription.transcript,
        summary: summary.summary,
        sentiment: summary.sentiment,
        next_action: summary.nextAction,
        key_topics: summary.keyTopics,
        tokens_used: transcription.tokens ?? 0,
        cost_estimate: costTotal,
        latency_ms: transcription.latencyMs,
        provider: transcription.provider,
        model: transcription.model,
        raw_response: transcription.raw ? transcription.raw as Record<string, unknown> : null,
      });
    }

    // 6. Activity ledger (best-effort)
    await createActivity({
      type: "call",
      channel: "telecof",
      direction: payload.direction === "inbound" ? "in" : "out",
      status: "ai_analyzed",
      summary: `[Voice AI] ${summary.summary}`,
      occurred_at: new Date().toISOString(),
      contact_id: payload.contact_id ?? null,
      source_collection: "ai_call_runs",
      source_id: String(runId),
      payload: {
        call_id: payload.call_id,
        sentiment: summary.sentiment,
        next_action: summary.nextAction,
        key_topics: summary.keyTopics,
        duration_seconds: durationSec,
      },
    }).catch(() => {});

    const durationMs = Math.round(performance.now() - pipelineStart);

    return {
      aiRunId: runId,
      transcript: transcription.transcript,
      summary,
      durationMs,
    };
  } catch (err) {
    // Registar falha
    const errMsg = err instanceof Error ? err.message : String(err);
    if (runId) {
      await updateAiCallRun(runId, {
        status: "failed",
        error_message: errMsg,
      });
    }
    throw err;
  }
}

// ─── Mock para testes ──────────────────────────────────────────────────────

export async function mockPipelineRun(
  callId: number | string,
  contactId?: string | number,
): Promise<PipelineResult> {
  // Simula transcricao e analise para testes sem API real
  const mockTranscript =
    "Bom dia, estou a ligar porque o meu equipamento AVAC nao esta a funcionar. " +
    "Ja tentei reiniciar mas continua com erro E5. Preciso de assistencia urgente.";

  const summary: CallSummary = {
    summary:
      "Cliente reporta avaria em equipamento AVAC com erro E5 apos reinicio. " +
      "Solicita assistencia urgente. Agente registou pedido e agendou visita tecnica.",
    sentiment: "negative",
    nextAction: "Agendar visita tecnica urgente",
    keyTopics: ["AVAC", "Erro E5", "Assistencia urgente"],
  };

  const run = await createAiCallRun({
    call_id: typeof callId === "string" ? parseInt(callId, 10) || null : callId,
    status: "done",
    provider: "openai_whisper",
    model: "whisper-1",
    transcript: mockTranscript,
    summary: summary.summary,
    sentiment: summary.sentiment,
    next_action: summary.nextAction,
    key_topics: summary.keyTopics,
    tokens_used: 150,
    cost_estimate: 0.008,
    latency_ms: 3200,
  });

  const runId = run?.id ?? null;

  await createActivity({
    type: "call",
    channel: "telecof",
    direction: "in",
    status: "ai_analyzed",
    summary: `[Voice AI Mock] ${summary.summary}`,
    occurred_at: new Date().toISOString(),
    contact_id: contactId ?? null,
    source_collection: "ai_call_runs",
    source_id: String(runId),
    payload: { call_id: callId, sentiment: summary.sentiment, next_action: summary.nextAction },
  }).catch(() => {});

  return {
    aiRunId: runId,
    transcript: mockTranscript,
    summary,
    durationMs: 3500,
  };
}
