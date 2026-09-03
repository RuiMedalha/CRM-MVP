/**
 * Workspace central do Telecof — replica o HubChat:
 * - Detalhes da chamada
 * - Resumo / nota rápida
 * - Botões de ação: Assumir, Tratado, Publicidade, Reclamar, WhatsApp, Apagar, CRM
 */
import { useState, useMemo, useEffect } from "react"
import { ExternalLink, MessageCircle, Phone, Trash2, Clock, UserSearch, History } from "lucide-react"
import { Link } from "react-router-dom"

import { operationalStatusLabel } from "@/lib/telecofQueue"
import { crmDashboard360UrlForCall } from "@/lib/crmUrls"
import { useTelecofCallStore } from "@/store/telecofCallStore"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"
import { useAuth } from "@/contexts/AuthContext"
import { directusRequest } from "@/integrations/directus/client"
import { createFollowUp } from "@/integrations/directus/follow-ups"
import { useEmployees } from "@/hooks/useEmployees"
import { ProductSearchTab } from "@/components/contacts/ProductSearchTab"
import { TelecofLeadCapture } from "./TelecofLeadCapture"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function formatDateTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })
}

const QUICK_TAGS = ["Reclamar", "Orçamento", "Técnico", "Urgente"] as const

export function TelecofCallWorkspace() {
  const selected = useTelecofCallStore((s) =>
    s.events.find((e) => e.id === s.selectedEventId),
  )
  const mergeEvent = useTelecofCallStore((s) => s.mergeEvent)
  const removeEvent = useTelecofCallStore((s) => s.removeEventFromQueue)

  const { user } = useAuth()
  const agentName = user?.first_name ?? "Agente"
  const agentId = user?.id ?? ""
  const { data: employees = [] } = useEmployees()

  // Persistir rascunho da nota por chamada (não se perde ao navegar)
  const draftKey = selected ? `telecof_draft_${selected.id}` : ""
  const [summaryNote, setSummaryNote] = useState(() => {
    if (!draftKey) return ""
    return sessionStorage.getItem(draftKey) || ""
  })
  const [savingSummary, setSavingSummary] = useState(false)

  // Sync draft ao mudar de chamada
  useEffect(() => {
    if (draftKey) {
      const saved = sessionStorage.getItem(draftKey) || ""
      setSummaryNote(saved)
    } else {
      setSummaryNote("")
    }
  }, [draftKey])

  // Auto-save draft ao digitar (debounced)
  useEffect(() => {
    if (!draftKey) return
    const t = setTimeout(() => sessionStorage.setItem(draftKey, summaryNote), 500)
    return () => clearTimeout(t)
  }, [summaryNote, draftKey])
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirmCallback, setConfirmCallback] = useState(false)

  // Caller identification (POST /identify-contact)
  const [identity, setIdentity] = useState<{
    kind: "contact" | "lead" | "unknown"
    record?: Record<string, unknown>
    recentInteractions?: unknown[]
    openDealsRecords?: unknown[]
    openDeals?: number
    interactionCount?: number
    lastActivity?: string | null
  } | null>(null)
  const [identityLoading, setIdentityLoading] = useState(false)

  useEffect(() => {
    const phone = selected?.normalizedPhone || selected?.phone
    if (!phone) {
      setIdentity(null)
      return
    }
    let cancelled = false
    setIdentityLoading(true)
    setIdentity(null)
    void (async () => {
      try {
        // Consolidado: usa identifyByPhoneOrEmail (mesmo serviço que TelecofBanner)
        const { identifyByPhoneOrEmail } = await import("@/services/contactIdentification")
        const result = await identifyByPhoneOrEmail({ phone })
        if (cancelled) return
        // Buscar dados extra (deals, interações) se contacto encontrado
        let recentInteractions: unknown[] = []
        let openDealsRecords: unknown[] = []
        if (result.kind === "contact" && result.record?.id) {
          const contactId = result.record.id
          const [intRes, dealsRes] = await Promise.all([
            directusRequest<{ data: unknown[] }>(
              `/items/interactions?filter[contact_id][_eq]=${contactId}&sort=-date_created&limit=3&fields=id,type,summary,date_created`
            ).catch(() => ({ data: [] })),
            directusRequest<{ data: unknown[] }>(
              `/items/deals?filter[customer_id][_eq]=${contactId}&filter[status][_nin]=perdido&limit=5&fields=id,title,total_amount`
            ).catch(() => ({ data: [] })),
          ])
          recentInteractions = intRes.data ?? []
          openDealsRecords = dealsRes.data ?? []
        }
        if (!cancelled) {
          setIdentity({
            kind: result.kind,
            record: result.record ?? undefined,
            recentInteractions,
            openDealsRecords,
            openDeals: openDealsRecords.length,
            interactionCount: result.interactionCount,
            lastActivity: result.lastActivity,
          })
          setIdentityLoading(false)

          // Opção A: gravar nome no communication_event para a lista à esquerda actualizar
          if (result.kind !== "unknown" && result.record && selected) {
            const identifiedName = String(result.record.company_name || result.record.contact_name || result.record.name || "").trim()
            if (identifiedName && identifiedName !== selected.customerName) {
              patchHubCommunicationEvent(selected.id, {
                customer_name: identifiedName,
                ...(result.kind === "contact" ? { contact_id: String(result.record.id) } : {}),
              }).then((updated) => mergeEvent(updated)).catch(() => {})
            }
          }
        }
      } catch {
        if (!cancelled) { setIdentity({ kind: "unknown" }); setIdentityLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [selected?.id, selected?.normalizedPhone, selected?.phone])

  function showFeedback(msg: string) {
    setFeedback(msg)
    window.setTimeout(() => setFeedback(null), 3000)
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch {
      showFeedback("Erro ao executar ação.")
    } finally {
      setBusy(false)
    }
  }

  async function handleAssume() {
    if (!selected) return
    await run(async () => {
      const updated = await patchHubCommunicationEvent(selected.id, {
        status: "in_progress",
        claimed_at: new Date().toISOString(),
        assigned_to: agentId || agentName,
        agent_name: agentName,
      })
      mergeEvent(updated)
      showFeedback("Chamada assumida.")
    })
  }

  async function handleStatus(status: string, label: string) {
    if (!selected) return
    await run(async () => {
      const updated = await patchHubCommunicationEvent(selected.id, {
        status,
        resolved_at: new Date().toISOString(),
      })
      mergeEvent(updated)
      showFeedback(`Marcada como: ${label}`)
    })
  }

  // Phase 1.B3: "Reclamar" cria follow_up automático (due_at = +1h, status open)
  async function handleCallback() {
    if (!selected) return
    await run(async () => {
      const updated = await patchHubCommunicationEvent(selected.id, {
        status: "callback",
        resolved_at: new Date().toISOString(),
      })
      mergeEvent(updated)
      // Criar follow-up ligado ao contacto (se identificado) para aparecer na Agenda
      const contactId = selected.contactId
      if (contactId) {
        try {
          await createFollowUp({
            contact_id: contactId,
            type: "call",
            status: "open",
            title: `Rechamar ${selected.customerName || selected.phone || "cliente"}`,
            due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            assigned_employee_id: agentId || undefined,
          })
          showFeedback("Marcada como Reclamar + follow-up agendado.")
        } catch {
          showFeedback("Marcada como Reclamar (follow-up falhou).")
        }
      } else {
        showFeedback("Marcada como: Reclamar")
      }
    })
  }

  async function handleDelete(definitive = false) {
    if (!selected) return
    const confirmMsg = definitive
      ? "Eliminar chamada permanentemente? Esta ação não pode ser desfeita."
      : "Apagar esta chamada?"
    if (!window.confirm(confirmMsg)) return
    await run(async () => {
      const updated = await patchHubCommunicationEvent(selected.id, { status: definitive ? "deleted_permanent" : "deleted" })
      mergeEvent(updated)
      if (definitive) removeEvent?.(selected.id)
      showFeedback("Apagada.")
    })
  }

  async function handleSaveSummary() {
    if (!selected || !summaryNote.trim()) return
    setSavingSummary(true)
    try {
      const updated = await patchHubCommunicationEvent(selected.id, {
        resolution_note: summaryNote.trim(),
      })
      mergeEvent(updated)
      setSummaryNote("")
      if (draftKey) sessionStorage.removeItem(draftKey)
      showFeedback("Resumo guardado no cliente.")
    } catch {
      showFeedback("Erro ao guardar resumo.")
    } finally {
      setSavingSummary(false)
    }
  }

  async function handleAddQuickTag(tag: string) {
    if (!selected) return
    const existing: string[] = Array.isArray(selected.rawPayload?.hub_tags)
      ? (selected.rawPayload!.hub_tags as string[])
      : []
    const next = existing.includes(tag) ? existing.filter((t) => t !== tag) : [...existing, tag]
    try {
      const updated = await patchHubCommunicationEvent(selected.id, {
        raw_payload: { ...(selected.rawPayload ?? {}), hub_tags: next },
      })
      mergeEvent(updated)
    } catch {
      showFeedback("Erro ao atualizar tag.")
    }
  }

  const activeTags: string[] = Array.isArray(selected?.rawPayload?.hub_tags)
    ? (selected!.rawPayload!.hub_tags as string[])
    : []

  const wa = (selected?.normalizedPhone || selected?.phone || "").replace(/\D/g, "")
  const crmUrl = selected
    ? crmDashboard360UrlForCall({ phone: selected.normalizedPhone || selected.phone })
    : null
  const contactUrl = selected?.contactId
    ? `/customer360-shell/${encodeURIComponent(selected.contactId)}`
    : null

  // Call duration
  const callDuration = useMemo(() => {
    if (!selected) return null;
    if (selected.durationSeconds) {
      const m = Math.floor(selected.durationSeconds / 60);
      const s = selected.durationSeconds % 60;
      return `${m}m ${s}s`;
    }
    if (selected.startedAt && selected.endedAt) {
      const diff = Math.floor((new Date(selected.endedAt).getTime() - new Date(selected.startedAt).getTime()) / 1000);
      if (diff > 0) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    }
    return null;
  }, [selected]);

  // Previous calls from same phone
  const allEvents = useTelecofCallStore((s) => s.events);
  const previousCalls = useMemo(() => {
    if (!selected) return [];
    const norm = selected.normalizedPhone || selected.phone;
    return allEvents
      .filter((e) => e.id !== selected.id && (e.normalizedPhone === norm || e.phone === norm))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [selected, allEvents]);

  if (!selected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-muted p-8 text-center">
        <Phone className="mb-3 h-12 w-12 text-primary/40" />
        <h2 className="text-lg font-semibold text-foreground">Fila de chamadas Telecof</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Selecione uma chamada na coluna à esquerda.
        </p>
      </div>
    )
  }

  const canAssume =
    selected.operationalStatus === "new" || selected.operationalStatus === "unhandled"
  const canResolve =
    selected.operationalStatus !== "resolved" && selected.operationalStatus !== "treated"
  const initials = (selected.customerName?.trim() || selected.phone || "?")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="crm-telecof-workspace flex min-h-0 flex-1 flex-col bg-muted">
      {/* Header compacto: avatar 32 + nome/telefone + acção primária.
          Sticky no topo; em landscape fica em ~48px (index.css). */}
      <header className="crm-telecof-ws-header flex min-h-[48px] shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {selected.customerName?.trim() || selected.phone || selected.normalizedPhone}
          </p>
          <p className="truncate text-xs leading-tight text-muted-foreground">
            <a
              href={selected.phone || selected.normalizedPhone ? `tel:${selected.phone || selected.normalizedPhone}` : undefined}
              className="font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {selected.phone || selected.normalizedPhone || "sem número"}
            </a>
            {" · "}
            {operationalStatusLabel(selected)}
            {" · "}
            {selected.direction === "outbound" ? "Saída" : "Entrada"}
          </p>
        </div>
        {/* Acção primária única no header: Assumir (se aplicável) senão Tratado. */}
        {canAssume ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAssume()}
            className="crm-telecof-primary shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Assumir
          </button>
        ) : canResolve ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleStatus("resolved", "Tratado")}
            className="crm-telecof-primary shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Tratado
          </button>
        ) : null}
      </header>

      {feedback && (
        <p className="shrink-0 border-b border-border bg-primary/10 px-3 py-1.5 text-xs text-foreground">
          {feedback}
        </p>
      )}

      {/* Corpo scrollável — detalhe + identidade + histórico + resumo. */}
      <div className="crm-telecof-ws-body min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {/* Detalhes */}
        <dl className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="font-medium text-foreground">{operationalStatusLabel(selected)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Data / hora</dt>
            <dd className="text-foreground">{formatDateTime(selected.startedAt ?? selected.createdAt)}</dd>
          </div>
          {callDuration && (
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> Duração</dt>
              <dd className="font-medium text-foreground">{callDuration}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Agente</dt>
            <dd className="font-medium text-foreground">
              <select
                value={selected.assignedTo || ""}
                onChange={(e) => {
                  const val = e.target.value
                  void patchHubCommunicationEvent(selected.id, {
                    assigned_to: val || null,
                    agent_name: employees.find((emp) => emp.id === val)?.full_name || val || null,
                  }).then((updated) => mergeEvent(updated))
                }}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Sem agente —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Contacto</dt>
            <dd className="font-medium text-foreground">
              {contactUrl ? (
                <Link to={contactUrl} className="text-primary hover:underline">
                  {selected.customerName || selected.contactId?.slice(-6) || "Ver ficha"}
                </Link>
              ) : "—"}
            </dd>
          </div>
          {selected.claimedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Assumida em</dt>
              <dd className="text-foreground">{formatDateTime(selected.claimedAt)}</dd>
            </div>
          )}
        </dl>

        {/* Identificação automática do chamador */}
        {identityLoading && (
          <div className="animate-pulse rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <UserSearch className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">A identificar chamador…</span>
            </div>
          </div>
        )}

        {!identityLoading && identity?.kind === "unknown" && (
          <TelecofLeadCapture phone={selected.phone || selected.normalizedPhone || ""} callId={selected.id} />
        )}

        {!identityLoading && identity && identity.kind !== "unknown" && (
          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserSearch className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {identity.kind === "contact" ? "Contacto identificado" : "Lead identificado"}
                </h3>
              </div>
              <Link
                to={`/customer360-shell/${encodeURIComponent(String(identity.record?.id || ""))}`}
                className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                Abrir Ficha
              </Link>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {String(identity.record?.company_name || identity.record?.name || identity.record?.contact_name || "—")}
              </p>
              {identity.record?.email && <p className="text-xs text-muted-foreground">{String(identity.record.email)}</p>}
              {identity.record?.city && <p className="text-xs text-muted-foreground">{String(identity.record.city)}</p>}
            </div>
            {Array.isArray(identity.openDealsRecords) && identity.openDealsRecords.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">Negócios abertos ({identity.openDealsRecords.length})</p>
                {identity.openDealsRecords.slice(0, 3).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="truncate text-foreground">{d.title || `Negócio #${d.id}`}</span>
                    <span className="text-muted-foreground">{Number(d.total_amount || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(identity.recentInteractions) && identity.recentInteractions.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">Últimas interações ({identity.recentInteractions.length})</p>
                {identity.recentInteractions.slice(0, 4).map((h: any, i: number) => (
                  <div key={i} className="truncate text-xs text-muted-foreground">
                    {h.type || h.channel || "interação"} — {h.notes?.slice(0, 60) || formatDateTime(h.date_created || h.occurred_at)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Histórico de chamadas do mesmo número */}
        {previousCalls.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico ({previousCalls.length})</h3>
            </div>
            <div className="space-y-1">
              {previousCalls.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatDateTime(c.startedAt ?? c.createdAt)}</span>
                    <span className="font-medium text-foreground">{operationalStatusLabel(c)}</span>
                  </div>
                  {c.durationSeconds ? (
                    <span className="text-muted-foreground">{Math.floor(c.durationSeconds / 60)}m {c.durationSeconds % 60}s</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumo do atendimento */}
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resumo do atendimento
          </h3>
          {selected.resolutionNote && (
            <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
              {selected.resolutionNote}
            </p>
          )}
          <textarea
            value={summaryNote}
            onChange={(e) => setSummaryNote(e.target.value)}
            placeholder="Resumo da chamada, próximos passos, pedido do cliente…"
            rows={3}
            className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => void handleAddQuickTag(tag)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  activeTags.includes(tag)
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleSaveSummary()}
            disabled={savingSummary || !summaryNote.trim()}
            className="min-h-[44px] w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingSummary ? "A guardar…" : "Guardar no cliente"}
          </button>
        </div>

        {/* Pesquisa de produtos (Meilisearch) */}
        {selected.contactId && (
          <div className="rounded-xl border border-border bg-card p-4">
            <ProductSearchTab clientPhone={selected.phone || selected.normalizedPhone} showAddToQuotation />
          </div>
        )}
      </div>

      {/* Composer sticky — barra de acções secundárias (48-56px), sempre
          visível no fundo. Acções primárias (Assumir/Tratado) já estão no
          header; aqui ficam as secundárias. */}
      <div className="crm-telecof-composer flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2">
        {canResolve && !canAssume && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleStatus("resolved", "Tratado")}
            className="min-h-[44px] shrink-0 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            Tratado
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleStatus("advertising", "Publicidade")}
          className="min-h-[44px] shrink-0 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          Publicidade
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmCallback(true)}
          className="min-h-[44px] shrink-0 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          Reclamar
        </button>
        <AlertDialog open={confirmCallback} onOpenChange={setConfirmCallback}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Marcar para reclamar?</AlertDialogTitle>
              <AlertDialogDescription>
                {selected?.contactId
                  ? `Vai criar um follow-up "Rechamar ${selected.customerName || selected.phone || "cliente"}" agendado para daqui a 1 hora, visível na Agenda.`
                  : "Este número ainda não está identificado, por isso não é criado nenhum follow-up na Agenda — só se regista o estado da chamada."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmCallback(false)
                  void handleCallback()
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/20"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDelete(false)}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Apagar
        </button>
        {crmUrl && (
          <a
            href={crmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
            CRM
          </a>
        )}
      </div>
    </div>
  )
}
