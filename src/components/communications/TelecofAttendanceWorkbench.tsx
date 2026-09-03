import { ChevronLeft } from "lucide-react"

import { TelecofCallsList } from "./TelecofCallsList"
import { TelecofCallWorkspace } from "./TelecofCallWorkspace"
import { useTelecofCallStore } from "@/store/telecofCallStore"
import { useTelecofCallsPolling } from "@/hooks/useTelecofCallsPolling"
import { cn } from "@/lib/utils"

/**
 * Redesign landscape (redesign/telecof-landscape).
 *
 * Layout master-detail em duas colunas:
 *   [ lista 320px fixa ]  [ workspace flex-1 ]
 *
 * - Landscape (phone e iPad, >=700px de largura): split SEMPRE visível.
 *   O CSS em index.css (@media orientation:landscape and min-width:700px)
 *   força a lista a 320px e o workspace a flex-1, ocupando 100dvh e
 *   escondendo topbar/bottom-nav/headers globais.
 * - Portrait / ecrãs estreitos: navegação drill-down. A lista ocupa o
 *   ecrã todo; ao seleccionar uma chamada mostra o workspace com botão
 *   "Voltar".
 *
 * O detalhe é UM só painel: o TelecofCallWorkspace, que já traz header
 * compacto, identidade do chamador, histórico, resumo e composer sticky.
 * (O antigo TelecofCustomerPanel inline foi removido — duplicava o
 * conteúdo do Workspace e colapsava a altura útil em landscape.)
 *
 * Os dados (store, polling, patchs) NÃO são tocados: continuamos a usar
 * useTelecofCallStore e useTelecofCallsPolling tal como antes.
 */
export function TelecofAttendanceWorkbench() {
  useTelecofCallsPolling()

  const selectedEventId = useTelecofCallStore((s) => s.selectedEventId)
  const selectedEvent = useTelecofCallStore((s) =>
    s.events.find((e) => e.id === selectedEventId),
  )
  const clearSelection = () => useTelecofCallStore.getState().selectEvent(undefined)

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
