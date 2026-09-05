import { useMemo, useState } from "react"
import { UserPlus } from "lucide-react"

import { filterTelecofEventsByQueue, usesCompactTelecofRow } from "@/lib/telecofQueue"
import { groupTelecofCalls } from "@/lib/telecofGrouping"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"
import { useInboxFilterStore } from "@/store/inboxFilterStore"
import { useTelecofCallStore } from "@/store/telecofCallStore"

import { TelecofCallCard } from "./TelecofCallCard"
import { TelecofCallRow } from "./TelecofCallRow"
import { TelecofInboxFilters } from "./TelecofInboxFilters"
import { AsyncState } from "@/components/patterns/AsyncState"
import { EmptyState } from "@/components/patterns/EmptyState"

export function TelecofCallsList() {
  const { events, selectedEventId, selectEvent, loading } = useTelecofCallStore()
  const mergeEvent = useTelecofCallStore((s) => s.mergeEvent)
  const { telecofQueueFilter, searchQuery } = useInboxFilterStore()
  const [bulkBusy, setBulkBusy] = useState(false)

  const filtered = useMemo(
    () => filterTelecofEventsByQueue(events, telecofQueueFilter, searchQuery),
    [events, telecofQueueFilter, searchQuery],
  )

  const groupedCalls = useMemo(
    () => groupTelecofCalls(filtered, events),
    [filtered, events],
  )

  const unhandledCount = useMemo(
    () => filterTelecofEventsByQueue(events, "unhandled", "").length,
    [events],
  )

  async function handleBulkResolve() {
    if (!window.confirm(`Marcar ${unhandledCount} chamadas como tratadas? (itens antigos saem da fila)`)) return
    setBulkBusy(true)
    try {
      const unhandled = filterTelecofEventsByQueue(events, "unhandled", "")
      const now = new Date().toISOString()
      await Promise.all(
        unhandled.map((e) =>
          patchHubCommunicationEvent(e.id, { status: "resolved", resolved_at: now })
            .then((updated) => mergeEvent(updated))
            .catch(() => { /* skip individual failures */ }),
        ),
      )
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <section className="flex h-full min-w-0 flex-col bg-muted">
      <div className="crm-telecof-list-header flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold text-foreground">Fila Telecof</h1>
          <p className="crm-telecof-list-counter text-xs text-muted-foreground">
            {groupedCalls.length} {groupedCalls.length === 1 ? "contacto" : "contactos"}
            {filtered.length !== groupedCalls.length && ` (${filtered.length} chamadas)`}
            {unhandledCount > 0 && (
              <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">
                · {unhandledCount} por tratar
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => selectEvent(undefined)}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 text-xs font-semibold transition-colors"
          title="Abrir ficha para registar novo contacto ou atendimento manual"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>+ Novo</span>
        </button>
      </div>

      <TelecofInboxFilters />

      {unhandledCount > 5 && (
        <div className="crm-telecof-bulk shrink-0 border-b border-border px-3 py-2">
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void handleBulkResolve()}
            className="min-h-[44px] w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
          >
            {bulkBusy ? "A processar…" : `✓ Marcar ${unhandledCount} como tratadas`}
          </button>
        </div>
      )}

      <div className="crm-telecof-scroller min-h-0 flex-1 overflow-y-auto p-2">
        <AsyncState
          loading={loading && groupedCalls.length === 0}
          empty={!loading && groupedCalls.length === 0}
          emptyFallback={
            <EmptyState
              className="min-h-40 bg-card px-4 py-6"
              title="Sem chamadas"
              description="Ajuste o filtro ou aguarde por novas chamadas na fila."
            />
          }
        >
          <div className="space-y-2">
            {groupedCalls.map((group) => {
              const selected =
                group.calls.some((c) => c.id === selectedEventId) ||
                group.primaryEvent.id === selectedEventId
              const onSelect = () => selectEvent(group.primaryEvent.id)

              const isCompact = group.calls.every(usesCompactTelecofRow)

              return isCompact ? (
                <TelecofCallRow
                  key={group.groupKey}
                  event={group.primaryEvent}
                  callCount={group.callCount}
                  hasUnhandled={group.hasUnhandled}
                  selected={selected}
                  onSelect={onSelect}
                />
              ) : (
                <TelecofCallCard
                  key={group.groupKey}
                  event={group.primaryEvent}
                  callCount={group.callCount}
                  hasUnhandled={group.hasUnhandled}
                  selected={selected}
                  onSelect={onSelect}
                />
              )
            })}
          </div>
        </AsyncState>
      </div>
    </section>
  )
}
