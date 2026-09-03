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

export type WhatsAppInstanceId = "918" | "916" | "913"

/**
 * Resolves which WhatsApp instance (918, 916, or 913) a conversation belongs to.
 * Ensures strict channel isolation without matching client phone digits inside source.
 */
export function resolveConversationWhatsAppInstance(
  conv: Pick<Conversation, "instanceName" | "channel" | "source">,
): WhatsAppInstanceId | null {
  const inst = String(conv.instanceName || "").trim().toLowerCase()
  const chan = String(conv.channel || "").trim().toLowerCase()
  const src = String(conv.source || "").trim().toLowerCase()

  // 1. Explicit instance name (from n8n / webhook / evolution / waha / directus)
  if (inst) {
    if (inst.includes("918")) return "918"
    if (inst.includes("916") || inst === "waha") return "916"
    if (inst.includes("913") || inst === "waba") return "913"
  }

  // 2. Specific channel aliases
  if (chan === "whatsapp_918") return "918"
  if (chan === "whatsapp_916" || chan === "waha") return "916"
  if (chan === "whatsapp_913" || chan === "whatsapp_meta") return "913"

  // 3. Meta / WABA provider prefixes in source (e.g. meta:913:351..., meta:...)
  // Note: ONLY match source if it starts with the provider prefix "meta:", NEVER raw customer phone/JID
  if (src.startsWith("meta:") || src.startsWith("waba:")) {
    return "913"
  }

  // 4. Evolution provider prefixes in source
  if (src.startsWith("evo:918:") || src.startsWith("evo:hotelequip-918:")) return "918"
  if (src.startsWith("evo:916:") || src.startsWith("evo:hotelequip-916:")) return "916"

  // 5. Default WhatsApp channel without instance metadata:
  // Legacy WhatsApp conversations in Directus default to primary 918 line
  if (chan === "whatsapp" || chan === "whatsapp_group") {
    return "918"
  }

  return null
}

