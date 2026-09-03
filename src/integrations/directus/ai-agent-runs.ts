/**
 * Card 16 — CRUD sobre a collection `ai_agent_runs`.
 */

import { directusRequest } from "./client";
import { qs } from "./utils";
import {
  AiAgentRunRow,
  AgentRunCreate,
  AgentRunStatus,
  AgentType,
} from "@/services/ai/agents/types";

export const DIRECTUS_AI_AGENT_RUNS_COLLECTION =
  import.meta.env.VITE_DIRECTUS_AI_AGENT_RUNS_COLLECTION || "ai_agent_runs";

const AGENT_RUN_FIELDS = [
  "id",
  "agent_type",
  "input_payload",
  "output_payload",
  "status",
  "confidence_score",
  "human_reviewed_by",
  "human_approved",
  "human_reject_reason",
  "provider",
  "model",
  "tokens_used",
  "latency_ms",
  "error",
  "lead_id",
  "deal_id",
  "follow_up_id",
  "date_created",
  "date_updated",
].join(",");

export async function createAiAgentRun(
  payload: AgentRunCreate
): Promise<AiAgentRunRow | null> {
  try {
    const body: Record<string, unknown> = {
      agent_type: payload.agent_type,
      input_payload: payload.input_payload,
      status: payload.status ?? "pending",
      lead_id: payload.lead_id ?? null,
      deal_id: payload.deal_id ?? null,
      follow_up_id: payload.follow_up_id ?? null,
    };
    const res = await directusRequest<{ data: AiAgentRunRow }>(
      `/items/${DIRECTUS_AI_AGENT_RUNS_COLLECTION}`,
      { method: "POST", body: JSON.stringify(body) }
    );
    return res.data ?? null;
  } catch (err) {
    console.warn("[ai-agent-runs] create falhou", err);
    return null;
  }
}

export async function updateAiAgentRun(
  id: string | number,
  patch: Partial<AiAgentRunRow>
): Promise<AiAgentRunRow | null> {
  try {
    const res = await directusRequest<{ data: AiAgentRunRow }>(
      `/items/${DIRECTUS_AI_AGENT_RUNS_COLLECTION}/${id}`,
      { method: "PATCH", body: JSON.stringify(patch) }
    );
    return res.data ?? null;
  } catch (err) {
    console.warn("[ai-agent-runs] update falhou", err);
    return null;
  }
}

export async function getAiAgentRun(
  id: string | number
): Promise<AiAgentRunRow | null> {
  try {
    const res = await directusRequest<{ data: AiAgentRunRow }>(
      `/items/${DIRECTUS_AI_AGENT_RUNS_COLLECTION}/${id}?fields=${AGENT_RUN_FIELDS}`
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function listAiAgentRuns(params?: {
  status?: AgentRunStatus;
  agentType?: AgentType;
  leadId?: string;
  dealId?: string;
  limit?: number;
  page?: number;
}): Promise<AiAgentRunRow[]> {
  const q: Record<string, unknown> = {
    fields: AGENT_RUN_FIELDS,
    sort: "-date_created",
    limit: params?.limit ?? 50,
    page: params?.page ?? 1,
  };
  if (params?.status) q["filter[status][_eq]"] = params.status;
  if (params?.agentType) q["filter[agent_type][_eq]"] = params.agentType;
  if (params?.leadId) q["filter[lead_id][_eq]"] = params.leadId;
  if (params?.dealId) q["filter[deal_id][_eq]"] = params.dealId;

  try {
    const res = await directusRequest<{ data: AiAgentRunRow[] }>(
      `/items/${DIRECTUS_AI_AGENT_RUNS_COLLECTION}${qs(q as Record<string, string>)}`
    );
    return res.data || [];
  } catch (err) {
    console.warn("[ai-agent-runs] list falhou", err);
    return [];
  }
}

export async function listAwaitingHumanAiAgentRuns(
  limit = 100
): Promise<AiAgentRunRow[]> {
  return listAiAgentRuns({ status: "awaiting_human", limit });
}