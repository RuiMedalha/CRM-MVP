import { Search } from "lucide-react"
import { getInboxChannelOptions } from "@/lib/channelRegistry"
import { QUICK_TAGS, QUICK_TAG_COLORS } from "@/lib/quickConversationTags"
import { useInboxFilterStore } from "@/store/inboxFilterStore"
import type { InboxStatusFilter } from "@/types/communication"

const STATUS_OPTIONS: { id: InboxStatusFilter; label: string }[] = [
  { id: "all_open", label: "Abertas" },
  { id: "mine", label: "Minhas" },
  { id: "unassigned", label: "Não atribuídas" },
  { id: "ai_active", label: "IA ativa" },
  { id: "human", label: "Humano" },
  { id: "closed", label: "Fechadas" },
]

function isStatusActive(statusFilter: InboxStatusFilter, showArchive: boolean, opt: InboxStatusFilter): boolean {
  if (showArchive) return false
  return statusFilter === opt
}

export function InboxFiltersBar({ hideChannelFilters = false }: { hideChannelFilters?: boolean }) {
  const {
    activeTab,
    statusFilter,
    channelFilters,
    tagFilters,
    unreadOnly,
    noContactOnly,
    showArchive,
    searchQuery,
    setActiveTab,
    setStatusFilter,
    toggleChannelFilter,
    toggleTagFilter,
    setUnreadOnly,
    setNoContactOnly,
    setShowArchive,
    setSearchQuery,
  } = useInboxFilterStore()

  const channels = getInboxChannelOptions().filter((c) => c.inboxVisible)

  return (
    <div className="crm-inbox-filters-bar space-y-3 border-b border-border bg-card px-3 py-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Pesquisar conversas…"
          aria-label="Pesquisar conversas" /* S1 BLOCKER a11y: placeholder não substitui label */
          className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => {
            setActiveTab("inbox")
            const next = !showArchive
            setShowArchive(next)
            if (!next) setStatusFilter("all_open")
          }}
          className={`min-w-0 truncate rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            activeTab === "inbox" && showArchive
              ? "bg-foreground text-white"
              : "bg-muted text-muted-foreground hover:bg-muted"
          }`}
        >
          Arquivo
        </button>

        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setActiveTab("inbox")
              setShowArchive(false)
              setStatusFilter(opt.id)
            }}
            className={`min-w-0 truncate rounded-full px-2.5 py-1 text-xs font-medium transition ${
              activeTab === "inbox" && isStatusActive(statusFilter, showArchive, opt.id)
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setActiveTab("groups")}
          className={`min-w-0 truncate rounded-full px-3 py-1 text-xs font-medium transition ${
            activeTab === "groups"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          Grupos
        </button>
      </div>

      {!hideChannelFilters && (
        /* Channel filters: scroll horizontal em mobile (whatsapp/wa918/wa916/
           wa913/telecof/askme/grupos = 7 chips, overflow-x-auto permite
           scrollar; em desktop continua a fazer wrap com flex-wrap md:). */
        <div className="flex flex-nowrap gap-1 overflow-x-auto scrollbar-thin md:flex-wrap">
          {channels.map((ch) => {
            const active = channelFilters.includes(ch.key)
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggleChannelFilter(ch.key)}
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset transition whitespace-nowrap"
                style={{
                  backgroundColor: active ? ch.color : undefined,
                  color: active ? "#fff" : ch.color,
                  borderColor: ch.color,
                }}
              >
                {ch.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {QUICK_TAGS.map((tag) => {
          const active = tagFilters.includes(tag.id)
          const hex = QUICK_TAG_COLORS[tag.color]
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                setActiveTab("inbox")
                toggleTagFilter(tag.id)
              }}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition ${active ? "text-white" : ""}`}
              style={{
                backgroundColor: active ? hex : `${hex}18`,
                color: active ? "#fff" : hex,
                borderColor: `${hex}44`,
              }}
            >
              {tag.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded border-border"
          />
          Não lidas
        </label>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={noContactOnly}
            onChange={(e) => setNoContactOnly(e.target.checked)}
            className="rounded border-border"
          />
          Sem contacto
        </label>
      </div>
    </div>
  )
}
