import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { MessagesSquare, PanelRightClose, PanelRightOpen } from "lucide-react"

import { ChatHeader } from "./ChatHeader"
import { ConversationTags } from "./ConversationTags"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { ComunicacoesCliente360Panel } from "./ComunicacoesCliente360Panel"

import { useConversationPolling } from "@/hooks/useConversationPolling"
import { useMessagePolling } from "@/hooks/useMessagePolling"
import { useConversationStore, findStoredConversation } from "@/store/conversationStore"
import { getContactById } from "@/integrations/directus/contacts"
import { findContactByPhone } from "@/integrations/directus/contactLookup"

function extractPhone(conversation?: { source?: string; visitorId?: string; customerName?: string }): string {
  if (!conversation) return ""
  const raw = conversation.source ?? conversation.visitorId ?? conversation.customerName ?? ""
  const metaPhone = raw.match(/^meta:[^:]+:(\d{7,15})$/)?.[1]
  const digits = (metaPhone ?? raw.replace(/@.*$/, "")).replace(/\D/g, "")
  return digits.length >= 7 ? `+${digits}` : ""
}

export function HubConversationView() {
  useConversationPolling()
  useMessagePolling()

  const [panelVisible, setPanelVisible] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768
  )

  const selectedId = useConversationStore((s) => s.selectedConversationId)
  const conversation = useConversationStore((s) =>
    findStoredConversation(s, selectedId),
  )

  const phone = conversation ? extractPhone(conversation) : ""

  const { data: phoneContactId } = useQuery({
    queryKey: ["conversation-contact-by-phone", phone],
    queryFn: () => findContactByPhone(phone),
    enabled: Boolean(conversation && !conversation.contactId && phone),
    staleTime: 60_000,
  })

  const effectiveContactId = conversation?.contactId || phoneContactId || ""

  const {
    data: contact = null,
    isLoading: contactLoading,
    error: contactError,
  } = useQuery({
    queryKey: ["contact-360", effectiveContactId],
    queryFn: () => getContactById(effectiveContactId),
    enabled: Boolean(effectiveContactId),
    staleTime: 60_000,
  })

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Área principal de chat — overflow-y-auto (era overflow-hidden)
          para que o composer com position:sticky bottom:0 funcione em
          portrait mobile (sem isto, em portrait o composer é empurrado
          para fora do viewport pelo scroll do <main> e tapado pela bottom-nav).
          Trade-off: o scroll fica nested (pai <MessageList>); o pai
          também scrolla, mas o composer mantém-se sticky. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {conversation ? (
          <>
            {/* Header com botão de toggle do painel 360 */}
            <div className="relative shrink-0">
              <ChatHeader />
              <button
                type="button"
                onClick={() => setPanelVisible((v) => !v)}
                title={panelVisible ? "Fechar ficha 360" : "Abrir ficha 360"}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted z-10"
              >
                {panelVisible
                  ? <PanelRightClose className="h-4 w-4" />
                  : <PanelRightOpen className="h-4 w-4" />
                }
              </button>
            </div>
            <MessageList />
            {/* Tags e nota interna — JUNTO ao input, acima do campo de escrita */}
            <ConversationTags conversation={conversation} />
            <MessageInput />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center bg-muted/20">
            <MessagesSquare className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-base font-medium text-muted-foreground">
              Selecciona uma conversa
            </p>
            <p className="text-sm text-muted-foreground/70">
              Escolhe na coluna à esquerda para ver as mensagens
            </p>
          </div>
        )}
      </div>

      {/* Backdrop mobile para painel 360 */}
      {panelVisible && conversation && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 md:hidden"
          onClick={() => setPanelVisible(false)}
          aria-hidden
        />
      )}

      {/* Ficha 360 — overlay no mobile, inline no desktop */}
      {panelVisible && conversation && (
        <ComunicacoesCliente360Panel
          contactId={effectiveContactId || undefined}
          contact={contact}
          contactLoading={contactLoading}
          contactError={contactError ? String(contactError) : null}
          conversationPhone={phone || conversation?.source || conversation?.customerName}
          conversationName={contact?.company_name || contact?.contact_name || conversation?.customerName}
          conversationId={selectedId ?? undefined}
          conversation={conversation ?? undefined}
          className="fixed inset-y-0 right-0 z-[60] w-[88%] max-w-sm shadow-2xl md:static md:z-auto md:w-72 md:max-w-none md:shadow-none xl:w-80"
        />
      )}
    </div>
  )
}
