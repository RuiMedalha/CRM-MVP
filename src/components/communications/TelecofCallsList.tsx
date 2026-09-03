import { useMemo, useState } from "react"

import { filterTelecofEventsByQueue, usesCompactTelecofRow } from "@/lib/telecofQueue"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"
import { useInboxFilterStore } from "@/store/inboxFilterStore"
import { useTelecofCallStore } from "@/store/telecofCallStore"

import { TelecofCallCard } from "./TelecofCallCard"
import { TelecofCallRow } from "./TelecofCallRow"
import { TelecofInboxFilters } from "./TelecofInboxFilters"
import { AsyncState } from "@/components/patterns/AsyncState"
import { EmptyState } from "@/components/patterns/EmptyState"

/**
 * Redesign landscape — coluna master (320px).
 *
 * Estrutura: header compacto (título + contador) → filtros → scroller de
 * chamadas. Em landscape (index.css) o header extra e o botão de bulk são
 * escondidos para dar toda a altura ao scroller, deixando os cards/rows
 * de 64px como conteúdo essencial. Os dados e handlers (bulk resolve,
 * filtros) permanecem intactos.
 */
export function TelecofCallsList() {
  const { events, selectedEventId, selectEvent, loading } = useTelecofCallStore()
  const mergeEvent = useTelecofCallStore((s) => s.mergeEvent)
  const { telecofQueueFilter, searchQuery } = useInboxFilterStore()
  const [bulkBusy, setBulkBusy] = useState(false)

  const filtered = useMemo(
    () => filterTelecofEventsByQueue(events, telecofQueueFilter, searchQuery),
    [events, telecofQueueFilter, searchQuery],
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
      <div className="crm-telecof-list-header flex shrink-0 items-baseline justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
        <h1 className="text-sm font-semibold text-foreground">Fila Telecof</h1>
        <p className="crm-telecof-list-counter text-xs text-muted-foreground">
          {filtered.length}
          {unhandledCount > 0 && (
            <span className="ml-1 font-semibold text-amber-700">
              · {unhandledCount} por tratar
            </span>
          )}
        </p>
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
          loading={loading && filtered.length === 0}
          empty={!loading && filtered.length === 0}
          emptyFallback={
            <EmptyState
              className="min-h-40 bg-card px-4 py-6"
              title="Sem chamadas"
              description="Ajuste o filtro ou aguarde por novas chamadas na fila."
            />
          }
        >
          <div className="space-y-2">
            {filtered.map((event) => {
              const selected = selectedEventId === event.id
              const onSelect = () => selectEvent(event.id)

              return usesCompactTelecofRow(event) ? (
                <TelecofCallRow
                  key={event.id}
                  event={event}
                  selected={selected}
                  onSelect={onSelect}
                />
              ) : (
                <TelecofCallCard
                  key={event.id}
                  event={event}
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
