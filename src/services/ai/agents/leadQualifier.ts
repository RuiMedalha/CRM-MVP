/**
 * Card 16 — Lead Qualifier
 */

import { AIRouterService } from "@/services/ai/router";
import {
  LeadQualifierOutput,
  AgentRunResult,
} from "./types";
import { recordAgentRun } from "./runRecorder";

export interface LeadQualifierInput {
  lead_id?: string | null;
  name: string;
  email?: string | null;
  source?: string | null;
  context?: Record<string, unknown> | null;
}

const SYSTEM_PROMPT = `És um analista de qualificação de leads B2B para um CRM.
Devolve APENAS JSON válido (sem markdown, sem comentários) com os campos:
{
  "qualification_score": number 0-100,
  "suggested_stage": string  (ex: "novo", "qualificado", "proposta", "negociacao"),
  "suggested_pipeline_id": string|null,
  "suggested_assignee_id": string|null,
  "key_signals": string[]  (3 a 6 sinais curtos que justificam o score),
  "recommended_action": string  (próxima ação concreta, máx 140 chars),
  "confidence": number 0-1
}
Não inventes IDs — se não houver evidência suficiente, devolve null para
suggested_pipeline_id e suggested_assignee_id e baixa a confidence.`;

function buildPrompt(input: LeadQualifierInput): string {
  return `Qualifica este lead:
- Nome: ${input.name}
- Email: ${input.email || "(sem)"}
- Origem: ${input.source || "(desconhecida)"}
- Contexto adicional: ${JSON.stringify(input.context || {})}

Devolve o JSON pedido no system prompt.`;
}

function safeParse(raw: string): LeadQualifierOutput | null {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const json = fenced ? fenced[1] : raw;
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as LeadQualifierOutput;
  } catch {
    return null;
  }
}

export async function qualifyLead(
  input: LeadQualifierInput
): Promise<AgentRunResult> {
  const router = new AIRouterService();
  const settings = await router.getSettings();
  const providerId =
    settings.default_provider_id ||
    (await router.listProviders()).find((p) => p.enabled)?.id ||
    "";

  const prompt = buildPrompt(input);

  const result = await router.complete(providerId, prompt, {
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 600,
    temperature: 0.2,
  });

  const parsed = safeParse(result.text);
  const confidence =
    parsed?.confidence ?? Math.min(1, result.tokens > 0 ? 0.5 : 0.3);

  const output: LeadQualifierOutput = parsed || {
    qualification_score: 50,
    suggested_stage: "novo",
    suggested_pipeline_id: null,
    suggested_assignee_id: null,
    key_signals: ["fallback: output IA inválido"],
    recommended_action: "Rever manualmente o lead.",
    confidence,
  };

  const status = output.confidence >= 0.7 ? "completed" : "awaiting_human";

  const recorded = await recordAgentRun({
    agent_type: "lead_qualifier",
    input_payload: input as unknown as Record<string, unknown>,
    output_payload: output,
    status,
    confidence_score: output.confidence,
    provider: result.providerId ?? providerId,
    model: result.model ?? null,
    tokens_used: result.tokens,
    latency_ms: result.latency,
    lead_id: input.lead_id ?? null,
  });

  return { run: recorded.run ?? ({} as AgentRunResult["run"]), output };
}