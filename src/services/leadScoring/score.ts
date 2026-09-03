/**
 * Lead Scoring — Top-of-Funnel (Card 7)
 *
 * Modelo determinístico v1. Dado um lead (e métricas opcionais de engagement),
 * devolve um inteiro 0..100 + breakdown dos factores.
 *
 * Pesos v1:
 *   +25 phone presente
 *   +15 email presente
 *   +10 NIF presente
 *   +20 whatsapp_replies (count de respostas do lead)
 *   +15 email_opens (count de aberturas)
 *   +10 status = qualified
 *
 * Penalizações:
 *   -5  por cada dia sem follow-up APÓS 7 dias desde last_attempt_at (ou created)
 *   -50 se status = discarded OU spam
 *
 * Clamp final a [0, 100].
 */

export const SCORE_MODEL_VERSION = "v1";

/** Pesos default v1 — usados tanto pelo hook Directus como pela UI de ScoringRules. */
export const DEFAULT_WEIGHTS_V1 = {
  has_phone: 25,
  has_email: 15,
  has_nif: 10,
  whatsapp_replies: 20,
  email_opens: 15,
  status_qualified: 10,
  decay_per_day_after_7d: -5,
  penalty_discarded_or_spam: -50,
} as const;

export type ScoreWeights = Partial<typeof DEFAULT_WEIGHTS_V1>;

export interface LeadInput {
  phone?: string | null;
  email?: string | null;
  nif?: string | null;
  status?: string | null;
  /** ISO date — created/updated/last attempt. Default = now. */
  last_activity_at?: string | null;
  /** Quantas vezes o lead respondeu no WhatsApp. */
  whatsapp_replies?: number;
  /** Quantas vezes o lead abriu emails. */
  email_opens?: number;
}

export interface ScoreBreakdown {
  model_version: string;
  score: number;
  /** Componentes positivos (soma). */
  positive: number;
  /** Componentes negativos (soma). */
  negative: number;
  /** Mapa factor -> pontos atribuídos, para mostrar no UI. */
  factors: Record<string, number>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Constrói o breakdown (factores positivos e negativos) sem clampar. */
export function breakdownScore(
  lead: LeadInput,
  weights: ScoreWeights = {},
): ScoreBreakdown {
  const w = { ...DEFAULT_WEIGHTS_V1, ...weights };
  const factors: Record<string, number> = {};

  if (lead.phone && String(lead.phone).trim().length > 0) {
    factors.has_phone = w.has_phone;
  } else {
    factors.has_phone = 0;
  }

  if (lead.email && String(lead.email).trim().length > 0) {
    factors.has_email = w.has_email;
  } else {
    factors.has_email = 0;
  }

  if (lead.nif && String(lead.nif).trim().length > 0) {
    factors.has_nif = w.has_nif;
  } else {
    factors.has_nif = 0;
  }

  const wa = Math.max(0, Math.floor(Number(lead.whatsapp_replies ?? 0)));
  if (wa > 0) factors.whatsapp_replies = wa * w.whatsapp_replies;
  else factors.whatsapp_replies = 0;

  const eo = Math.max(0, Math.floor(Number(lead.email_opens ?? 0)));
  if (eo > 0) factors.email_opens = eo * w.email_opens;
  else factors.email_opens = 0;

  if (String(lead.status ?? "").toLowerCase() === "qualified") {
    factors.status_qualified = w.status_qualified;
  } else {
    factors.status_qualified = 0;
  }

  // Penalização: status discarded ou spam -> -50 (único valor)
  if (
    String(lead.status ?? "").toLowerCase() === "discarded" ||
    String(lead.status ?? "").toLowerCase() === "spam"
  ) {
    factors.penalty_discarded_or_spam = w.penalty_discarded_or_spam;
  } else {
    factors.penalty_discarded_or_spam = 0;
  }

  // Penalização: -5 por dia sem follow-up APÓS 7 dias desde last_activity_at
  const ref = lead.last_activity_at ? new Date(lead.last_activity_at) : new Date();
  const refMs = isNaN(ref.getTime()) ? Date.now() : ref.getTime();
  const daysIdle = Math.max(0, Math.floor((Date.now() - refMs) / MS_PER_DAY));
  const extraIdleDays = Math.max(0, daysIdle - 7);
  factors.decay_per_day_after_7d = extraIdleDays * w.decay_per_day_after_7d;

  let positive = 0;
  let negative = 0;
  for (const [key, val] of Object.entries(factors)) {
    if (key === "penalty_discarded_or_spam" || key === "decay_per_day_after_7d") {
      negative += val;
    } else {
      positive += val;
    }
  }

  const raw = positive + negative;
  const score = Math.max(0, Math.min(100, raw));

  return {
    model_version: SCORE_MODEL_VERSION,
    score,
    positive,
    negative,
    factors,
  };
}

/** Helper conveniente: devolve apenas o score inteiro (0-100). */
export function computeScore(lead: LeadInput, weights?: ScoreWeights): number {
  return breakdownScore(lead, weights).score;
}

/** Classifica score em 3 buckets usados pelos filtros laterais. */
export function scoreBucket(score: number): "hot" | "warm" | "cold" {
  if (score >= 61) return "hot";
  if (score >= 31) return "warm";
  return "cold";
}

/** Cor Tailwind para badge baseado no bucket. */
export function scoreBadgeClass(score: number): string {
  if (score >= 61) return "bg-green-100 text-green-800 border-green-200";
  if (score >= 31) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}
