/**
 * AI Call Runs — camada de acesso ao Directus.
 * Collection: ai_call_runs (schema nova)
 */

import { directusRequest } from "./client";

export const AI_CALL_RUNS_COLLECTION = "ai_call_runs";

export interface AiCallRun {
  id: number;
  status: "pending" | "processing" | "done" | "failed";
  call_id?: number | null;
  provider?: "openai_whisper" | "deepgram" | "claude" | "openai_gpt" | null;
  model?: string | null;
  transcript?: string | null;
  summary?: string | null;
  sentiment?: "positive" | "neutral" | "negative" | "unknown" | null;
  next_action?: string | null;
  key_topics?: string[] | null;
  tokens_used?: number | null;
  cost_estimate?: number | null;
  latency_ms?: number | null;
  raw_response?: Record<string, unknown> | null;
  error_message?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
}

export type CreateAiCallRunInput = Partial<Omit<AiCallRun, "id" | "date_created" | "date_updated">>;

export async function createAiCallRun(
  payload: CreateAiCallRunInput,
): Promise<AiCallRun | null> {
  try {
    const body: Record<string, unknown> = {
      status: payload.status || "pending",
      call_id: payload.call_id ?? null,
      provider: payload.provider || null,
      model: payload.model || null,
      transcript: payload.transcript || null,
      summary: payload.summary || null,
      sentiment: payload.sentiment || "unknown",
      next_action: payload.next_action || null,
      key_topics: payload.key_topics ? JSON.stringify(payload.key_topics) : null,
      tokens_used: payload.tokens_used ?? 0,
      cost_estimate: payload.cost_estimate ?? 0,
      latency_ms: payload.latency_ms ?? null,
      raw_response: payload.raw_response ? JSON.stringify(payload.raw_response) : null,
      error_message: payload.error_message || null,
    };

    const res = await directusRequest<{ data: AiCallRun }>(
      `/items/${AI_CALL_RUNS_COLLECTION}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    return res.data ?? null;
  } catch (err) {
    console.warn("[ai-call-runs] falhou ao gravar", err);
    return null;
  }
}

export async function updateAiCallRun(
  id: number,
  payload: Partial<CreateAiCallRunInput>,
): Promise<AiCallRun | null> {
  try {
    const res = await directusRequest<{ data: AiCallRun }>(
      `/items/${AI_CALL_RUNS_COLLECTION}/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return res.data ?? null;
  } catch (err) {
    console.warn("[ai-call-runs] falhou ao actualizar", err);
    return null;
  }
}

export async function getAiCallRunsByCall(callId: number | string): Promise<AiCallRun[]> {
  try {
    const res = await directusRequest<{ data: AiCallRun[] }>(
      `/items/${AI_CALL_RUNS_COLLECTION}?filter[call_id][_eq]=${callId}&sort=-date_created&limit=5`,
    );
    return res?.data ?? [];
  } catch {
    return [];
  }
}

export async function listAiCallRuns(params?: {
  limit?: number;
  page?: number;
  sentiment?: string;
  status?: string;
}): Promise<AiCallRun[]> {
  try {
    const q: Record<string, string> = {
      limit: String(params?.limit ?? 50),
      page: String(params?.page ?? 1),
      sort: "-date_created",
      fields: "id,call_id,provider,model,summary,sentiment,next_action,tokens_used,cost_estimate,latency_ms,status,date_created,date_updated",
    };
    if (params?.sentiment) q["filter[sentiment][_eq]"] = params.sentiment;
    if (params?.status) q["filter[status][_eq]"] = params.status;
    const search = new URLSearchParams(q).toString();
    const res = await directusRequest<{ data: AiCallRun[] }>(
      `/items/${AI_CALL_RUNS_COLLECTION}?${search}`,
    );
    return res?.data ?? [];
  } catch {
    return [];
  }
}
