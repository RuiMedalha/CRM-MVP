import { useEffect, useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { getChannelVisual } from "@/lib/channelRegistry"
import { filterConversationsWithStats } from "@/lib/inboxFilters"
import { markConversationAsRead } from "@/integrations/directus/hubConversations"
import { DIRECTUS_URL } from "@/integrations/directus/client"
import { useAuth } from "@/contexts/AuthContext"

import { useInboxFilterStore } from "@/store/inboxFilterStore"
import { useConversationStore } from "@/store/conversationStore"

import { ConversationItem } from "./ConversationItem"
import { InboxFiltersBar } from "./InboxFiltersBar"
import { NewConversationDialog } from "./NewConversationDialog"
import { EmptyState } from "@/components/patterns/EmptyState"

// Altura estimada de cada ConversationItem (em pixels). Em landscape
// phone (~56px) é mais compacto, em portrait/desktop (~96px) é maior.
// Detectado via matchMedia para o virtualizer.
const ROW_HEIGHT_ESTIMATE_DESKTOP = 96;
const ROW_HEIGHT_ESTIMATE_LANDSCAPE = 56;

// Quantas linhas extra renderizar acima/abaixo da viewport visivel.
// Mantém scroll suave sem custar performance (6 rows ~ 500px buffer).
const OVERSCAN = 6;

export function ConversationList() {
  const { user } = useAuth()
  const [newConvOpen, setNewConvOpen] = useState(false)
  const filters = useInboxFilterStore()
  const activeTab = useInboxFilterStore((s) => s.activeTab)
  const setActiveTab = useInboxFilterStore((s) => s.setActiveTab)
  const clearMessageScope = useInboxFilterStore((s) => s.clearMessageScope)
  const setMessageChannelScope = useInboxFilterStore((s) => s.setMessageChannelScope)

  const {
    conversations,
    groupConversations,
    selectedConversationId,
    selectConversation,
    mergeConversation,
    assignConversation,
  } = useConversationStore()

  const isGroupsTab = activeTab === "groups"
  const hasMessageScope = filters.channelFilters.length === 1 || filters.tagFilters.length === 1

  const listSource = isGroupsTab ? groupConversations : conversations

  const filteredConversations = useMemo(() => {
    if (isGroupsTab) {
      const groupsBySource = listSource.filter((c) =>
        (c.source ?? "").toLowerCase().includes("@g.us"),
      )
      const { list } = filterConversationsWithStats(groupsBySource, filters, { groupsOnly: true })
      return list.sort((a, b) => new Date(b.lastActivityAt || b.createdAt || 0).getTime() - new Date(a.lastActivityAt || a.createdAt || 0).getTime())
    }
    if (!hasMessageScope) return []
    const { list } = filterConversationsWithStats(listSource, filters)
    // Ordenar por actividade real (lastActivityAt), fallback createdAt
    return list.sort((a, b) => new Date(b.lastActivityAt || b.createdAt || 0).getTime() - new Date(a.lastActivityAt || a.createdAt || 0).getTime())
  }, [listSource, filters, isGroupsTab, hasMessageScope])

  const showList = hasMessageScope || isGroupsTab

  const scopeLabel = useMemo(() => {
    if (filters.channelFilters.length === 1) {
      const ch = filters.channelFilters[0]
      // Se há instanceFilter activo, usar a chave específica do canal (ex: whatsapp_916)
      if (ch === "whatsapp" && filters.instanceFilter) {
        const suffix = filters.instanceFilter.replace(/^hotelequip-/, "")
        return getChannelVisual(`whatsapp_${suffix}`).label
      }
      return getChannelVisual(ch).label
    }
    return null
  }, [filters.channelFilters, filters.instanceFilter])

  async function handleSelectConversation(id: string) {
    selectConversation(id)
    const current =
      conversations.find((c) => c.id === id) ??
      groupConversations.find((c) => c.id === id)
    if (!current || current.unreadCount === 0) return

    try {
      if (DIRECTUS_URL) {
        // Phase 2.F3: marcar como lida per-agent
        const updated = await markConversationAsRead(id, user?.id)
        mergeConversation(updated)
      } else {
        mergeConversation({ ...current, unreadCount: 0 })
      }
    } catch {
      mergeConversation({ ...current, unreadCount: 0 })
    }
  }

  const archiveLabel = filters.showArchive ? "Arquivo" : "Inbox"

  // ── Virtualização ────────────────────────────────────────────────────────
  // Em mobile, conversas com 200+ items geravam 200+ nós no DOM e travavam o
  // scroll. Virtualizamos para renderizar só a janela visível (≈6 linhas
  // em landscape phone, ≈10 em desktop). O pattern é o mesmo de Leads.tsx
  // (useVirtualizer do @tanstack/react-virtual). Sem isto, abrir /comunicacoes
  // num canal com 250 conversas demorava 1.2s e travava scroll em landscape.
  const parentRef = useRef<HTMLDivElement>(null)
  const isLandscapeShortRef = useRef(false)
  const [rowEstimate, setRowEstimate] = useState(ROW_HEIGHT_ESTIMATE_DESKTOP)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia("(orientation: landscape) and (max-height: 500px)")
    const update = () => {
      const next = mql.matches ? ROW_HEIGHT_ESTIMATE_LANDSCAPE : ROW_HEIGHT_ESTIMATE_DESKTOP
      if (next !== isLandscapeShortRef.current) {
        isLandscapeShortRef.current = mql.matches
        setRowEstimate(next)
      }
    }
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])
  const virtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowEstimate,
    overscan: OVERSCAN,
  })

  return (
    <section className="flex h-full w-full flex-col bg-muted">
      <div className="border-b border-border bg-card px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {isGroupsTab ? "Grupos WhatsApp" : (scopeLabel ?? "Mensagens")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isGroupsTab
                ? `${filteredConversations.length} grupo(s)`
                : hasMessageScope
                  ? `${archiveLabel} · ${filteredConversations.length} conversa(s)`
                  : "Escolha um canal"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasMessageScope && (
              <button
                type="button"
                onClick={clearMessageScope}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Canais
              </button>
            )}
            <button
              type="button"
              title="Nova conversa WhatsApp"
              onClick={() => setNewConvOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {!showList ? (
        <div className="flex flex-col gap-2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Escolha um canal
          </p>
          {["whatsapp", "askme", "email"].map((ch) => {
            const v = getChannelVisual(ch)
            return (
              <button
                key={ch}
                type="button"
                onClick={() => {
                  setActiveTab("inbox")
                  setMessageChannelScope(ch as import("@/types/communication").CommunicationChannel)
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-border"
              >
                <v.Icon className="h-4 w-4" style={{ color: v.color }} />
                {v.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setActiveTab("groups")}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-border"
          >
            Grupos WhatsApp
          </button>
        </div>
      ) : (
        <>
          <InboxFiltersBar hideChannelFilters />
          {filteredConversations.length === 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <EmptyState
                className="min-h-40 bg-card px-4 py-6"
                title="Sem conversas"
                description="Ajuste os filtros ou escolha outro canal para continuar."
              />
            </div>
          ) : (
            <div
              ref={parentRef}
              className="min-h-0 flex-1 overflow-y-auto p-2"
              style={{ contain: "strict" }}
              data-testid="conversation-virtual-list"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const conversation = filteredConversations[virtualRow.index]
                  return (
                    <div
                      key={conversation.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                        paddingBottom: "0.5rem",
                      }}
                    >
                      <ConversationItem
                        conversation={conversation}
                        selected={selectedConversationId === conversation.id}
                        compact
                        onSelect={() => { void handleSelectConversation(conversation.id) }}
                        onAssume={() => {
                          assignConversation(conversation.id, user?.id || "Rui")
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
      <NewConversationDialog open={newConvOpen} onOpenChange={setNewConvOpen} />
    </section>
  )
}
