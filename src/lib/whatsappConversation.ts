import type { Conversation } from "@/types/conversation"

export function isWhatsAppGroupConversation(
  conv: Pick<Conversation, "channel" | "source"> & {
    rawPayload?: Record<string, unknown> | null
  },
): boolean {
  if (conv.channel === "whatsapp_group") return true
  if (conv.source?.includes("@g.us")) return true
  const meta = (conv as { rawPayload?: Record<string, unknown> | null }).rawPayload
  if (meta?.is_group === true || meta?.isGroup === true) return true
  return false
}

export function isWhatsAppIndividualConversation(
  conv: Pick<Conversation, "channel" | "source">,
): boolean {
  if (conv.channel !== "whatsapp") return false
  return !conv.source?.includes("@g.us")
}
