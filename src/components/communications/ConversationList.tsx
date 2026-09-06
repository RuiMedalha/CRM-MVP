import { useEffect, useMemo, useRef, useState } from "react"
import { Bot, Plus } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useWhatsAppAutoResponder } from "@/hooks/useWhatsAppAutoResponder"
import { cn } from "@/lib/utils"

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
  const { autoAiActive, autoAiMode, setAutoAiMode } = useWhatsAppAutoResponder()
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
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const nextMode =
                  autoAiMode === "off" ? "always" : autoAiMode === "always" ? "out_of_hours" : "off"
                setAutoAiMode(nextMode)
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition shadow-xs",
                autoAiMode === "always"
                  ? "border-emerald-500/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                  : autoAiMode === "out_of_hours"
                    ? "border-indigo-500/50 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 ring-1 ring-indigo-500/30"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
              title={
                autoAiMode === "always"
                  ? "Piloto Geral: SEMPRE ATIVO (24/7). Clique para mudar para 'Apenas Fora de Horas'."
                  : autoAiMode === "out_of_hours"
                    ? "Piloto Geral: APENAS FORA DE HORAS. Clique para Pausar."
                    : "Piloto Geral: PAUSADO (pode ligar individualmente em cada chat). Clique para Ativar a Todos."
              }
            >
              <Bot
                className={cn(
                  "h-3.5 w-3.5",
                  autoAiMode === "always"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : autoAiMode === "out_of_hours"
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-muted-foreground",
                )}
              />
              <span className="text-[11px] font-medium">Piloto Geral:</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded",
                  autoAiMode === "always"
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black"
                    : autoAiMode === "out_of_hours"
                      ? "bg-indigo-600 text-white"
                      : "bg-muted text-muted-foreground border border-border",
                )}
              >
                {autoAiMode === "always" ? "TODOS" : autoAiMode === "out_of_hours" ? "FORA DE HORAS" : "PAUSADO"}
              </span>
            </button>

            {hasMessageScope && (
              <button
                type="button"
                onClick={clearMessageScope}
                className="text-xs font-medium text-blue-600 hover:underline px-1"
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
        <div className="flex flex-col gap-3 p-3 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Linhas WhatsApp (3 Números)
            </p>
            <div className="space-y-1.5">
              {[
                { key: "whatsapp_916", instance: "hotelequip-916", label: "WhatsApp 916 · Comercial", subtitle: "+351 916 542 271 (Evolution)" },
                { key: "whatsapp_918", instance: "hotelequip-918", label: "WhatsApp 918 · Suporte", subtitle: "+351 918 000 000 (Evolution)" },
                { key: "whatsapp_913", instance: "hotelequip-913", label: "WhatsApp 913 · Oficial WABA", subtitle: "+351 913 866 565 (Meta Cloud)" },
                { key: "whatsapp", instance: undefined, label: "Todas as conversas WhatsApp", subtitle: "Ver todos os números unificados" },
              ].map((waOpt) => {
                const v = getChannelVisual(waOpt.key)
                return (
                  <button
                    key={waOpt.key}
                    type="button"
                    onClick={() => {
                      setActiveTab("inbox")
                      setMessageChannelScope("whatsapp" as any, waOpt.instance)
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-2.5 text-left transition hover:border-primary/40 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <v.Icon className="h-4 w-4 shrink-0" style={{ color: v.color }} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{waOpt.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{waOpt.subtitle}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Outros Canais & Grupos
            </p>
            <div className="space-y-1.5">
              {[
                { key: "askme", label: "AskMe (Site / Chat)" },
                { key: "email", label: "Email" },
              ].map((ch) => {
                const v = getChannelVisual(ch.key)
                return (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => {
                      setActiveTab("inbox")
                      setMessageChannelScope(ch.key as import("@/types/communication").CommunicationChannel)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-muted/50 transition"
                  >
                    <v.Icon className="h-4 w-4 shrink-0" style={{ color: v.color }} />
                    {ch.label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setActiveTab("groups")}
                className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-muted/50 transition"
              >
                Grupos WhatsApp
              </button>
            </div>
          </div>
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
