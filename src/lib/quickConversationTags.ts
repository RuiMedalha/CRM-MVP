import type { ConversationTag } from "@/types/communication"

export interface QuickConversationTag {
  id: string
  label: string
  color: "yellow" | "red" | "blue" | "purple" | "orange"
}

export const QUICK_TAG_COLORS: Record<QuickConversationTag["color"], string> = {
  yellow: "#eab308",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#a855f7",
  orange: "#f97316",
}

export const QUICK_TAGS: QuickConversationTag[] = [
  { id: "0d63b43c-ca8c-4f7e-a296-df5570a90038", label: "⭐ Importante", color: "yellow" },
  { id: "1a734941-88d5-4cb9-8c90-b3d31b4a1d1f", label: "❤️ Favorito", color: "red" },
  { id: "6ce87f2c-7fa1-4e6a-965f-85d67edb6f14", label: "🔔 Follow-up", color: "blue" },
  { id: "8ad04c0b-7d62-464f-a0b8-3d7814219c3f", label: "👑 VIP", color: "purple" },
  { id: "3a79b87d-8110-437f-b4b9-b252859a7375", label: "⏳ Pendente", color: "orange" },
]

export const QUICK_CONVERSATION_TAGS: ConversationTag[] = QUICK_TAGS.map((t) => ({
  id: t.id,
  name: t.label,
  color: QUICK_TAG_COLORS[t.color],
  icon: "tag",
  enabled: true,
}))

export function getQuickTagById(id: string): QuickConversationTag | undefined {
  return QUICK_TAGS.find((t) => t.id === id)
}

export function parseConversationTagIds(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw)) return undefined
  const ids: string[] = []
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      ids.push(item.trim())
      continue
    }
    if (typeof item === "object" && item !== null) {
      const id = (item as { id?: unknown }).id
      if (id !== undefined && id !== null) ids.push(String(id))
    }
  }
  return ids.length > 0 ? ids : []
}
