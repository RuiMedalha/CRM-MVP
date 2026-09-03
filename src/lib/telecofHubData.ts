import type { TelecofCallEventRecord } from "@/types/telecof"

export const TELECOF_ATTENDANCE_TAGS = [
  "Urgente",
  "Orçamento",
  "Técnico",
  "VIP",
  "Pós-venda",
  "Reclamação",
  "Publicidade",
  "Rechamar",
] as const

export const TELECOF_WORKSPACE_QUICK_TAGS = [
  "Rechamar",
  "Orçamento",
  "Técnico",
  "Urgente",
] as const satisfies readonly TelecofAttendanceTag[]

export type TelecofAttendanceTag = (typeof TELECOF_ATTENDANCE_TAGS)[number]

export interface TelecofHubNote {
  id: string
  text: string
  at: string
  by?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function getTelecofHubNotes(event: TelecofCallEventRecord): TelecofHubNote[] {
  const raw = asRecord(event.rawPayload)
  const list = raw.hub_notes
  if (!Array.isArray(list)) return []

  const notes: TelecofHubNote[] = []
  list.forEach((item, index) => {
    const n = asRecord(item)
    const text = String(n.text ?? "").trim()
    if (!text) return
    notes.push({
      id: String(n.id ?? `note-${index}`),
      text,
      at: String(n.at ?? new Date().toISOString()),
      by: n.by ? String(n.by) : undefined,
    })
  })
  return notes
}

export function getTelecofHubTags(event: TelecofCallEventRecord): TelecofAttendanceTag[] {
  const raw = asRecord(event.rawPayload)
  const fromPayload = raw.hub_tags
  const tags: string[] = []

  if (Array.isArray(fromPayload)) {
    for (const t of fromPayload) {
      if (typeof t === "string" && t.trim()) tags.push(t.trim())
    }
  }

  const allowed = new Set<string>(TELECOF_ATTENDANCE_TAGS)
  return tags.filter((t): t is TelecofAttendanceTag => allowed.has(t))
}

export function appendTelecofHubNote(
  raw: Record<string, unknown> | undefined,
  note: Omit<TelecofHubNote, "id"> & { id?: string },
): Record<string, unknown> {
  const base = { ...(raw ?? {}) }
  const prev = Array.isArray(base.hub_notes) ? [...base.hub_notes] : []
  prev.push({
    id: note.id ?? `note-${Date.now()}`,
    text: note.text,
    at: note.at,
    ...(note.by ? { by: note.by } : {}),
  })
  base.hub_notes = prev
  return base
}

export function toggleTelecofHubTag(
  raw: Record<string, unknown> | undefined,
  tag: TelecofAttendanceTag,
): Record<string, unknown> {
  const base = { ...(raw ?? {}) }
  const current = getTelecofHubTags({ rawPayload: base } as TelecofCallEventRecord)
  const next = current.includes(tag)
    ? current.filter((t) => t !== tag)
    : [...current, tag]
  base.hub_tags = next
  return base
}

export function telecofTempDisplayName(phone: string): string {
  const suffix = phone.replace(/\D/g, "").slice(-4)
  return suffix ? `Telecof ····${suffix}` : "Telecof"
}
