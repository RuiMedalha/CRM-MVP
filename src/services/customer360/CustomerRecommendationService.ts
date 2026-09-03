/**
 * CustomerRecommendationService — gera recomendações baseadas em regras.
 * Recebe Customer360Data, devolve sugestões.
 * Mock rules por agora — preparado para futuro uso com IA real.
 */

import type { Customer360Data } from "@/types/customer360";
import type { AISuggestion } from "@/components/customer360/AISuggestions";

export function generateRecommendations(data: Customer360Data): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  let nextId = 1;

  // Rule 1: Proposal viewed but not approved
  const viewedProposal = data.proposals.find((p) => p.status === "viewed");
  if (viewedProposal) {
    suggestions.push({
      id: `rec-${nextId++}`,
      text: `O cliente visualizou a proposta ${viewedProposal.number} mas não respondeu. Recomendamos contacto telefónico.`,
      type: "action",
    });
  }

  // Rule 2: Proposal sent without being viewed
  const sentNotViewed = data.proposals.find((p) => p.status === "sent");
  if (sentNotViewed) {
    suggestions.push({
      id: `rec-${nextId++}`,
      text: `A proposta ${sentNotViewed.number} foi enviada mas ainda não foi aberta. Considere enviar lembrete por WhatsApp.`,
      type: "action",
    });
  }

  // Rule 3: No recent activity
  const lastActivity = data.organization.lastActivityAt;
  if (lastActivity) {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
    if (daysSince > 7) {
      suggestions.push({
        id: `rec-${nextId++}`,
        text: `Cliente sem contacto há ${daysSince} dias. Considere agendar follow-up.`,
        type: "warning",
      });
    }
  }

  // Rule 4: High pipeline value
  const activePipelineValue = data.opportunities
    .filter((o) => !o.stage.startsWith("closed"))
    .reduce((sum, o) => sum + (o.value ?? 0), 0);
  if (activePipelineValue > 30000) {
    suggestions.push({
      id: `rec-${nextId++}`,
      text: `Pipeline activo de €${(activePipelineValue / 1000).toFixed(0)}k — cliente de elevado potencial. Priorizar.`,
      type: "info",
    });
  }

  // Rule 5: No follow-up defined (always relevant)
  suggestions.push({
    id: `rec-${nextId++}`,
    text: "Não existe follow-up agendado para este cliente.",
    type: "warning",
  });

  return suggestions.slice(0, 4); // max 4 suggestions
}
