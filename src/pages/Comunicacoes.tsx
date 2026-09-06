import React, { Suspense, useCallback, useEffect, useState } from "react"
import { MessagesSquare } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { ErrorBoundary } from "@/components/ErrorBoundary"

import {
  ComunicacoesChannelsSidebar,
  type ComunicacoesChannelId,
} from "@/components/communications/ComunicacoesChannelsSidebar"
import { TelecofAttendanceWorkbench } from "@/components/communications/TelecofAttendanceWorkbench"
import { InboxLeftColumn } from "@/components/communications/InboxLeftColumn"
// Fase 4 do F-MOBILE-COMMS-PERF: o thread é o componente mais pesado da
// página (MessageList, polling, attachments, customer360 panel, emoji
// picker...). Carrega-lo lazy reduz o bundle inicial em ~80KB e acelera o
// first paint do inbox em mobile. Só faz sentido carregar lazy porque a
// vista de canal-picker (sem thread) é o estado inicial — não escolhemos
// uma conversa por defeito.
const HubConversationView = React.lazy(() =>
  import("@/components/communications/HubConversationView").then((m) => ({ default: m.HubConversationView })),
)

function HubThreadFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30 p-6">
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        A abrir conversa…
      </div>
    </div>
  )
}

import { useCommunicationNotifications } from "@/hooks/useCommunicationNotifications"
import { useConversationPolling } from "@/hooks/useConversationPolling"

import { useInboxFilterStore } from "@/store/inboxFilterStore"
import { useConversationStore } from "@/store/conversationStore"

import { cn } from "@/lib/utils"

const communicationChannelIds: readonly ComunicacoesChannelId[] = [
  "whatsapp",
  "wa918",
  "waha",
  "wa913",
  "telecof",
  "askme",
  "grupos",
]

const compactChannelOptions: Array<{ id: ComunicacoesChannelId; label: string }> = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "wa918", label: "WA·918" },
  { id: "waha", label: "WA·916" },
  { id: "wa913", label: "WA·913" },
  { id: "telecof", label: "Telecof" },
  { id: "askme", label: "Chat do site" },
  { id: "grupos", label: "Grupos" },
]

function getChannelFromSearchParam(channel: string | null): ComunicacoesChannelId | null {
  return communicationChannelIds.includes(channel as ComunicacoesChannelId)
    ? channel as ComunicacoesChannelId
    : null
}

