/**
 * Card 16 — Email Drafter
 *
 * Por política, SEMPRE marca o run como `awaiting_human` — o email só sai
 * após aprovação humana explícita na UI.
 */

import { AIRouterService } from "@/services/ai/router";
import {
  EmailDrafterOutput,
  AgentRunResult,
} from "./types";
import { recordAgentRun } from "./runRecorder";

export interface EmailDrafterInput {
  lead_id?: string | null;
  deal_id?: string | null;
  lead_name: string;
  deal_title?: string | null;
  stage?: string | null;
  recent_messages?: string[] | null;
  context?: Record<string, unknown> | null;
}

const SYSTEM_PROMPT = `És um redator comercial B2B para um CRM em PT-PT.
Devolve APENAS JSON válido (sem markdown, sem comentários) com:
{
  "subject": string  (assunto do email, máx 80 chars, personalizado),
  "body": string     (corpo em PT-PT, 3 a 6 parágrafos curtos, tom profissional mas próximo),
  "call_to_action": string  (CTA concreto e claro),
  "followup_date": string  (data ISO YYYY-MM-DD, 3 a 7 dias após hoje),
  "confidence": number 0-1
}
Personaliza sempre com o nome do lead e o contexto do deal.`;

function buildPrompt(input: EmailDrafterInput): string {
  return `Redige um email de follow-up:
- Lead: ${input.lead_name}
- Deal: ${input.deal_title || "(sem deal)"}
- Estágio: ${input.stage || "(novo)"}
- Mensagens recentes: ${JSON.stringify(input.recent_messages || [])}
- Contexto adicional: ${JSON.stringify(input.context || {})}

Devolve o JSON pedido.`;
}

function safeParse(raw: string): EmailDrafterOutput | null {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const json = fenced ? fenced[1] : raw;
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as EmailDrafterOutput;
  } catch {
    return null;
  }
}

function defaultFollowupDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toISOString().slice(0, 10);
}

export async function draftEmail(
  input: EmailDrafterInput
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
    maxTokens: 800,
    temperature: 0.6,
  });

  const parsed = safeParse(result.text);
  const output: EmailDrafterOutput = parsed
    ? { ...parsed, followup_date: parsed.followup_date || defaultFollowupDate() }
    : {
        subject: `Olá ${input.lead_name}, um rápido follow-up`,
        body:
          `Olá ${input.lead_name},\n\n` +
          `Queria apenas confirmar se recebeu a nossa última proposta e ` +
          `se há dúvidas que eu possa esclarecer.\n\n` +
          `Obrigado,\nEquipa Comercial`,
        call_to_action: "Posso agendar 15 min esta semana?",
        followup_date: defaultFollowupDate(),
      };

  const confidence = parsed?.confidence ?? 0.55;

  const recorded = await recordAgentRun({
    agent_type: "email_drafter",
    input_payload: input as unknown as Record<string, unknown>,
    output_payload: output,
    status: "awaiting_human",
    confidence_score: confidence,
    provider: result.providerId ?? providerId,
    model: result.model ?? null,
    tokens_used: result.tokens,
    latency_ms: result.latency,
    lead_id: input.lead_id ?? null,
    deal_id: input.deal_id ?? null,
  });

  return { run: recorded.run ?? ({} as AgentRunResult["run"]), output };
}