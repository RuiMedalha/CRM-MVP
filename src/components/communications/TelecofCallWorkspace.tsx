/**
 * Workspace central do Telecof — replica o HubChat:
 * - Detalhes da chamada
 * - Resumo / nota rápida
 * - Botões de ação: Assumir, Tratado, Publicidade, Reclamar, WhatsApp, Apagar, CRM
 */
import { useState, useMemo, useEffect, useCallback } from "react"
import {
  ExternalLink,
  MessageCircle,
  Phone,
  Trash2,
  Clock,
  UserSearch,
  History,
  Building2,
  User,
  Mail,
  MapPin,
  CreditCard,
  Edit2,
  Save,
  CheckCircle2,
  FileText,
  BadgeAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Link } from "react-router-dom"

import { useQueryClient } from "@tanstack/react-query"
import { createInteraction } from "@/integrations/directus/interactions"
import { operationalStatusLabel } from "@/lib/telecofQueue"
import { crmDashboard360UrlForCall } from "@/lib/crmUrls"
import { useTelecofCallStore } from "@/store/telecofCallStore"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"
import { useAuth } from "@/contexts/AuthContext"
import { directusRequest } from "@/integrations/directus/client"
import { patchContact } from "@/integrations/directus/contacts"
import { createFollowUp } from "@/integrations/directus/follow-ups"
import { useEmployees } from "@/hooks/useEmployees"
import { ProductSearchTab } from "@/components/contacts/ProductSearchTab"
import { TelecofLeadCapture } from "./TelecofLeadCapture"
import { toast } from "@/hooks/use-toast"
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
  const queryClient = useQueryClient()
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

  // In-place contact editor state
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [contactEditForm, setContactEditForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    nif: "",
    city: "",
    notes: "",
  })

  // Sync edit form when identity changes
  useEffect(() => {
    if (identity?.kind === "contact" && identity.record) {
      setContactEditForm({
        company_name: String(identity.record.company_name || identity.record.name || ""),
        contact_name: String(identity.record.contact_name || ""),
        email: String(identity.record.email || ""),
        phone: String(identity.record.phone || selected?.phone || selected?.normalizedPhone || ""),
        nif: String(identity.record.nif || ""),
        city: String(identity.record.city || ""),
        notes: String(identity.record.notes || ""),
      })
      setIsEditingContact(false)
    }
  }, [identity?.record, identity?.kind, selected?.phone, selected?.normalizedPhone])

  const loadIdentityForPhone = useCallback(async (phone: string) => {
    setIdentityLoading(true)
    setIdentity(null)
    try {
      const { identifyByPhoneOrEmail } = await import("@/services/contactIdentification")
      const result = await identifyByPhoneOrEmail({ phone })
      let recentInteractions: unknown[] = []
      let openDealsRecords: unknown[] = []
      if (result.kind === "contact" && result.record?.id) {
        const contactId = result.record.id
        const [intRes, dealsRes] = await Promise.all([
          directusRequest<{ data: unknown[] }>(
            `/items/interactions?filter[contact_id][_eq]=${contactId}&sort=-occurred_at,-date_created&limit=5&fields=id,type,summary,occurred_at,date_created,direction,channel`
          ).catch(() => ({ data: [] })),
          directusRequest<{ data: unknown[] }>(
            `/items/deals?filter[customer_id][_eq]=${contactId}&filter[status][_nin]=perdido&limit=5&fields=id,title,total_amount,status`
          ).catch(() => ({ data: [] })),
        ])
        recentInteractions = intRes.data ?? []
        openDealsRecords = dealsRes.data ?? []
      }
      setIdentity({
        kind: result.kind,
        record: result.record ?? undefined,
        recentInteractions,
        openDealsRecords,
        openDeals: openDealsRecords.length,
        interactionCount: result.interactionCount,
        lastActivity: result.lastActivity,
      })

      if (result.kind !== "unknown" && result.record && selected) {
        const identifiedName = String(result.record.company_name || result.record.contact_name || result.record.name || "").trim()
        if (identifiedName && identifiedName !== selected.customerName) {
          patchHubCommunicationEvent(selected.id, {
            customer_name: identifiedName,
            ...(result.kind === "contact" ? { contact_id: String(result.record.id) } : {}),
          }).then((updated) => mergeEvent(updated)).catch(() => {})
        }
      }
    } catch {
      setIdentity({ kind: "unknown" })
    } finally {
      setIdentityLoading(false)
    }
  }, [selected, mergeEvent])

  useEffect(() => {
    const phone = selected?.normalizedPhone || selected?.phone
    if (!phone) {
      setIdentity(null)
      return
    }
    void loadIdentityForPhone(phone)
  }, [selected?.id, selected?.normalizedPhone, selected?.phone, loadIdentityForPhone])

  const handleContactCreated = useCallback(async (contact: any, contactId: string | number) => {
    const cId = String(contactId)
    let recentInteractions: unknown[] = []
    let openDealsRecords: unknown[] = []
    try {
      const [intRes, dealsRes] = await Promise.all([
        directusRequest<{ data: unknown[] }>(
          `/items/interactions?filter[contact_id][_eq]=${cId}&sort=-occurred_at,-date_created&limit=5&fields=id,type,summary,occurred_at,date_created,direction,channel`
        ).catch(() => ({ data: [] })),
        directusRequest<{ data: unknown[] }>(
          `/items/deals?filter[customer_id][_eq]=${cId}&filter[status][_nin]=perdido&limit=5&fields=id,title,total_amount,status`
        ).catch(() => ({ data: [] })),
      ])
      recentInteractions = intRes.data ?? []
      openDealsRecords = dealsRes.data ?? []
    } catch { /* non-blocking */ }

    setIdentity({
      kind: "contact",
      record: { id: cId, ...contact },
      recentInteractions,
      openDealsRecords,
      openDeals: openDealsRecords.length,
      interactionCount: recentInteractions.length,
      lastActivity: new Date().toISOString(),
    })
    setIdentityLoading(false)
    toast({
      title: "Dossiê do Cliente carregado",
      description: "A ficha do cliente foi criada e está disponível neste painel.",
    })
  }, [])

  const handleLeadCreated = useCallback(async (lead: any, leadId: string | number) => {
    setIdentity({
      kind: "lead",
      record: { id: String(leadId), ...lead },
      recentInteractions: [],
      openDealsRecords: [],
      openDeals: 0,
      interactionCount: 0,
      lastActivity: new Date().toISOString(),
    })
    setIdentityLoading(false)
    toast({
      title: "Lead registado",
      description: "O lead foi associado a esta chamada.",
    })
  }, [])

  const handleSaveContactEdit = async () => {
    if (!identity?.record?.id) return
    setSavingContact(true)
    try {
      const contactId = String(identity.record.id)
      const updated = await patchContact(contactId, {
        company_name: contactEditForm.company_name.trim() || undefined,
        contact_name: contactEditForm.contact_name.trim() || undefined,
        email: contactEditForm.email.trim() || undefined,
        phone: contactEditForm.phone.trim() || undefined,
        nif: contactEditForm.nif.trim() || undefined,
        city: contactEditForm.city.trim() || undefined,
        notes: contactEditForm.notes.trim() || undefined,
      })
      setIdentity((prev) => prev ? {
        ...prev,
        record: { ...(prev.record ?? {}), ...(updated as any) },
      } : null)
      setIsEditingContact(false)
      queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
      queryClient.invalidateQueries({ queryKey: ["contacts-directus"] })
      toast({ title: "Dados do cliente atualizados com sucesso" })
    } catch (err) {
      toast({ title: "Erro ao atualizar contacto", description: String((err as Error)?.message || ""), variant: "destructive" })
    } finally {
      setSavingContact(false)
    }
  }

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
      const contactId = selected.contactId || (identity?.kind === "contact" ? String(identity.record?.id) : undefined)
      const leadId = identity?.kind === "lead" ? String(identity.record?.id) : undefined

      const updated = await patchHubCommunicationEvent(selected.id, {
        status,
        resolved_at: new Date().toISOString(),
        ...(contactId ? { contact_id: contactId } : {}),
      })
      mergeEvent(updated)

      // Registo na timeline e interações do Customer 360
      try {
        await createInteraction({
          contact_id: contactId,
          lead_id: leadId,
          type: "call",
          direction: selected.direction === "outbound" ? "out" : "in",
          status: status === "resolved" ? "done" : status,
          source: "telecof",
          phone: selected.phone || selected.normalizedPhone,
          summary: `Chamada Telecof: ${label}${summaryNote.trim() ? ` — ${summaryNote.trim().slice(0, 100)}` : ""}`,
          occurred_at: new Date().toISOString(),
          payload: {
            status,
            status_label: label,
            call_id: selected.id,
            tags: activeTags,
            agent_name: agentName,
            note: summaryNote.trim() || undefined,
            phone: selected.phone || selected.normalizedPhone,
          },
        })
        if (contactId) {
          queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
          queryClient.invalidateQueries({ queryKey: ["interactions"] })
          queryClient.invalidateQueries({ queryKey: ["activities"] })
        }
      } catch { /* non-blocking */ }

      showFeedback(`Marcada como: ${label}`)
    })
  }

  // Phase 1.B3: "Reclamar" cria follow_up automático (due_at = +1h, status open)
  async function handleCallback() {
    if (!selected) return
    await run(async () => {
      const contactId = selected.contactId || (identity?.kind === "contact" ? String(identity.record?.id) : undefined)
      const leadId = identity?.kind === "lead" ? String(identity.record?.id) : undefined

      const updated = await patchHubCommunicationEvent(selected.id, {
        status: "callback",
        resolved_at: new Date().toISOString(),
        ...(contactId ? { contact_id: contactId } : {}),
      })
      mergeEvent(updated)

      // Registo na timeline e interações do Customer 360
      try {
        await createInteraction({
          contact_id: contactId,
          lead_id: leadId,
          type: "call",
          direction: selected.direction === "outbound" ? "out" : "in",
          status: "open",
          source: "telecof",
          phone: selected.phone || selected.normalizedPhone,
          summary: `Chamada Telecof marcada para Reclamar (+1h)`,
          occurred_at: new Date().toISOString(),
          payload: {
            call_id: selected.id,
            agent_name: agentName,
            phone: selected.phone || selected.normalizedPhone,
          },
        })
        if (contactId) {
          queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
          queryClient.invalidateQueries({ queryKey: ["interactions"] })
          queryClient.invalidateQueries({ queryKey: ["activities"] })
        }
      } catch { /* non-blocking */ }

      // Criar follow-up ligado ao contacto (se identificado) para aparecer na Agenda
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
    const text = summaryNote.trim()
    try {
      const contactId = selected.contactId || (identity?.kind === "contact" ? String(identity.record?.id) : undefined)
      const leadId = identity?.kind === "lead" ? String(identity.record?.id) : undefined

      const updated = await patchHubCommunicationEvent(selected.id, {
        resolution_note: text,
        ...(contactId ? { contact_id: contactId } : {}),
      })
      mergeEvent(updated)

      // Dual-write: criar registo em interactions para aparecer na timeline, pedidos e ficha 360 do cliente
      try {
        await createInteraction({
          contact_id: contactId,
          lead_id: leadId,
          type: "call",
          direction: selected.direction === "outbound" ? "out" : "in",
          status: "done",
          source: "telecof",
          phone: selected.phone || selected.normalizedPhone,
          summary: `Chamada Telecof: ${text.slice(0, 100)}`,
          occurred_at: selected.startedAt || selected.createdAt || new Date().toISOString(),
          payload: {
            text,
            call_id: selected.id,
            tags: activeTags,
            agent_name: agentName,
            duration: selected.durationSeconds,
            phone: selected.phone || selected.normalizedPhone,
          },
        })
        if (contactId) {
          queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
          queryClient.invalidateQueries({ queryKey: ["interactions"] })
          queryClient.invalidateQueries({ queryKey: ["activities"] })
        }
      } catch (intErr) {
        console.warn("[Telecof] Falha ao registar interação 360:", intErr)
      }

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

        {/* Identificação automática do chamador e Dossiê 360 */}
        {identityLoading && (
          <div className="animate-pulse rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <UserSearch className="h-4 w-4 animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-wider">A identificar chamador…</span>
            </div>
            <p className="text-xs text-muted-foreground">A pesquisar ficha de cliente, histórico e negócios associados a {selected.phone || selected.normalizedPhone}…</p>
          </div>
        )}

        {!identityLoading && identity?.kind === "unknown" && (
          <TelecofLeadCapture
            phone={selected.phone || selected.normalizedPhone || ""}
            callId={selected.id}
            onContactCreated={handleContactCreated}
            onLeadCreated={handleLeadCreated}
          />
        )}

        {!identityLoading && identity?.kind === "lead" && (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/20 dark:border-blue-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserSearch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Lead Identificado (Prospeção)
                </h3>
              </div>
              <Link
                to="/leads"
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-200"
              >
                <ExternalLink className="h-3 w-3" /> Ver em Leads
              </Link>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {String(identity.record?.display_name || identity.record?.contact_name || identity.record?.company_name || "Lead")}
              </p>
              {identity.record?.contact_name && (
                <p className="text-xs text-muted-foreground">Contacto: {String(identity.record.contact_name)}</p>
              )}
              {identity.record?.email && (
                <p className="text-xs text-muted-foreground">Email: {String(identity.record.email)}</p>
              )}
              {identity.record?.notes && (
                <p className="text-xs text-muted-foreground line-clamp-2 bg-card/60 p-2 rounded-md border border-border">
                  {String(identity.record.notes)}
                </p>
              )}
            </div>
          </div>
        )}

        {!identityLoading && identity?.kind === "contact" && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/15 dark:border-emerald-800 p-4">
            {/* Header da Ficha / Dossiê */}
            <div className="flex items-start justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/60 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-sm">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-foreground">
                      {String(identity.record?.company_name || identity.record?.name || identity.record?.contact_name || "Cliente")}
                    </h3>
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                      Cliente 360
                    </span>
                  </div>
                  {identity.record?.contact_name && identity.record?.company_name && (
                    <p className="truncate text-xs text-muted-foreground">
                      Pessoa de contacto: <span className="font-medium text-foreground">{String(identity.record.contact_name)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingContact((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                  title="Editar dados cadastrais do cliente"
                >
                  <Edit2 className="h-3 w-3" />
                  {isEditingContact ? "Fechar" : "Editar"}
                </button>
                <Link
                  to={`/customer360-shell/${encodeURIComponent(String(identity.record?.id || ""))}`}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                  title="Abrir página completa do Cliente 360"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir 360
                </Link>
              </div>
            </div>

            {/* Modo de Edição Rápida */}
            {isEditingContact ? (
              <div className="space-y-2.5 rounded-lg border border-border bg-card p-3 text-xs">
                <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                  Atualizar Dados do Cliente
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground font-medium block mb-0.5">Empresa *</label>
                    <input
                      type="text"
                      value={contactEditForm.company_name}
                      onChange={(e) => setContactEditForm({ ...contactEditForm, company_name: e.target.value })}
                      placeholder="Nome da empresa"
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-0.5">Pessoa de Contacto</label>
                    <input
                      type="text"
                      value={contactEditForm.contact_name}
                      onChange={(e) => setContactEditForm({ ...contactEditForm, contact_name: e.target.value })}
                      placeholder="Nome do interlocutor"
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-0.5">Email</label>
                    <input
                      type="email"
                      value={contactEditForm.email}
                      onChange={(e) => setContactEditForm({ ...contactEditForm, email: e.target.value })}
                      placeholder="email@empresa.com"
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-0.5">NIF / Contribuinte</label>
                    <input
                      type="text"
                      value={contactEditForm.nif}
                      onChange={(e) => setContactEditForm({ ...contactEditForm, nif: e.target.value })}
                      placeholder="Ex: 501234567"
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-0.5">Cidade / Localidade</label>
                    <input
                      type="text"
                      value={contactEditForm.city}
                      onChange={(e) => setContactEditForm({ ...contactEditForm, city: e.target.value })}
                      placeholder="Ex: Lisboa, Porto"
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-0.5">Telefone</label>
                    <input
                      type="text"
                      value={contactEditForm.phone}
                      onChange={(e) => setContactEditForm({ ...contactEditForm, phone: e.target.value })}
                      placeholder="Telefone"
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1 border-t border-border mt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingContact(false)}
                    className="rounded px-2.5 py-1 text-xs border border-border text-muted-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={savingContact || !contactEditForm.company_name.trim()}
                    onClick={() => void handleSaveContactEdit()}
                    className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    {savingContact ? "A guardar…" : "Guardar Dados"}
                  </button>
                </div>
              </div>
            ) : (
              /* Grelha de Dados Rápidos */
              <div className="grid grid-cols-2 gap-2 text-xs bg-card/70 p-2.5 rounded-lg border border-border">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {String(identity.record?.phone || identity.record?.mobile_phone || selected?.phone || "—")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">{String(identity.record?.email || "Sem email")}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">NIF: {String(identity.record?.nif || "—")}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">{String(identity.record?.city || "—")}</span>
                </div>
              </div>
            )}

            {/* Dossiê: Negócios Abertos */}
            {Array.isArray(identity.openDealsRecords) && identity.openDealsRecords.length > 0 && (
              <div className="space-y-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60 pt-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Negócios & Propostas ({identity.openDealsRecords.length})
                  </p>
                </div>
                <div className="space-y-1">
                  {identity.openDealsRecords.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-card/80 p-2 text-xs border border-border/60">
                      <span className="font-medium text-foreground truncate">{d.title || `Negócio #${d.id}`}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                        {Number(d.total_amount || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dossiê: Histórico de Interações ("Tudo o que fez com ele") */}
            {Array.isArray(identity.recentInteractions) && identity.recentInteractions.length > 0 && (
              <div className="space-y-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60 pt-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Histórico & Interações ({identity.recentInteractions.length})
                  </p>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                  {identity.recentInteractions.map((h: any, i: number) => (
                    <div key={i} className="rounded-md bg-card/80 p-2 text-xs border border-border/60 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-semibold uppercase text-foreground">
                          {h.type || h.channel || "interação"} {h.direction === "out" ? "↑ Saída" : "↓ Entrada"}
                        </span>
                        <span>{formatDateTime(h.occurred_at || h.date_created)}</span>
                      </div>
                      <p className="text-foreground text-xs line-clamp-2">
                        {h.summary || h.notes || "Registo de contacto"}
                      </p>
                    </div>
                  ))}
                </div>
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
