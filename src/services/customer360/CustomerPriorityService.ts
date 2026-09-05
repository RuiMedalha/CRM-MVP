/**
 * CustomerPriorityService — calcula prioridades automaticamente.
 * Recebe Customer360Data, devolve lista de PriorityItems.
 * Toda a lógica isolada da UI.
 */

import type { Customer360Data } from "@/types/customer360";
import type { PriorityItem } from "@/components/customer360/PriorityPanel";

export function calculatePriorities(data: Customer360Data): PriorityItem[] {
  const items: PriorityItem[] = [];

  // P1: Proposals sent without response (>2 days)
  for (const p of data.proposals) {
    if (p.status === "sent") {
      const age = p.sentAt ? Date.now() - new Date(p.sentAt).getTime() : 0;
      if (age > 2 * 86400000) {
        items.push({
          id: `pri-prop-${p.id}`,
          title: `Proposta ${p.number} enviada sem resposta há >48h`,
          type: "proposal_no_response",
          priority: "P1",
        });
      }
    }
  }

  // P1: Recent inbound communication without response
  const recentInbound = data.timeline.filter((e) => {
    const age = Date.now() - new Date(e.occurredAt).getTime();
    return age < 2 * 86400000 && (e.type === "whatsapp" || e.type === "email" || e.type === "phone");
  });
  if (recentInbound.length > 0 && recentInbound[0].type === "whatsapp") {
    items.push({
      id: "pri-wa-pending",
      title: `WhatsApp por responder (${recentInbound[0].actor || "cliente"})`,
      type: "whatsapp_pending",
      priority: "P1",
    });
  }
  if (recentInbound.length > 0 && recentInbound.some((e) => e.type === "email")) {
    items.push({
      id: "pri-email-pending",
      title: "Email recente sem resposta",
      type: "email_urgent",
      priority: "P2",
    });
  }

  // P2: Opportunity stalled (>7 days without activity in negotiation)
  for (const opp of data.opportunities) {
    const stage = (opp.stage || "").toLowerCase();
    if (stage === "negotiation" || stage === "proposal" || stage === "negociacao" || stage === "proposta") {
      items.push({
        id: `pri-opp-${opp.id}`,
        title: `Oportunidade "${opp.title}" parada`,
        type: "proposal_no_response",
        priority: "P2",
      });
    }
  }

  // P3: No contact in >14 days
  const lastActivity = data.organization.lastActivityAt;
  if (lastActivity) {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
    if (daysSince > 14) {
      items.push({
        id: "pri-no-contact",
        title: `Cliente sem contacto há ${daysSince} dias`,
        type: "proposal_no_response",
        priority: daysSince > 30 ? "P1" : "P3",
      });
    }
  }

  // Sort: P1 first, then P2, then P3
  const order = { P1: 0, P2: 1, P3: 2 };
  return items.sort((a, b) => order[a.priority] - order[b.priority]);
}
