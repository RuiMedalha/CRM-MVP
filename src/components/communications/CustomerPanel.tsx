import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"

import { DIRECTUS_URL } from "@/integrations/directus/client"
import { updateConversation, markConversationAsRead } from "@/integrations/directus/hubConversations"
import { crmDashboard360Url } from "@/lib/crmUrls"
import { ConversationStatusBadge } from "./ConversationStatusBadge"
import { useAuth } from "@/contexts/AuthContext"

import { useConversationStore } from "@/store/conversationStore"

import type { Conversation } from "@/types/conversation"

function InfoRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  const display = value === undefined || value === null || value === "" ? "—" : String(value)
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="break-all text-right text-foreground">{display}</span>
    </div>
  )
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })
}

interface Props {
  conversation?: Conversation
}

export function CustomerPanel({ conversation }: Props) {
  const { user } = useAuth()
  const mergeConversation = useConversationStore((s) => s.mergeConversation)
  const [assignedTo, setAssignedTo] = useState(conversation?.assignedTo ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAssignedTo(conversation?.assignedTo ?? "")
  }, [conversation?.id, conversation?.assignedTo])

  async function handleAssume() {
    if (!conversation || !DIRECTUS_URL) return
    setSaving(true)
    try {
      const updated = await updateConversation(conversation.id, {
        status: "human_active",
        mode: "human",
        ai_enabled: false,
        assigned_to: user?.id || "Rui",
        updated_at: new Date().toISOString(),
      })
      mergeConversation(updated)
      setAssignedTo(user?.id || "Rui")
    } catch (e) {
      console.warn("[CustomerPanel] assume failed", e)
    } finally {
      setSaving(false)
    }
  }

  async function handleClose() {
    if (!conversation || !DIRECTUS_URL) return
    setSaving(true)
    try {
      const updated = await updateConversation(conversation.id, {
        status: "closed",
        ai_enabled: false,
        unread_count: 0,
        updated_at: new Date().toISOString(),
      })
      mergeConversation(updated)
    } catch (e) {
      console.warn("[CustomerPanel] close failed", e)
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkRead() {
    if (!conversation || !DIRECTUS_URL) return
    try {
      const updated = await markConversationAsRead(conversation.id)
      mergeConversation(updated)
    } catch (e) {
      console.warn("[CustomerPanel] mark read failed", e)
    }
  }

  return (
    <aside className="hidden min-w-[18rem] max-w-[32rem] flex-[0_0_28%] shrink-0 flex-col overflow-y-auto border-l border-border bg-card md:flex">
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Cliente 360</h2>
            <p className="mt-1 text-xs text-muted-foreground">Dados da conversa · CRM Directus</p>
          </div>
          {conversation && <ConversationStatusBadge conversation={conversation} />}
        </div>
      </div>

      {!conversation ? (
        <p className="p-4 text-sm text-muted-foreground">Selecione uma conversa.</p>
      ) : (
        <>
          <section className="space-y-2 border-b border-border p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conversa
            </h3>
            <InfoRow label="Nome" value={conversation.customerName} />
            <InfoRow label="Canal" value={conversation.channel} />
            <InfoRow label="Estado" value={conversation.status} />
            <InfoRow label="Atribuído" value={conversation.assignedTo} />
            <InfoRow label="Não lidas" value={conversation.unreadCount} />
            <InfoRow label="Criada" value={formatDateTime(conversation.createdAt)} />
            <InfoRow label="Atualizada" value={formatDateTime(conversation.updatedAt)} />
            {conversation.contactId && (
              <InfoRow label="Contact ID" value={conversation.contactId} />
            )}
          </section>

          <section className="space-y-2 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ações
            </h3>

            <div className="flex flex-col gap-2">
              {(conversation.status === "ai_active" || conversation.status === "handoff" || conversation.status === "open") && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleAssume()}
                  className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  Assumir conversa
                </button>
              )}

              {conversation.unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkRead()}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Marcar como lida
                </button>
              )}

              {conversation.status !== "closed" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleClose()}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Fechar conversa
                </button>
              )}

              {conversation.contactId && (
                <a
                  href={crmDashboard360Url(conversation.contactId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir CRM 360
                </a>
              )}
            </div>
          </section>
        </>
      )}
    </aside>
  )
}
