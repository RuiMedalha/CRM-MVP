import { Search } from "lucide-react"
import { useInboxFilterStore } from "@/store/inboxFilterStore"
import type { TelecofQueueFilter } from "@/types/communication"

const QUEUE_TABS: { id: TelecofQueueFilter; label: string }[] = [
  { id: "open", label: "Abertas" },
  { id: "unhandled", label: "Não tratadas" },
  { id: "in_progress", label: "Em tratamento" },
  { id: "resolved", label: "Tratadas" },
  { id: "spam", label: "Publicidade" },
  { id: "deleted", label: "Apagadas" },
  { id: "all", label: "Todas" },
]

export function TelecofInboxFilters() {
  const { telecofQueueFilter, searchQuery, setTelecofQueueFilter, setSearchQuery } =
    useInboxFilterStore()

  return (
    <div className="space-y-3 border-b border-border bg-card px-3 py-3">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {QUEUE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTelecofQueueFilter(tab.id)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              telecofQueueFilter === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-primary/5 text-primary ring-1 ring-primary/20 hover:bg-primary/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Telefone ou agente…"
          className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  )
}
