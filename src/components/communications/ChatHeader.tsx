import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ExternalLink, Plus, Users, Bot } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

import { ConversationStatusBadge } from "./ConversationStatusBadge"
import { getChannelVisual } from "@/lib/channelRegistry"
import { isWhatsAppGroupConversation } from "@/lib/whatsappConversation"
import { findStoredConversation, useConversationStore } from "@/store/conversationStore"
import { useConversationOperations } from "@/hooks/useConversationOperations"
import { getContactById } from "@/integrations/directus/contacts"
import { findContactByPhone } from "@/integrations/directus/contactLookup"

function conversationPhone(conversation: { source?: string; visitorId?: string; customerName?: string }) {
  const raw = conversation.source ?? conversation.visitorId ?? conversation.customerName ?? ""
  const metaPhone = raw.match(/^meta:[^:]+:(\d{7,15})$/)?.[1]
  const digits = (metaPhone ?? raw.replace(/@.*$/, "")).replace(/\D/g, "")
  return digits.length >= 7 ? `+${digits}` : ""
}

/**
 * H2 — Hospitality booking context (Padrão Mews/Guesty).
 * Mostra no header a reserva ativa do contacto: número curto + check-in.
 * Em produção virá do Directus (collection `reservas` filtrada por contacto);
 * por agora usamos mock hardcoded para validar o visual.
 */
export type ChatHeaderBooking = {
  id: string
  checkIn: Date
  checkOut?: Date
}

function formatBookingDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}`
}

function BookingContextLine({ booking }: { booking: ChatHeaderBooking }) {
  return (
    <span className="hidden landscape-short:inline font-normal text-muted-foreground ml-1.5">
      · Reserva #{booking.id} · Check-in {formatBookingDate(booking.checkIn)}
    </span>
  )
}

export function ChatHeader({ booking }: { booking?: ChatHeaderBooking } = {}) {
  const selectedConversationId = useConversationStore((s) => s.selectedConversationId)
  const selectConversation = useConversationStore((s) => s.selectConversation)
  const conversation = useConversationStore((s) =>
    findStoredConversation(s, selectedConversationId),
  )

  const ops = useConversationOperations(conversation)
  const phone = conversation ? conversationPhone(conversation) : ""

  // H2 — mock booking data (Directus integration a fazer).
  // Activado apenas quando o caller não passa `booking` (ex.: Storybook/dev).
  // Para forçar mock na thread actual basta passar `booking` ao componente.
  const effectiveBooking: ChatHeaderBooking | undefined =
    booking ??
    ({
      id: "1234",
      checkIn: new Date(2026, 2, 15), // 15/03
    } as ChatHeaderBooking | undefined)
  const { data: phoneContactId } = useQuery({
    queryKey: ["conversation-contact-by-phone", phone],
    queryFn: () => findContactByPhone(phone),
    enabled: Boolean(conversation && !conversation.contactId && phone),
    staleTime: 60_000,
  })
  const resolvedContactId = conversation?.contactId ?? phoneContactId ?? undefined
  const { data: contact } = useQuery({
    queryKey: ["conversation-header-contact", resolvedContactId],
    queryFn: () => getContactById(resolvedContactId!),
    enabled: Boolean(resolvedContactId),
    staleTime: 60_000,
  })

  // Fix #2: usar instanceName para resolver canal específico (916/918/913)
  const channelKey = conversation
    ? (conversation.channel === "whatsapp" && conversation.instanceName
        ? `whatsapp_${conversation.instanceName.replace(/^hotelequip-/, "")}`
        : conversation.channel)
    : ""
  const channelVisual = conversation ? getChannelVisual(channelKey) : null
  const ChannelIcon = channelVisual?.Icon
  const isGroup = conversation ? isWhatsAppGroupConversation(conversation) : false

  if (!conversation) return null

  const isClosed = conversation.status === "closed"
  const contactName = contact?.company_name ?? contact?.contact_name ?? conversation.customerName
  const contactUrl = resolvedContactId
    ? `/customer360-shell/${encodeURIComponent(String(resolvedContactId))}`
    : null
  const createUrl = phone
    ? `/customer360-shell/novo?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(conversation.customerName)}`
    : "/customer360-shell/novo"

  const isBotActive =
    conversation.status === "ai_active" ||
    conversation.mode === "bot" ||
    Boolean(conversation.aiEnabled)

  return (
    <header className="crm-chat-header border-b border-border bg-card px-4 py-3 shrink-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Botão voltar — mobile only */}
            <button
              type="button"
              onClick={() => selectConversation(undefined)}
              className="lg:hidden -ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
              aria-label="Voltar à lista de conversas"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {isGroup ? (
              <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            ) : null}
            {contactUrl ? (
              <Link
                to={contactUrl}
                className="truncate font-semibold text-base text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Abrir ficha completa do cliente"
              >
                {contactName || "Cliente"}
              </Link>
            ) : (
              <h2 className="truncate font-semibold text-base text-foreground">
                {contactName || phone || "Conversa"}
                {/* Em landscape phone (altura ≤500px) mostramos o telefone
                   como linha secundária na mesma row do nome — resolve
                   directamente "não se vê número de telefone". Usa a classe
                   custom landscape-short definida em tailwind.config.ts. */}
                {phone && (
                  <span className="hidden landscape-short:inline font-normal text-muted-foreground ml-1.5">
                    · {phone}
                  </span>
                )}
                {/* H2 — booking context (Mews/Guesty pattern).
                   Só visível em landscape-short, depois do nome + telefone. */}
                {effectiveBooking && <BookingContextLine booking={effectiveBooking} />}
              </h2>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {channelVisual && ChannelIcon && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
                style={{
                  color: channelVisual.color,
                  backgroundColor: `${channelVisual.color}18`,
                }}
              >
                <ChannelIcon className="h-3.5 w-3.5" aria-hidden />
                {isGroup ? "Grupo WhatsApp" : channelVisual.label}
              </span>
            )}
            <ConversationStatusBadge conversation={conversation} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão claro e visível de Piloto Automático na conversa atual */}
          <button
            type="button"
            disabled={ops.busy}
            onClick={() => {
              if (isBotActive) {
                ops.assume()
              } else {
                ops.reactivate()
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition shadow-xs",
              isBotActive
                ? "border-emerald-500/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                : "border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            )}
            title={
              isBotActive
                ? "Piloto Automático da IA ATIVO nesta conversa. Clique para passar a atendimento manual."
                : "Atendimento MANUAL. Clique para ligar o Piloto Automático da IA nesta conversa."
            }
          >
            <Bot className={cn("h-4 w-4", isBotActive ? "text-emerald-600 dark:text-emerald-400 animate-pulse" : "text-amber-600 dark:text-amber-400")} />
            <span>Neste Chat:</span>
            <span
              className={cn(
                "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded",
                isBotActive ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black" : "bg-amber-600 text-white"
              )}
            >
              {isBotActive ? "IA LIGADA" : "MANUAL"}
            </span>
          </button>

          {ops.canClose && (
            <button
              type="button"
              disabled={ops.busy}
              onClick={ops.close}
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
            >
              Fechar
            </button>
          )}

          {ops.canReopen && (
            <button
              type="button"
              disabled={ops.busy}
              onClick={ops.reopen}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
            >
              Reabrir
            </button>
          )}

          {contactUrl ? (
            <Link
              to={contactUrl}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="sm:hidden">Ver ficha</span>
              <span className="hidden sm:inline">Abrir ficha</span>
            </Link>
          ) : (
            <Link
              to={createUrl}
              className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Criar contacto
            </Link>
          )}
        </div>
      </div>

      {isClosed && (
        <div className="mt-2 rounded-lg border border-muted bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Esta conversa está fechada. Podes reabri-la para enviar novas mensagens.
        </div>
      )}
    </header>
  )
}
