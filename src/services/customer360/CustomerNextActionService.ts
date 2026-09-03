/**
 * CustomerNextActionService — determina a próxima acção para uma Organization.
 * Recebe Customer360Data, devolve NextActionData ou null.
 * Toda a lógica isolada da UI.
 */

import type { Customer360Data } from "@/types/customer360";
import type { NextActionData } from "@/components/customer360/NextAction";

export function determineNextAction(data: Customer360Data): NextActionData | null {
  // Rule 1: Proposal sent but not responded — follow up
  const pendingProposal = data.proposals.find((p) => p.status === "sent" || p.status === "viewed");
  if (pendingProposal) {
    const sentDate = pendingProposal.sentAt;
    return {
      title: `Seguimento proposta ${pendingProposal.number}`,
      dueAt: sentDate ? `3 dias após envio (${sentDate})` : "em breve",
      assignedTo: data.organization.assignedTo,
      type: "proposal_followup",
      overdue: pendingProposal.status === "sent", // sent without view = potentially overdue
    };
  }

  // Rule 2: Active opportunity without proposal — create proposal
  const oppWithoutProposal = data.opportunities.find(
    (o) => o.stage === "qualification" || o.stage === "prospecting"
  );
  if (oppWithoutProposal) {
    return {
      title: `Criar proposta para "${oppWithoutProposal.title}"`,
      assignedTo: oppWithoutProposal.assignedTo ?? data.organization.assignedTo,
      type: "create_proposal",
    };
  }

  // Rule 3: No recent contact — reach out
  const lastActivity = data.organization.lastActivityAt;
  if (lastActivity) {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
    if (daysSince > 14) {
      return {
        title: "Contactar cliente — sem actividade há " + daysSince + " dias",
        dueAt: "hoje",
        assignedTo: data.organization.assignedTo,
        type: "reactivation",
        overdue: daysSince > 30,
      };
    }
  }

  // Rule 4: No next action determined
  return null;
}
