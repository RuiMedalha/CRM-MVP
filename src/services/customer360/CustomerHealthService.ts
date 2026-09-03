/**
 * CustomerHealthService — calcula Health Score de uma Organization.
 * Recebe Customer360Data, devolve score 0-100.
 * Toda a lógica isolada da UI.
 */

import type { Customer360Data } from "@/types/customer360";

export interface HealthScoreResult {
  score: number;
  factors: Array<{ label: string; impact: number; status: "good" | "warning" | "bad" }>;
}

export function calculateHealthScore(data: Customer360Data): HealthScoreResult {
  const factors: HealthScoreResult["factors"] = [];
  let score = 50; // base

  // Factor 1: Days since last activity (max 25 points)
  const lastActivity = data.organization.lastActivityAt;
  if (lastActivity) {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
    if (daysSince <= 3) {
      score += 25;
      factors.push({ label: "Contacto recente", impact: 25, status: "good" });
    } else if (daysSince <= 14) {
      score += 15;
      factors.push({ label: `Contacto há ${daysSince} dias`, impact: 15, status: "good" });
    } else if (daysSince <= 30) {
      score += 5;
      factors.push({ label: `Sem contacto há ${daysSince} dias`, impact: 5, status: "warning" });
    } else {
      score -= 10;
      factors.push({ label: `Sem contacto há ${daysSince} dias`, impact: -10, status: "bad" });
    }
  } else {
    score -= 15;
    factors.push({ label: "Sem actividade registada", impact: -15, status: "bad" });
  }

  // Factor 2: Open proposals (max 15 points)
  const openProposals = data.proposals.filter((p) => p.status === "sent" || p.status === "viewed");
  if (openProposals.length > 0) {
    score += 15;
    factors.push({ label: `${openProposals.length} proposta(s) aberta(s)`, impact: 15, status: "good" });
  }

  // Factor 3: Active opportunities (max 15 points)
  const activeOpps = data.opportunities.filter((o) => !o.stage.startsWith("closed"));
  if (activeOpps.length > 0) {
    score += 15;
    factors.push({ label: `${activeOpps.length} oportunidade(s) activa(s)`, impact: 15, status: "good" });
  }

  // Factor 4: Annual value (max 10 points)
  const annualValue = data.organization.annualValue ?? 0;
  if (annualValue > 20000) {
    score += 10;
    factors.push({ label: "Valor anual elevado", impact: 10, status: "good" });
  } else if (annualValue > 5000) {
    score += 5;
    factors.push({ label: "Valor anual moderado", impact: 5, status: "good" });
  }

  // Factor 5: Recent communications (max 10 points)
  const recentComms = data.timeline.filter((e) => {
    const age = Date.now() - new Date(e.occurredAt).getTime();
    return age < 7 * 86400000; // last 7 days
  });
  if (recentComms.length >= 3) {
    score += 10;
    factors.push({ label: "Comunicação frequente", impact: 10, status: "good" });
  } else if (recentComms.length >= 1) {
    score += 5;
    factors.push({ label: "Alguma comunicação recente", impact: 5, status: "good" });
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}
