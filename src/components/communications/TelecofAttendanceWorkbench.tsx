import { useEffect, useRef } from "react"
import { ChevronLeft } from "lucide-react"

import { TelecofCallsList } from "./TelecofCallsList"
import { TelecofCallWorkspace } from "./TelecofCallWorkspace"
import { useTelecofCallStore } from "@/store/telecofCallStore"
import { useTelecofCallsPolling } from "@/hooks/useTelecofCallsPolling"
import { cn } from "@/lib/utils"

export function TelecofAttendanceWorkbench() {
  useTelecofCallsPolling()

  const selectedEventId = useTelecofCallStore((s) => s.selectedEventId)
  const events = useTelecofCallStore((s) => s.events)
  const selectEvent = useTelecofCallStore((s) => s.selectEvent)
  const hasInitializedSelectionRef = useRef(false)

  const selectedEvent = useTelecofCallStore((s) =>
    s.events.find((e) => e.id === selectedEventId),
  )
  const clearSelection = () => {
    hasInitializedSelectionRef.current = true
    useTelecofCallStore.getState().selectEvent(undefined)
  }

  // Auto-seleciona a primeira chamada apenas no carregamento inicial da página (uma única vez)
  useEffect(() => {
    if (!hasInitializedSelectionRef.current && events.length > 0) {
      hasInitializedSelectionRef.current = true
      if (!selectedEventId) {
        const firstUnhandled = events.find((e) => e.operationalStatus === "unhandled" || e.operationalStatus === "new" || e.operationalStatus === "missed") || events[0]
        if (firstUnhandled) {
          selectEvent(firstUnhandled.id)
        }
      }
    }
  }, [selectedEventId, events, selectEvent])

  const hasSelection = Boolean(selectedEvent)

  return (
    <div className="crm-landscape-workbench flex min-h-0 flex-1 overflow-hidden">
      {/* Coluna esquerda — lista de chamadas (320px fixa em landscape). */}
      <div
        className={cn(
          "crm-telecof-master min-h-0 shrink-0 flex-col border-r border-border bg-muted",
          hasSelection ? "hidden lg:flex" : "flex w-full",
          "lg:flex lg:w-80",
        )}
      >
        <TelecofCallsList />
      </div>

      {/* Coluna direita — workspace de detalhe + composer. */}
      <div
        className={cn(
          "crm-telecof-detail min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background",
          hasSelection ? "flex" : "hidden lg:flex",
        )}
      >
        {/* Botão voltar — só em drill-down (portrait / estreito). O CSS
            landscape esconde-o porque a lista está sempre visível. */}
        <button
          type="button"
          onClick={clearSelection}
          className="crm-telecof-back flex min-h-[44px] shrink-0 items-center gap-1 border-b border-border bg-card px-3 text-sm font-medium text-muted-foreground lg:hidden"
          aria-label="Voltar à fila de chamadas"
        >
          <ChevronLeft className="h-4 w-4" />
          Fila de chamadas
        </button>

        <TelecofCallWorkspace />
      </div>
    </div>
  )
}
