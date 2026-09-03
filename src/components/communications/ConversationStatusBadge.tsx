import { HUB_DEFAULT_AGENT } from "@/lib/inboxFilters"
import type { Conversation } from "@/types/conversation"

function badgeClass(tone: "green" | "blue" | "slate" | "amber"): string {
  switch (tone) {
    case "green": return "bg-green-100 text-green-800 ring-green-600/20"
    case "blue": return "bg-blue-100 text-blue-800 ring-blue-600/20"
    case "amber": return "bg-amber-100 text-amber-900 ring-amber-600/25"
    case "slate": return "bg-muted text-muted-foreground ring-slate-400/30"
  }
}

export function getOperationalStatusLabel(
  conversation: Conversation,
): { label: string; tone: "green" | "blue" | "slate" | "amber" } {
  if (conversation.status === "archived") return { label: "Arquivo", tone: "slate" }
  if (conversation.status === "closed") return { label: "Fechada", tone: "slate" }

  if (
    conversation.status === "open" && conversation.mode === "human" ||
    conversation.status === "human_active" || conversation.mode === "human"
  ) {
    const who = conversation.assignedTo ?? HUB_DEFAULT_AGENT
    return { label: `Humano · ${who}`, tone: "blue" }
  }

  if (conversation.status === "ai_active") return { label: "IA ativa", tone: "green" }
  if (conversation.status === "open") return { label: "Aberta", tone: "green" }
  if (conversation.status === "handoff") return { label: "Pedido humano", tone: "amber" }
  if (conversation.status === "waiting_client") return { label: "À espera do cliente", tone: "amber" }

  return { label: conversation.status, tone: "slate" }
}

export function ConversationStatusBadge({
  conversation,
}: {
  conversation: Conversation
}) {
  const { label, tone } = getOperationalStatusLabel(conversation)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium leading-snug ring-1 ring-inset sm:py-0.5 ${badgeClass(tone)}`}
    >
      {label}
    </span>
  )
}
