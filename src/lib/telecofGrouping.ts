import { isOperationallyUnhandled } from "./telecofQueue"
import type { TelecofCallEventRecord } from "@/types/telecof"

export interface TelecofCallGroup {
  id: string // ID da chamada primária (normalmente a mais recente)
  groupKey: string
  primaryEvent: TelecofCallEventRecord
  calls: TelecofCallEventRecord[] // Chamadas agrupadas no filtro atual, ordenadas por data desc
  allCallerCalls: TelecofCallEventRecord[] // Todas as chamadas deste chamador no histórico
  callCount: number // Total de chamadas no filtro atual
  totalCallerCallsCount: number // Total de chamadas no histórico total
  unhandledCount: number
  hasUnhandled: boolean
  latestAt: string
  phone: string
  normalizedPhone: string
  customerName?: string
  contactId?: string
}

/**
 * Normaliza o número de telefone para agrupamento robusto de chamadas.
 * Remove caracteres não numéricos e prefixos de país (+351 / 00351).
 */
export function normalizePhoneForGrouping(phone?: string | null): string {
  if (!phone) return ""
  let digits = String(phone).replace(/\D/g, "")
  if (!digits) return ""

  // Se tem prefixo internacional de Portugal (351):
  if (digits.length === 12 && digits.startsWith("351")) {
    return digits.slice(3)
  }
  if (digits.length === 14 && digits.startsWith("00351")) {
    return digits.slice(5)
  }

  return digits
}

/**
 * Determina a chave de agrupamento única para uma chamada.
 */
export function getCallGroupKey(event: TelecofCallEventRecord): string {
  const normPhone = normalizePhoneForGrouping(event.normalizedPhone || event.phone)
  if (normPhone) {
    return `phone:${normPhone}`
  }
  if (event.contactId) {
    return `contact:${event.contactId}`
  }
  return `id:${event.id}`
}

/**
 * Verifica se duas chamadas pertencem ao mesmo cliente / chamador.
 */
export function isSameCaller(a: TelecofCallEventRecord, b: TelecofCallEventRecord): boolean {
  if (a.id === b.id) return true
  if (a.contactId && b.contactId && a.contactId === b.contactId) return true

  const normA = normalizePhoneForGrouping(a.normalizedPhone || a.phone)
  const normB = normalizePhoneForGrouping(b.normalizedPhone || b.phone)
  if (normA && normB && normA === normB) return true

  return false
}

/**
 * Devolve todas as chamadas do mesmo interlocutor (mesmo telefone normalizado ou contactId),
 * ordenadas da mais recente para a mais antiga.
 */
export function getCallsForSameCaller(
  currentCall: TelecofCallEventRecord,
  allCalls: TelecofCallEventRecord[],
): TelecofCallEventRecord[] {
  const normCurrent = normalizePhoneForGrouping(currentCall.normalizedPhone || currentCall.phone)
  const contactId = currentCall.contactId

  const matches = allCalls.filter((c) => {
    if (c.id === currentCall.id) return true
    if (contactId && c.contactId && c.contactId === contactId) return true
    const norm = normalizePhoneForGrouping(c.normalizedPhone || c.phone)
    if (normCurrent && norm && normCurrent === norm) return true
    return false
  })

  return matches.sort((a, b) => {
    const timeA = new Date(a.startedAt ?? a.createdAt).getTime()
    const timeB = new Date(b.startedAt ?? b.createdAt).getTime()
    return timeB - timeA
  })
}

function isPhoneLike(value?: string | null): boolean {
  if (!value) return false
  const stripped = value.replace(/[\s\-\+\(\)]/g, "")
  return /^\d{7,15}$/.test(stripped)
}

/**
 * Agrupa uma lista de chamadas (ex: filtered) por cliente / chamador.
 * Cada grupo contém o número de chamadas efetuadas e a chamada mais recente como primária.
 */
export function groupTelecofCalls(
  filteredCalls: TelecofCallEventRecord[],
  allEvents: TelecofCallEventRecord[] = [],
): TelecofCallGroup[] {
  const groupsMap = new Map<string, TelecofCallEventRecord[]>()

  // 1. Agrupar chamadas filtradas
  for (const call of filteredCalls) {
    const key = getCallGroupKey(call)
    const existing = groupsMap.get(key)
    if (existing) {
      existing.push(call)
    } else {
      groupsMap.set(key, [call])
    }
  }

  // 2. Mapeamento de todas as chamadas para histórico completo
  const allCallsMap = new Map<string, TelecofCallEventRecord[]>()
  if (allEvents.length > 0) {
    for (const call of allEvents) {
      const key = getCallGroupKey(call)
      const existing = allCallsMap.get(key)
      if (existing) {
        existing.push(call)
      } else {
        allCallsMap.set(key, [call])
      }
    }
  }

  const result: TelecofCallGroup[] = []

  for (const [groupKey, calls] of groupsMap.entries()) {
    // Ordenar chamadas do grupo: mais recente primeiro
    calls.sort((a, b) => {
      const timeA = new Date(a.startedAt ?? a.createdAt).getTime()
      const timeB = new Date(b.startedAt ?? b.createdAt).getTime()
      return timeB - timeA
    })

    const primaryEvent = { ...calls[0] }

    // Enriquecer primaryEvent com nome do cliente e contactId se alguma das outras chamadas tiver
    for (const c of calls) {
      if (!primaryEvent.contactId && c.contactId) {
        primaryEvent.contactId = c.contactId
      }
      if (
        (!primaryEvent.customerName || isPhoneLike(primaryEvent.customerName)) &&
        c.customerName &&
        !isPhoneLike(c.customerName)
      ) {
        primaryEvent.customerName = c.customerName
      }
    }

    const allHistory = allCallsMap.get(groupKey) ?? calls
    allHistory.sort((a, b) => {
      const timeA = new Date(a.startedAt ?? a.createdAt).getTime()
      const timeB = new Date(b.startedAt ?? b.createdAt).getTime()
      return timeB - timeA
    })

    const unhandledCount = calls.filter(isOperationallyUnhandled).length

    result.push({
      id: primaryEvent.id,
      groupKey,
      primaryEvent,
      calls,
      allCallerCalls: allHistory,
      callCount: calls.length,
      totalCallerCallsCount: allHistory.length,
      unhandledCount,
      hasUnhandled: unhandledCount > 0,
      latestAt: primaryEvent.startedAt ?? primaryEvent.createdAt,
      phone: primaryEvent.phone,
      normalizedPhone: primaryEvent.normalizedPhone,
      customerName: primaryEvent.customerName,
      contactId: primaryEvent.contactId,
    })
  }

  // Ordenar grupos por data da chamada mais recente desc
  result.sort((a, b) => {
    const timeA = new Date(a.latestAt).getTime()
    const timeB = new Date(b.latestAt).getTime()
    return timeB - timeA
  })

  return result
}
