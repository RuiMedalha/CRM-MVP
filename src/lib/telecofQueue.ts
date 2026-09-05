import type {
  TelecofCallEventRecord,
  TelecofOperationalStatus,
} from "@/types/telecof"
import type { TelecofQueueFilter } from "@/types/communication"

export const TELECOF_UNHANDLED_AFTER_MS = 5 * 60 * 1000

const OPEN_STATUSES = new Set(["new", "unhandled", "in_progress"])
const RESOLVED_STATUSES = new Set(["resolved", "treated"])
const SPAM_STATUSES = new Set(["spam", "advertising"])
const ARCHIVE_LIST_STATUSES = new Set([
  "resolved",
  "treated",
  "spam",
  "advertising",
  "deleted",
])

export function normalizeTelecofOperationalStatus(status: string): string {
  const s = String(status ?? "").trim().toLowerCase()
  if (s === "treated") return "resolved"
  if (s === "advertising") return "spam"
  return s
}

export function isCallMissed(event: TelecofCallEventRecord): boolean {
  if (event.callStatus === "missed") return true
  if (event.rawPayload?.call_qualification === "missed") return true
  const status = normalizeTelecofOperationalStatus(event.operationalStatus)
  return status === "missed"
}

export function isCallAnswered(event: TelecofCallEventRecord): boolean {
  if (event.callStatus === "answered" || event.callStatus === "completed") return true
  if (event.rawPayload?.call_qualification === "answered") return true
  const status = normalizeTelecofOperationalStatus(event.operationalStatus)
  return status === "in_progress" || status === "resolved"
}

export function isCallUnqualified(event: TelecofCallEventRecord): boolean {
  return (
    !isCallMissed(event) &&
    !isCallAnswered(event) &&
    (event.operationalStatus === "new" || event.operationalStatus === "unhandled")
  )
}

export function isStaleNewCall(event: TelecofCallEventRecord): boolean {
  if (event.operationalStatus !== "new" || event.claimedAt) return false
  const created = new Date(event.createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created >= TELECOF_UNHANDLED_AFTER_MS
}

export function isOperationallyUnhandled(event: TelecofCallEventRecord): boolean {
  return (
    normalizeTelecofOperationalStatus(event.operationalStatus) === "unhandled" ||
    isCallMissed(event) ||
    isCallUnqualified(event) ||
    isStaleNewCall(event)
  )
}

export function operationalStatusLabel(event: TelecofCallEventRecord): string {
  if (isCallMissed(event)) return "Perdida / Não atendida"
  if (isCallUnqualified(event)) return "Por classificar"
  if (isStaleNewCall(event)) return "Não tratada"
  const status = normalizeTelecofOperationalStatus(event.operationalStatus)
  switch (status) {
    case "new": return "Nova"
    case "unhandled": return "Não tratada"
    case "in_progress": return "Atendida / Em curso"
    case "resolved": return "Tratada"
    case "spam": return "Publicidade"
    case "deleted": return "Apagada"
    case "callback": return "Rechamar"
    case "missed": return "Perdida / Não atendida"
    default: return event.operationalStatus
  }
}

export function usesCompactTelecofRow(event: TelecofCallEventRecord): boolean {
  const status = normalizeTelecofOperationalStatus(event.operationalStatus)
  return ARCHIVE_LIST_STATUSES.has(status)
}

export function operationalStatusTone(
  event: TelecofCallEventRecord,
): "violet" | "amber" | "blue" | "green" | "slate" | "orange" | "red" {
  if (isCallMissed(event)) return "red"
  if (isCallUnqualified(event)) return "amber"
  if (isOperationallyUnhandled(event)) return "amber"
  const status = normalizeTelecofOperationalStatus(event.operationalStatus)
  switch (status) {
    case "new": return "violet"
    case "in_progress": return "blue"
    case "resolved": return "green"
    case "spam": return "orange"
    case "callback": return "slate"
    default: return "slate"
  }
}

export function matchesTelecofQueueFilter(
  event: TelecofCallEventRecord,
  queueFilter: TelecofQueueFilter,
): boolean {
  const status = normalizeTelecofOperationalStatus(event.operationalStatus)
  switch (queueFilter) {
    case "open": return OPEN_STATUSES.has(status)
    case "unhandled": return isOperationallyUnhandled(event)
    case "in_progress": return status === "in_progress"
    case "resolved": return RESOLVED_STATUSES.has(status)
    case "spam": return SPAM_STATUSES.has(status)
    case "deleted": return status === "deleted"
    case "all": return true
    default: return true
  }
}

export function filterTelecofEventsByQueue(
  events: TelecofCallEventRecord[],
  queueFilter: TelecofQueueFilter,
  searchQuery: string,
): TelecofCallEventRecord[] {
  let list = events.filter((e) => matchesTelecofQueueFilter(e, queueFilter))
  const q = searchQuery.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (e) =>
        e.phone.toLowerCase().includes(q) ||
        e.normalizedPhone.includes(q) ||
        (e.assignedTo?.toLowerCase().includes(q) ?? false) ||
        (e.customerName?.toLowerCase().includes(q) ?? false),
    )
  }
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

/** @deprecated Mantido para compat */
export function matchesTelecofQueueStatus(
  status: TelecofOperationalStatus,
): boolean {
  return OPEN_STATUSES.has(normalizeTelecofOperationalStatus(status))
}
