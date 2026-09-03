/**
 * Card 16 — Follow-up Scheduler
 */

import { AIRouterService } from "@/services/ai/router";
import {
  FollowupSchedulerOutput,
  AgentRunResult,
} from "./types";
import { recordAgentRun } from "./runRecorder";
import { createFollowUp } from "@/integrations/directus/follow-ups";

export interface FollowupSchedulerInput {
  lead_id: string;
  lead_name: string;
  last_follow_up_days: number;
  context?: Record<string, unknown> | null;
}

const SYSTEM_PROMPT = `És um assistente de cadência comercial B2B em PT-PT.
Devolve APENAS JSON válido (sem markdown, sem comentários) com:
{
  "next_action": string  (verbo no infinitivo + alvo, máx 100 chars),
  "suggested_date": string  (data ISO YYYY-MM-DD, 2 a 5 dias após hoje),
  "priority": "low" | "normal" | "high" | "urgent",
  "channel": "call" | "email" | "whatsapp" | "task",
  "draft_message": string  (mensagem curta em PT-PT, máx 280 chars),
  "confidence": number 0-1
}
Quanto mais dias sem follow-up, maior deve ser a priority.`;

function buildPrompt(input: FollowupSchedulerInput): string {
  return `Lead sem follow-up há ${input.last_follow_up_days} dias.
- Nome: ${input.lead_name}
- Contexto: ${JSON.stringify(input.context || {})}

Devolve o JSON pedido.`;
}

function safeParse(raw: string): FollowupSchedulerOutput | null {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const json = fenced ? fenced[1] : raw;
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as FollowupSchedulerOutput;
  } catch {
    return null;
  }
}

function defaultSuggestedDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export async function scheduleFollowup(
  input: FollowupSchedulerInput
): Promise<AgentRunResult & { follow_up_id?: string | null }> {
  const router = new AIRouterService();
  const settings = await router.getSettings();
  const providerId =
    settings.default_provider_id ||
    (await router.listProviders()).find((p) => p.enabled)?.id ||
    "";

  const prompt = buildPrompt(input);

  const result = await router.complete(providerId, prompt, {
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 400,
    temperature: 0.4,
  });

  const parsed = safeParse(result.text);
  const output: FollowupSchedulerOutput = parsed
    ? { ...parsed, suggested_date: parsed.suggested_date || defaultSuggestedDate() }
    : {
        next_action: "Contactar por email",
        suggested_date: defaultSuggestedDate(),
        priority: input.last_follow_up_days > 14 ? "high" : "normal",
        channel: "email",
        draft_message: `Olá ${input.lead_name}, há quanto tempo! Posso ajudar com algo?`,
      };

  const confidence = parsed?.confidence ?? 0.6;

  const draft = await createFollowUp({
    title: output.next_action,
    notes: output.draft_message,
    status: "draft",
    type: output.channel,
    due_at: `${output.suggested_date}T09:00:00.000Z`,
    contact_id: null,
  } as any).catch((err) => {
    console.warn("[ai-agent] rascunho de follow-up falhou", err);
    return null;
  });

  const recorded = await recordAgentRun({
    agent_type: "followup_scheduler",
    input_payload: input as unknown as Record<string, unknown>,
    output_payload: { ...output, awaiting_human: true },
    status: "awaiting_human",
    confidence_score: confidence,
    provider: result.providerId ?? providerId,
    model: result.model ?? null,
    tokens_used: result.tokens,
    latency_ms: result.latency,
    lead_id: input.lead_id,
    follow_up_id: draft?.id ?? null,
  });

  return {
    run: recorded.run ?? ({} as AgentRunResult["run"]),
    output,
    follow_up_id: draft?.id ?? null,
  };
}