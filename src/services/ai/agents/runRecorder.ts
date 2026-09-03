/**
 * Card 16 — helper partilhado que regista cada invocação de agente em
 * `ai_agent_runs` e escreve um activity ledger com source="ai".
 */

import {
  AiAgentRunRow,
  AgentOutput,
  AgentRunCreate,
  AgentRunStatus,
  AgentType,
  CONFIDENCE_THRESHOLD,
} from "./types";
import {
  createAiAgentRun,
  updateAiAgentRun,
} from "@/integrations/directus/ai-agent-runs";
import { createActivity } from "@/integrations/directus/activities";

export interface RecordArgs {
  agent_type: AgentType;
  input_payload: Record<string, unknown>;
  output_payload?: AgentOutput | null;
  status: AgentRunStatus;
  confidence_score?: number | null;
  provider?: string | null;
  model?: string | null;
  tokens_used?: number | null;
  latency_ms?: number | null;
  error?: string | null;
  lead_id?: string | null;
  deal_id?: string | null;
  follow_up_id?: string | null;
}

export interface RecordResult {
  run: AiAgentRunRow | null;
  awaitingHuman: boolean;
}

function deriveStatusFromConfidence(
  proposed: AgentRunStatus,
  confidence?: number | null
): AgentRunStatus {
  if (
    proposed === "completed" &&
    typeof confidence === "number" &&
    confidence < CONFIDENCE_THRESHOLD
  ) {
    return "awaiting_human";
  }
  return proposed;
}

export async function recordAgentRun(args: RecordArgs): Promise<RecordResult> {
  const initial: AgentRunCreate = {
    agent_type: args.agent_type,
    input_payload: args.input_payload,
    status: "running",
    lead_id: args.lead_id ?? null,
    deal_id: args.deal_id ?? null,
    follow_up_id: args.follow_up_id ?? null,
  };

  const created = await createAiAgentRun(initial);
  if (!created?.id) {
    return { run: null, awaitingHuman: args.status === "awaiting_human" };
  }

  const finalStatus = deriveStatusFromConfidence(
    args.status,
    args.confidence_score ?? null
  );

  const patch: Partial<AiAgentRunRow> = {
    output_payload: args.output_payload ?? null,
    status: finalStatus,
    confidence_score: args.confidence_score ?? null,
    provider: args.provider ?? null,
    model: args.model ?? null,
    tokens_used: args.tokens_used ?? null,
    latency_ms: args.latency_ms ?? null,
    error: args.error ?? null,
  };

  const updated = await updateAiAgentRun(created.id, patch);

  await createActivity({
    type: "note",
    channel: "crm",
    status: finalStatus,
    direction: null,
    summary: `[ai:${args.agent_type}] ${finalStatus}${
      typeof args.confidence_score === "number"
        ? ` (conf=${args.confidence_score.toFixed(2)})`
        : ""
    }`,
    occurred_at: new Date().toISOString(),
    lead_id: args.lead_id ?? null,
    deal_id: args.deal_id ?? null,
    source_collection: "ai_agent_runs",
    source_id: String(created.id),
    payload: {
      agent_type: args.agent_type,
      confidence: args.confidence_score ?? null,
      tokens_used: args.tokens_used ?? null,
      latency_ms: args.latency_ms ?? null,
      error: args.error ?? null,
    },
  });

  return {
    run: updated ?? created,
    awaitingHuman: finalStatus === "awaiting_human",
  };
}