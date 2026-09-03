import { normalizePhonePt } from "./phone"

import type { Message } from "@/types/message"

function digitsFromJid(jid: string): string {
  return jid
    .replace(/@s\.whatsapp\.net$/, "")
    .replace(/@c\.us$/, "")
    .replace(/@g\.us$/, "")
    .replace(/\D/g, "")
}

export function getGroupParticipantLabel(message: Message): string | undefined {
  const meta = message.hubMeta

  const name =
    meta?.participantName?.trim() ||
    meta?.pushName?.trim() ||
    message.senderName?.trim() ||
    meta?.participant?.trim()

  if (name && !name.includes("@")) {
    return name
  }

  const jid =
    meta?.participantJid?.trim() ||
    (meta?.participant?.includes("@") ? meta.participant : undefined)

  if (jid) {
    const digits = digitsFromJid(jid)
    if (digits.length >= 7) {
      const formatted = normalizePhonePt(digits)
      return formatted ?? `+${digits}`
    }
  }

  if (name) {
    const digits = digitsFromJid(name)
    if (digits.length >= 7) {
      return normalizePhonePt(digits) ?? `+${digits}`
    }
    return name
  }

  return undefined
}