function HubInboxView({ hasSelection }: { hasSelection: boolean }) {
  return (
    /* Em landscape phone (altura <500px) com thread seleccionada, escondemos
       a lista de conversas e damos toda a largura à thread. Em desktop (lg+)
       mantemos o split lado-a-lado. O resultado: iPhone horizontal com
       844x390 mostra thread a 768x254px em vez de split a 384x254px — cabem
       ~6 mensagens em vez de 2-3, e o composer fica visível. */
    <div className="crm-landscape-two-pane flex min-h-0 flex-1 overflow-hidden">
      {/* Lista de conversas — em landscape phone esconde-se quando há selecção.
           Componente recebe classes via CSS @media landscape curto no index.css */}
      <div className={cn(
        "w-full shrink-0 flex-col border-r border-border lg:flex lg:w-72 crm-hub-list",
        hasSelection ? "hidden" : "flex",
      )}>
        <InboxLeftColumn />
      </div>
      {/* Thread — em landscape phone toma toda a largura quando há selecção.
           O overflow-hidden corta o flex-1 quando o pai é muito estreito
           (1024x600 com lista 288px + gap 16 + chat 296px). Usar overflow-y-auto
           para manter o scroll interno mas permitir que filhos se expandam
           em largura. */}
      <div className={cn(
        "min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:flex crm-hub-thread",
        hasSelection ? "flex" : "hidden",
      )}>
        <ErrorBoundary>
          <Suspense fallback={<HubThreadFallback />}>
            <HubConversationView />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default function Comunicacoes() {
  useCommunicationNotifications()
  useConversationPolling()

  const [searchParams, setSearchParams] = useSearchParams()
  const requestedChannel = getChannelFromSearchParam(searchParams.get("channel"))
  const [activeChannel, setActiveChannel] = useState<ComunicacoesChannelId>(() => requestedChannel ?? "whatsapp")
  const setInboxViewMode = useInboxFilterStore((s) => s.setInboxViewMode)
  const setMessageChannelScope = useInboxFilterStore((s) => s.setMessageChannelScope)
  const setActiveTab = useInboxFilterStore((s) => s.setActiveTab)
  const hasSelection = useConversationStore((s) => Boolean(s.selectedConversationId))

  /**
   * Aplica o canal à vista actual. Se `syncUrl=true` (caso normal: clique
   * do utilizador), escreve `?channel=…` na URL — preservando outros params.
   * Se `syncUrl=false` (synced a partir da URL), não volta a escrever para
   * evitar loop.
   */
  const applyChannel = useCallback(
    (channel: ComunicacoesChannelId, syncUrl: boolean) => {
      setActiveChannel((prev) => (prev === channel ? prev : channel))

      if (channel === "telecof") {
        setInboxViewMode("telecof_calls")
      } else {
        setInboxViewMode("conversations")
        if (channel === "grupos") {
          setActiveTab("groups")
          setMessageChannelScope("whatsapp")
        } else {
          setActiveTab("all")
          const channelConfig: Partial<Record<ComunicacoesChannelId, { channel: string; instance?: string }>> = {
            whatsapp: { channel: "whatsapp" },
            wa918: { channel: "whatsapp", instance: "hotelequip-918" },
            waha: { channel: "whatsapp", instance: "hotelequip-916" },
            wa913: { channel: "whatsapp", instance: "hotelequip-913" },
            askme: { channel: "askme" },
          }
          const config = channelConfig[channel]
          if (config) {
            setMessageChannelScope(
              config.channel as import("@/types/communication").CommunicationChannel,
              config.instance,
            )
          }
        }
      }

      if (syncUrl) {
        const nextParams = new URLSearchParams(searchParams)
        if (channel === "whatsapp") {
          nextParams.delete("channel")
        } else {
          nextParams.set("channel", channel)
        }
        if (nextParams.toString() !== searchParams.toString()) {
          setSearchParams(nextParams, { replace: true })
        }
      }
    },
    [setInboxViewMode, setMessageChannelScope, setActiveTab, searchParams, setSearchParams],
  )

  /** Handler invocado pela sidebar: muda canal + escreve URL. */
  const handleChannelChange = useCallback(
    (channel: ComunicacoesChannelId) => {
      applyChannel(channel, true)
    },
    [applyChannel],
  )

  /**
   * Sincroniza URL → estado sempre que o query param `channel` muda
   * (incluindo para ausente → fallback para "whatsapp"). Sem isto, navegar
   * de ?channel=telecof para a URL base (?channel= removido) não reagia.
   */
  useEffect(() => {
    const nextChannel: ComunicacoesChannelId = requestedChannel ?? "whatsapp"
    applyChannel(nextChannel, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedChannel])

  return (
    <AppLayout fullHeight>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <header className="crm-communications-header relative z-[50] flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <MessagesSquare className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground">Comunicações</h1>
              <p className="truncate text-xs text-muted-foreground">Inbox omnicanal</p>
            </div>
          </div>
        </header>

        {/* O sidebar é escondido globalmente em landscape curto para preservar altura.
            Este selector mantém a fila Telecof e as conversas alcançáveis nesse formato. */}
        <label className="hidden shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground [@media(orientation:landscape)_and_(max-height:500px)]:flex">
          Canal
          <select
            value={activeChannel}
            onChange={(event) => handleChannelChange(event.target.value as ComunicacoesChannelId)}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            aria-label="Canal de comunicação"
          >
            {compactChannelOptions.map((channel) => (
              <option key={channel.id} value={channel.id}>{channel.label}</option>
            ))}
          </select>
        </label>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Sidebar de canais — desktop (lg+) */}
          <ComunicacoesChannelsSidebar
            activeChannel={activeChannel}
            onChannelChange={handleChannelChange}
            className="hidden lg:flex lg:w-[220px] xl:w-[240px]"
          />

          {/* Sidebar de canais — mobile/tablet horizontal (visível quando não há thread aberta) */}
          {!hasSelection && (
            <ComunicacoesChannelsSidebar
              activeChannel={activeChannel}
              onChannelChange={handleChannelChange}
              layout="horizontal"
              className="lg:hidden"
            />
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {activeChannel === "telecof" ? (
              <TelecofAttendanceWorkbench />
            ) : (
              <HubInboxView hasSelection={hasSelection} />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
