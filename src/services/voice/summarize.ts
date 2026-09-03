/**
 * Voice Summarize Service
 * Gera resumo executivo, sentiment, next action e key topics de uma transcricao
 * usando o AI Router (Claude/GPT via providers configurados).
 */

import { aiRouter } from "../ai/router";
import { AICompletionResult } from "../ai/types";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface CallSummary {
  summary: string;           // 2-3 frases executivas
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  nextAction: string | null; // accao sugerida (ex: "Follow-up em 3 dias")
  keyTopics: string[];       // topicos principais
}

// ─── Prompt system ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es um analista de CRM especializado em chamadas de suporte comercial e assistencia tecnica.
Analisa a transcricao da chamada e produz:

1. **Resumo executivo** (2-3 frases): o problema, o que foi resolvido, accao do agente.
2. **Sentiment** (positive/neutral/negative): tom geral do cliente no final da chamada.
3. **Next action**: qual o passo seguinte mais provavel (ex: "Follow-up em 3 dias", "Enviar proposta X", "Agendar visita tecnica", "Resolvido sem accao", "Reabrir chamado"). Se nao houver accao, null.
4. **Key topics**: lista JSON de topicos-chave (max 5).

Responde APENAS com JSON no formato:
{
  "summary": "...",
  "sentiment": "positive|neutral|negative|unknown",
  "next_action": "..." | null,
  "key_topics": ["...", "..."]
}`;

function parseSummaryJson(text: string): CallSummary {
  try {
    // Extrai JSON do texto (pode vir com ```json ... ```)
    let json = text.trim();
    const jsonMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) json = jsonMatch[1].trim();

    const parsed = JSON.parse(json);

    const sentiment = ["positive", "neutral", "negative", "unknown"].includes(
      parsed.sentiment,
    )
      ? parsed.sentiment
      : "unknown";

    return {
      summary: parsed.summary || "",
      sentiment,
      nextAction: parsed.next_action || null,
      keyTopics: Array.isArray(parsed.key_topics) ? parsed.key_topics : [],
    };
  } catch {
    // Fallback: devolve texto cru como summary
    return {
      summary: text.slice(0, 500),
      sentiment: "unknown",
      nextAction: null,
      keyTopics: [],
    };
  }
}

// ─── Funcao principal ─────────────────────────────────────────────────────

export async function summarizeCall(
  transcript: string,
  preferredProviderId?: string,
): Promise<CallSummary> {
  const prompt = `Analisa a seguinte transcricao de chamada e produz o resumo, sentiment, next action e key topics:\n\n${transcript}`;

  const result: AICompletionResult = await aiRouter.completeWithFallback(
    prompt,
    {
      system: SYSTEM_PROMPT,
      maxTokens: 1024,
      temperature: 0.3,
    },
    preferredProviderId,
  );

  return parseSummaryJson(result.text);
}
