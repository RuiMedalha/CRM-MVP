/**
 * Workspace central do Telecof — replica o HubChat:
 * - Detalhes da chamada
 * - Resumo / nota rápida
 * - Botões de ação: Assumir, Tratado, Publicidade, Reclamar, WhatsApp, Apagar, CRM
 */
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import {
  ExternalLink,
  MessageCircle,
  Phone,
  PhoneCall,
  ArrowDownLeft,
  ArrowUpRight,
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
  Search,
  Package,
  StickyNote,
  Copy,
  Loader2,
  Link2,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react"
import { Link } from "react-router-dom"

import { useQueryClient } from "@tanstack/react-query"
import { createInteraction } from "@/integrations/directus/interactions"
import { operationalStatusLabel, isCallMissed, isCallAnswered, isCallUnqualified } from "@/lib/telecofQueue"
import { getCallsForSameCaller } from "@/lib/telecofGrouping"
import { crmDashboard360UrlForCall } from "@/lib/crmUrls"
import { useTelecofCallStore } from "@/store/telecofCallStore"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"
import { useAuth } from "@/contexts/AuthContext"
import { directusRequest } from "@/integrations/directus/client"
import { patchContact, getContactById, listContacts, createContact } from "@/integrations/directus/contacts"
import { patchLead, createLead } from "@/integrations/directus/leads"
import { createFollowUp } from "@/integrations/directus/follow-ups"
import { useEmployees } from "@/hooks/useEmployees"
import { ProductSearchTab, matchesShortcut, type ProductSearchTabHandle } from "@/components/contacts/ProductSearchTab"
import { CustomerDossierPanel } from "@/components/customer360/CustomerDossierPanel"
import { VoiceDictationButton } from "@/components/common/VoiceDictationButton"
import { TelecofLeadCapture } from "./TelecofLeadCapture"
import { TelecofMissedCallRecoveryModal } from "./TelecofMissedCallRecoveryModal"
import { QuickDealAndQuotationCard } from "@/components/common/QuickDealAndQuotationCard"
import { QuickNextStepDialog } from "@/components/common/QuickNextStepDialog"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function formatDateTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })
}

function formatFullDateTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const timeStr = d.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const dateStr = d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  if (isToday) {
    return `Hoje às ${timeStr} (${dateStr})`
  }
  if (isYesterday) {
    return `Ontem às ${timeStr} (${dateStr})`
  }
  return `${dateStr} às ${timeStr}`
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
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [nextStepDialogOpen, setNextStepDialogOpen] = useState(false)

  async function handleMarkCallAnswered() {
    if (!selected) return
    await run(async () => {
      const now = new Date().toISOString()
      const updated = await patchHubCommunicationEvent(selected.id, {
        call_status: "answered",
        status: "in_progress",
        claimed_at: selected.claimedAt || now,
        assigned_to: selected.assignedTo || agentId || agentName,
        agent_name: selected.agentName || agentName,
        raw_payload: {
          ...(selected.rawPayload ?? {}),
          call_qualification: "answered",
          qualified_at: now,
          qualified_by: agentName,
        },
      })
      mergeEvent(updated)
      showFeedback("Chamada classificada como: Atendida.")
    })
  }

  async function handleMarkCallMissed() {
    if (!selected) return
    await run(async () => {
      const now = new Date().toISOString()
      const updated = await patchHubCommunicationEvent(selected.id, {
        call_status: "missed",
        status: "unhandled",
        raw_payload: {
          ...(selected.rawPayload ?? {}),
          call_qualification: "missed",
          qualified_at: now,
          qualified_by: agentName,
        },
      })
      mergeEvent(updated)
      showFeedback("Chamada classificada como: Não Atendida / Perdida.")
      setRecoveryModalOpen(true)
    })
  }

  // Secção de pesquisa de produtos: colapsável, default aberto (o operador precisa)
  const [productSearchOpen, setProductSearchOpen] = useState(true)
  const productSearchRef = useRef<ProductSearchTabHandle | null>(null)
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "")

  /**
   * Atalho global Ctrl+K (Windows/Linux) / Cmd+K (Mac) foca o input de pesquisa
   * de produtos. Ignora quando o foco está num campo editável que não seja
   * o próprio input (ex: textarea de notas) para não roubar atalhos ao utilizador.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, "mod+k", isMac)) return
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase()
      const isEditable =
        tag === "input" || tag === "textarea" || (event.target as HTMLElement)?.isContentEditable
      // Se o foco já está num input/textarea que não seja o nosso input, deixa passar.
      if (isEditable && (event.target as HTMLElement) !== productSearchRef.current) {
        // Mas se for Ctrl+K, queremos sempre roubar — é convenção universal.
        if (!matchesShortcut(event, "mod+k", isMac)) return
      }
      event.preventDefault()
      productSearchRef.current?.focus()
      productSearchRef.current?.select()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isMac])

  // Caller identification: default imediato para "unknown" para exibir a Ficha instantaneamente
  const [identity, setIdentity] = useState<{
    kind: "contact" | "lead" | "unknown"
    record?: Record<string, unknown>
    recentInteractions?: unknown[]
    openDealsRecords?: unknown[]
    openDeals?: number
    interactionCount?: number
    lastActivity?: string | null
  }>(() => ({ kind: "unknown" }))
  const [identityLoading, setIdentityLoading] = useState(false)
  const lastLoadedKeyRef = useRef<string>("")

  // Quick Customer Link Search (pesquisar cliente para vincular)
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([])
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const customerSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (customerSearchTimeoutRef.current) clearTimeout(customerSearchTimeoutRef.current)
    const q = customerSearchQuery.trim()
    if (!q || q.length < 2) {
      setCustomerSearchResults([])
      return
    }
    setSearchingCustomer(true)
    customerSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const items = await listContacts({ search: q, limit: 8 })
        setCustomerSearchResults(items || [])
      } catch {
        setCustomerSearchResults([])
      } finally {
        setSearchingCustomer(false)
      }
    }, 250)
    return () => {
      if (customerSearchTimeoutRef.current) clearTimeout(customerSearchTimeoutRef.current)
    }
  }, [customerSearchQuery])

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
        phone: String(identity.record.phone || identity.record.mobile_phone || selected?.phone || selected?.normalizedPhone || ""),
        nif: String(identity.record.nif || ""),
        city: String(identity.record.city || ""),
        notes: String(identity.record.notes || ""),
      })
      setIsEditingContact(false)
    } else if (identity?.kind === "lead" && identity.record) {
      setContactEditForm({
        company_name: String(identity.record.display_name || identity.record.company_name || identity.record.name || selected?.customerName || ""),
        contact_name: String(identity.record.contact_name || identity.record.contact_person || ""),
        email: String(identity.record.email || ""),
        phone: String(identity.record.phone || selected?.phone || selected?.normalizedPhone || ""),
        nif: String(identity.record.nif || ""),
        city: String(identity.record.city || ""),
        notes: String(identity.record.notes || ""),
      })
      setIsEditingContact(false)
    } else {
      setContactEditForm({
        company_name: String(selected?.customerName || ""),
        contact_name: "",
        email: "",
        phone: String(selected?.phone || selected?.normalizedPhone || ""),
        nif: "",
        city: "",
        notes: "",
      })
      setIsEditingContact(false)
    }
  }, [identity?.record, identity?.kind, selected?.phone, selected?.normalizedPhone, selected?.customerName])

  const loadIdentityForPhone = useCallback(async (
    phone: string,
    contactId?: string,
    callId?: string,
    currentCustomerName?: string,
  ) => {
    setIdentityLoading(true)
    try {
      // 1. Se o evento já tem contact_id associado, carrega imediatamente por ID
      if (contactId) {
        const directContact = await getContactById(contactId).catch(() => null)
        if (directContact) {
          const [intRes, dealsRes] = await Promise.all([
            directusRequest<{ data: unknown[] }>(
              `/items/interactions?filter[contact_id][_eq]=${contactId}&sort=-occurred_at,-date_created&limit=5&fields=id,type,summary,occurred_at,date_created,direction,channel`
            ).catch(() => ({ data: [] })),
            directusRequest<{ data: unknown[] }>(
              `/items/deals?filter[customer_id][_eq]=${contactId}&filter[status][_nin]=perdido&limit=5&fields=id,title,total_amount,status`
            ).catch(() => ({ data: [] })),
          ])
          const recentInteractions = intRes.data ?? []
          const openDealsRecords = dealsRes.data ?? []
          setIdentity({
            kind: "contact",
            record: directContact as any,
            recentInteractions,
            openDealsRecords,
            openDeals: openDealsRecords.length,
            interactionCount: recentInteractions.length,
            lastActivity: (directContact.last_seen_at as string) || (directContact.date_created as string) || null,
          })
          setIdentityLoading(false)
          return
        }
      }

      // 2. Pesquisa de contacto pelo número de telefone (1 single fast query)
      if (phone && phone.trim()) {
        const { identifyByPhoneOrEmail } = await import("@/services/contactIdentification")
        const result = await identifyByPhoneOrEmail({ phone })
        let recentInteractions: unknown[] = []
        let openDealsRecords: unknown[] = []
        if (result.kind === "contact" && result.record?.id) {
          const cId = result.record.id
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
          setIdentity({
            kind: "contact",
            record: result.record,
            recentInteractions,
            openDealsRecords,
            openDeals: openDealsRecords.length,
            interactionCount: result.interactionCount,
            lastActivity: result.lastActivity,
          })

          if (callId) {
            const identifiedName = String(result.record.company_name || result.record.contact_name || result.record.name || "").trim()
            if (identifiedName && identifiedName !== currentCustomerName) {
              patchHubCommunicationEvent(callId, {
                customer_name: identifiedName,
                contact_id: String(result.record.id),
              }).then((updated) => mergeEvent(updated)).catch(() => {})
            }
          }
          setIdentityLoading(false)
          return
        } else if (result.kind === "lead" && result.record?.id) {
          setIdentity({
            kind: "lead",
            record: result.record,
            recentInteractions: [],
            openDealsRecords: [],
            openDeals: 0,
            interactionCount: 0,
            lastActivity: result.lastActivity,
          })
          setIdentityLoading(false)
          return
        }
      }

      // 3. Caso não identificado, mantém o formulário pronto para preenchimento
      setIdentity({ kind: "unknown" })
    } catch {
      setIdentity({ kind: "unknown" })
    } finally {
      setIdentityLoading(false)
    }
  }, [mergeEvent])

  useEffect(() => {
    if (!selected) {
      setIdentity({ kind: "unknown" })
      setIdentityLoading(false)
      lastLoadedKeyRef.current = ""
      return
    }
    const phone = selected.normalizedPhone || selected.phone || ""
    const contactId = selected.contactId || ""
    const currentKey = `${selected.id}:${phone}:${contactId}`

    if (lastLoadedKeyRef.current === currentKey) {
      // Já carregado para esta chamada e número — previne loop infinito de polling
      return
    }
    lastLoadedKeyRef.current = currentKey

    if (!phone && !contactId) {
      setIdentity({ kind: "unknown" })
      setIdentityLoading(false)
      return
    }
    void loadIdentityForPhone(phone, contactId, selected.id, selected.customerName)
  }, [selected?.id, selected?.contactId, selected?.normalizedPhone, selected?.phone, selected?.customerName, loadIdentityForPhone])

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
    setSavingContact(true)
    try {
      const companyName = contactEditForm.company_name.trim() || contactEditForm.contact_name.trim() || "Cliente"
      const payload = {
        company_name: companyName,
        name: companyName,
        contact_name: contactEditForm.contact_name.trim() || undefined,
        email: contactEditForm.email.trim() || undefined,
        phone: contactEditForm.phone.trim() || undefined,
        nif: contactEditForm.nif.trim() || undefined,
        city: contactEditForm.city.trim() || undefined,
        notes: contactEditForm.notes.trim() || undefined,
      }

      if (identity?.kind === "contact" && identity.record?.id) {
        const contactId = String(identity.record.id)
        const updated = await patchContact(contactId, payload)
        setIdentity((prev) => prev ? {
          ...prev,
          record: { ...(prev.record ?? {}), ...(updated as any), ...payload },
        } : null)
        if (selected?.id && companyName) {
          await patchHubCommunicationEvent(selected.id, {
            customer_name: companyName,
            contact_id: contactId,
          }).then((up) => mergeEvent(up)).catch(() => {})
        }
        queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
        queryClient.invalidateQueries({ queryKey: ["contacts-directus"] })
        toast({ title: "Ficha do Cliente atualizada com sucesso!" })
      } else if (identity?.kind === "lead" && identity.record?.id) {
        const leadId = String(identity.record.id)
        await patchLead(leadId, {
          display_name: companyName,
          email: payload.email,
          phone: payload.phone,
          nif: payload.nif,
          notes: payload.notes,
        })
        setIdentity((prev) => prev ? {
          ...prev,
          record: { ...(prev.record ?? {}), display_name: companyName, ...payload },
        } : null)
        if (selected?.id && companyName) {
          await patchHubCommunicationEvent(selected.id, {
            customer_name: companyName,
          }).then((up) => mergeEvent(up)).catch(() => {})
        }
        queryClient.invalidateQueries({ queryKey: ["leads-page"] })
        queryClient.invalidateQueries({ queryKey: ["leads"] })
        toast({ title: "Dados do Lead atualizados com sucesso!" })
      } else {
        const created = await createContact({ ...payload, source: "telecof" })
        const contactId = String(created?.id ?? (created as any)?.data?.id)
        if (selected?.id && contactId) {
          await patchHubCommunicationEvent(selected.id, {
            customer_name: companyName,
            contact_id: contactId,
          }).then((up) => mergeEvent(up)).catch(() => {})
        }
        setIdentity({
          kind: "contact",
          record: { id: contactId, ...payload },
          recentInteractions: [],
          openDealsRecords: [],
          openDeals: 0,
          interactionCount: 0,
          lastActivity: new Date().toISOString(),
        })
        queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
        queryClient.invalidateQueries({ queryKey: ["contacts-directus"] })
        toast({ title: "Ficha 360 criada com sucesso!", description: `${companyName} registado no CRM.` })
      }
      setIsEditingContact(false)
    } catch (err) {
      toast({ title: "Erro ao gravar dados", description: String((err as Error)?.message || ""), variant: "destructive" })
    } finally {
      setSavingContact(false)
    }
  }

  const handlePromoteLeadToContact = async () => {
    setSavingContact(true)
    try {
      const companyName = contactEditForm.company_name.trim() || contactEditForm.contact_name.trim() || "Cliente"
      const payload = {
        company_name: companyName,
        name: companyName,
        contact_name: contactEditForm.contact_name.trim() || undefined,
        email: contactEditForm.email.trim() || undefined,
        phone: contactEditForm.phone.trim() || undefined,
        nif: contactEditForm.nif.trim() || undefined,
        city: contactEditForm.city.trim() || undefined,
        notes: contactEditForm.notes.trim() || undefined,
        source: "telecof",
      }
      const created = await createContact(payload)
      const contactId = String(created?.id ?? (created as any)?.data?.id)
      if (selected?.id && contactId) {
        await patchHubCommunicationEvent(selected.id, {
          customer_name: companyName,
          contact_id: contactId,
        }).then((up) => mergeEvent(up)).catch(() => {})
      }
      if (identity?.kind === "lead" && identity.record?.id) {
        await patchLead(String(identity.record.id), { status: "processed", contact_id: contactId }).catch(() => {})
      }
      setIdentity({
        kind: "contact",
        record: { id: contactId, ...payload },
        recentInteractions: [],
        openDealsRecords: [],
        openDeals: 0,
        interactionCount: 0,
        lastActivity: new Date().toISOString(),
      })
      queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
      queryClient.invalidateQueries({ queryKey: ["contacts-directus"] })
      queryClient.invalidateQueries({ queryKey: ["leads-page"] })
      toast({ title: "Promovido a Contacto 360 com sucesso!", description: `${companyName} tem agora Ficha 360 ativa.` })
      setIsEditingContact(false)
    } catch (err) {
      toast({ title: "Erro ao converter lead", description: String((err as Error)?.message || ""), variant: "destructive" })
    } finally {
      setSavingContact(false)
    }
  }

  const handleLinkCustomer = async (contact: any) => {
    if (!selected) return
    try {
      const cId = String(contact.id)
      const companyName = String(contact.company_name || contact.name || contact.contact_name || "").trim()
      const updated = await patchHubCommunicationEvent(selected.id, {
        contact_id: cId,
        customer_name: companyName || undefined,
      })
      mergeEvent(updated)
      setCustomerSearchQuery("")
      setShowCustomerSearch(false)
      lastLoadedKeyRef.current = ""
      await loadIdentityForPhone(selected.phone || selected.normalizedPhone || "", cId, selected.id, companyName)
      toast({
        title: "Cliente associado à chamada",
        description: `Chamada vinculada a ${companyName || `#${cId}`}.`,
      })
    } catch {
      toast({ title: "Erro ao associar cliente", variant: "destructive" })
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
    ? (selected.contactId || (identity?.kind === "contact" && identity?.record?.id ? String(identity.record.id) : null))
      ? `/customer360-shell/${encodeURIComponent(selected.contactId || String(identity?.record?.id))}`
      : crmDashboard360UrlForCall({ phone: selected.normalizedPhone || selected.phone })
    : null
  const contactUrl = (selected?.contactId || (identity?.kind === "contact" && identity?.record?.id ? String(identity.record.id) : null))
    ? `/customer360-shell/${encodeURIComponent(selected?.contactId || String(identity?.record?.id))}`
    : (identity?.kind === "lead" && identity?.record?.id)
      ? `/customer360-shell?phone=${encodeURIComponent(selected?.normalizedPhone || selected?.phone || "")}&leadId=${encodeURIComponent(String(identity.record.id))}&name=${encodeURIComponent(String(identity.record.display_name || identity.record.company_name || selected?.customerName || ""))}`
      : (selected?.normalizedPhone || selected?.phone)
        ? `/customer360-shell?phone=${encodeURIComponent(selected.normalizedPhone || selected.phone)}`
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

  // All calls from this same caller / contact
  const allEvents = useTelecofCallStore((s) => s.events);
  const selectEvent = useTelecofCallStore((s) => s.selectEvent);
  const callerCalls = useMemo(() => {
    if (!selected) return [];
    return getCallsForSameCaller(selected, allEvents);
  }, [selected, allEvents]);

  const callerUnhandledCount = useMemo(() => {
    return callerCalls.filter(
      (c) => c.operationalStatus === "unhandled" || c.operationalStatus === "new",
    ).length;
  }, [callerCalls]);

  const [resolvingCallerCalls, setResolvingCallerCalls] = useState(false);
  async function handleResolveAllCallerCalls() {
    if (!callerCalls.length) return;
    const unhandled = callerCalls.filter(
      (c) => c.operationalStatus === "unhandled" || c.operationalStatus === "new",
    );
    if (!unhandled.length) return;
    setResolvingCallerCalls(true);
    try {
      const now = new Date().toISOString();
      await Promise.all(
        unhandled.map((c) =>
          patchHubCommunicationEvent(c.id, {
            status: "resolved",
            resolved_at: now,
            ...(c.contactId ? { contact_id: c.contactId } : {}),
          })
            .then((updated) => mergeEvent(updated))
            .catch(() => {}),
        ),
      );
      showFeedback(`Todas as ${unhandled.length} chamadas deste número foram marcadas como tratadas.`);
    } finally {
      setResolvingCallerCalls(false);
    }
  }

  if (!selected) {
    return (
      <div className="crm-telecof-workspace flex min-h-0 flex-1 flex-col bg-muted">
        <header className="crm-telecof-ws-header flex min-h-[48px] shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shadow-sm">
              <Phone className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-tight">
                Novo Atendimento / Registo de Contacto
              </h2>
              <p className="text-xs text-muted-foreground leading-tight">
                Preencha os dados do cliente ou pesquise para vincular a uma ficha existente
              </p>
            </div>
          </div>
        </header>

        <div className="crm-telecof-ws-body min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <TelecofLeadCapture
            phone=""
            onContactCreated={handleContactCreated}
            onLeadCreated={handleLeadCreated}
          />
        </div>
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
          {contactUrl ? (
            <Link
              to={contactUrl}
              className="inline-flex items-center gap-1 truncate text-sm font-bold leading-tight text-foreground hover:text-primary hover:underline transition-colors"
              title="Clique para abrir a Ficha 360 do Cliente"
            >
              {selected.customerName?.trim() || selected.phone || selected.normalizedPhone}
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {selected.customerName?.trim() || selected.phone || selected.normalizedPhone}
            </p>
          )}
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

        {/* Botão de Abertura Direta da Ficha 360 */}
        {contactUrl && (
          <Link
            to={contactUrl}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors shadow-sm"
            title="Abrir Ficha 360 Completa do Cliente"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abrir Ficha 360</span>
          </Link>
        )}

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
            onClick={() => setNextStepDialogOpen(true)}
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
        {/* Banner de Qualificação da Chamada (A central telefónica enviou o webhook mas não sabe se foi atendida) */}
        {isCallUnqualified(selected) && (
          <div className="rounded-xl border-2 border-amber-400/80 bg-amber-50 dark:bg-amber-950/30 p-3.5 shadow-sm space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  <BadgeAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  Esta chamada foi atendida pela equipa?
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-400">
                  A central telefónica registou a entrada da chamada. Confirme se foi atendida ou perdida para manter o histórico fiável e acionar a recuperação por WhatsApp.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleMarkCallAnswered()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Sim, Atendida</span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleMarkCallMissed()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Não, Perdida</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chamada Não Atendida / Perdida — Recuperação GoHighLevel */}
        {isCallMissed(selected) && (
          <div className="rounded-xl border border-red-200 bg-red-50/70 dark:bg-red-950/20 dark:border-red-800/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">
                <PhoneCall className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-red-950 dark:text-red-200">
                  Chamada Não Atendida / Perdida
                </p>
                <p className="text-[11px] text-red-700 dark:text-red-400">
                  Evite que este cliente contacte um concorrente. Envie uma mensagem WhatsApp de recuperação com 1 clique.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRecoveryModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>💬 Recuperar por WhatsApp</span>
            </button>
          </div>
        )}
        {/* Secção de Chamadas do Interlocutor (Agrupamento com Datas e Horas) */}
        {callerCalls.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PhoneCall className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Chamadas deste Interlocutor ({callerCalls.length})
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {callerCalls.length === 1
                      ? "1 chamada registada neste número"
                      : `${callerCalls.length} chamadas registadas · ${callerUnhandledCount} por tratar`}
                  </p>
                </div>
              </div>

              {callerUnhandledCount > 0 && (
                <button
                  type="button"
                  disabled={resolvingCallerCalls}
                  onClick={() => void handleResolveAllCallerCalls()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
                  title="Marcar todas as chamadas deste número como tratadas"
                >
                  {resolvingCallerCalls ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {callerUnhandledCount === 1
                      ? "Marcar chamada como tratada"
                      : `Marcar todas as ${callerUnhandledCount} como tratadas`}
                  </span>
                </button>
              )}
            </div>

            <div className="divide-y divide-border/60">
              {callerCalls.map((c, index) => {
                const isCurrent = c.id === selected.id
                const cDuration = c.durationSeconds
                  ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s`
                  : null
                const isIncoming = c.direction !== "outbound"

                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 px-2 rounded-lg transition-colors",
                      isCurrent
                        ? "bg-primary/5 border border-primary/25 font-medium"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                        #{callerCalls.length - index}
                      </span>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-semibold text-foreground">
                            {formatFullDateTime(c.startedAt ?? c.createdAt)}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center rounded bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                              Em foco
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.2 text-[10px] font-medium ring-1 ring-inset",
                              c.operationalStatus === "resolved" || c.operationalStatus === "treated"
                                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-300 dark:text-emerald-400"
                                : c.operationalStatus === "unhandled" || c.operationalStatus === "new"
                                ? "bg-amber-500/10 text-amber-800 ring-amber-300 dark:text-amber-300"
                                : "bg-muted text-muted-foreground ring-border",
                            )}
                          >
                            {operationalStatusLabel(c)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {isIncoming ? (
                              <ArrowDownLeft className="h-3 w-3 text-blue-500" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3 text-orange-500" />
                            )}
                            {isIncoming ? "Recebida" : "Efetuada"}
                          </span>
                          {cDuration ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {cDuration}
                            </span>
                          ) : (
                            <span>· Não atendida</span>
                          )}
                          {c.agentName ? <span>· Agente: {c.agentName}</span> : null}
                        </div>

                        {c.resolutionNote && (
                          <p className="text-[11px] text-muted-foreground italic truncate max-w-md">
                            Nota: {c.resolutionNote}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      {c.recordingUrl && (
                        <audio controls src={c.recordingUrl} className="h-6 w-36" />
                      )}
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => selectEvent(c.id)}
                          className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                        >
                          Ver detalhes
                        </button>
                      )}
                      {(c.operationalStatus === "unhandled" || c.operationalStatus === "new") && (
                        <button
                          type="button"
                          onClick={() => {
                            void patchHubCommunicationEvent(c.id, {
                              status: "resolved",
                              resolved_at: new Date().toISOString(),
                            }).then((updated) => mergeEvent(updated))
                          }}
                          className="rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-1 text-xs font-semibold transition-colors"
                          title="Marcar apenas esta chamada como tratada"
                        >
                          ✓ Tratar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Contacto</dt>
            <dd className="font-medium text-foreground flex items-center gap-2">
              {contactUrl ? (
                <Link to={contactUrl} className="text-primary hover:underline">
                  {selected.customerName || selected.contactId?.slice(-6) || "Ver ficha"}
                </Link>
              ) : (
                <span className="text-muted-foreground">Não associado</span>
              )}
              <button
                type="button"
                onClick={() => setShowCustomerSearch((v) => !v)}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:bg-secondary/80 transition-colors"
                title="Pesquisar e associar outro cliente a esta chamada"
              >
                <Search className="h-3 w-3" />
                {showCustomerSearch ? "Fechar" : "Vincular"}
              </button>
            </dd>
          </div>

          {/* Barra de Pesquisa Rápida para Vincular Cliente */}
          {showCustomerSearch && (
            <div className="col-span-full pt-2 border-t border-border space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Pesquisar cliente por nome, telefone, NIF ou email para associar..."
                  className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
                {searchingCustomer && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
                )}
              </div>

              {customerSearchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-sm space-y-0.5">
                  {customerSearchResults.map((c) => {
                    const cName = c.company_name || c.name || c.contact_name || `Contacto #${c.id}`
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => void handleLinkCustomer(c)}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{cName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.phone ? `Tel: ${c.phone}` : ""} {c.nif ? `· NIF: ${c.nif}` : ""} {c.city ? `· ${c.city}` : ""}
                          </p>
                        </div>
                        <span className="ml-2 inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary shrink-0">
                          <Link2 className="h-3 w-3" /> Associar
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {selected.claimedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Assumida em</dt>
              <dd className="text-foreground">{formatDateTime(selected.claimedAt)}</dd>
            </div>
          )}
        </dl>

        {/* REGISTO EM DIRETO & NOTAS DA CHAMADA (COM DITADO POR VOZ) */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <StickyNote className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Registo em Direto & Notas da Chamada
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Escreva ou dite por voz em tempo real — fica gravado na chamada e na ficha 360 do cliente
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <VoiceDictationButton
                onTranscriptChunk={(chunk) => {
                  if (!chunk.trim()) return
                  setSummaryNote((prev) => {
                    const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : ""
                    return prev + sep + chunk.trim()
                  })
                }}
                onFullTranscript={(full) => {
                  if (full.trim()) setSummaryNote(full)
                }}
                size="sm"
                showLabel
              />

              {summaryNote.trim() && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(summaryNote)
                      toast({ title: "Texto copiado!" })
                    }}
                    className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Copiar texto"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Limpar notas desta chamada?")) {
                        setSummaryNote("")
                        if (draftKey) sessionStorage.removeItem(draftKey)
                      }
                    }}
                    className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted text-xs"
                    title="Limpar notas"
                  >
                    Limpar
                  </button>
                </>
              )}
            </div>
          </div>

          <textarea
            value={summaryNote}
            onChange={(e) => setSummaryNote(e.target.value)}
            rows={5}
            placeholder="Registe aqui as notas da conversa, necessidades do cliente ou utilize o Ditado por Voz..."
            className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 focus:border-primary leading-relaxed resize-y min-h-[140px]"
          />

          {/* Quick tags e botão de guardar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted-foreground mr-1 font-medium">Tags:</span>
              {QUICK_TAGS.map((tag) => {
                const active = activeTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => void handleAddQuickTag(tag)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition border",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>

            <Button
              type="button"
              disabled={savingSummary || !summaryNote.trim()}
              onClick={() => void handleSaveSummary()}
              size="sm"
              className="font-semibold shadow-sm"
            >
              {savingSummary ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> A guardar…
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Guardar no Dossiê
                </>
              )}
            </Button>
          </div>
        </div>

        {/* PESQUISA RÁPIDA DE PRODUTOS — sempre visível na chamada.
            Atalho Ctrl+K (Cmd+K em Mac) foca o input via productSearchRef. */}
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/15">
          <button
            type="button"
            onClick={() => setProductSearchOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            aria-expanded={productSearchOpen}
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Pesquisa rápida de produtos
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 rounded bg-amber-200/60 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                <Search className="h-3 w-3" />
                {isMac ? "⌘K" : "Ctrl+K"} para focar
              </span>
            </div>
            {productSearchOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
            )}
          </button>
          {productSearchOpen && (
            <div className="px-4 pb-4">
              <ProductSearchTab
                ref={productSearchRef}
                clientPhone={selected?.phone || selected?.normalizedPhone}
                showAddToQuotation
              />
            </div>
          )}
        </div>

        {/* Ponte Comercial — Oportunidade no Funil e Proposta Rápida */}
        <QuickDealAndQuotationCard
          contactId={identity?.kind === "contact" && identity.record?.id ? String(identity.record.id) : null}
          customerName={identity?.record?.company_name || identity?.record?.contact_name || selected.customerName}
          phone={selected.phone || selected.normalizedPhone}
          email={identity?.record?.email}
          notes={summaryNote || selected.subject}
          currentCallId={selected.id}
        />

        {/* Ficha de Preenchimento Imediato (Contacto Novo / Não Registado) */}
        {identity?.kind === "unknown" && (
          <TelecofLeadCapture
            phone={selected.phone || selected.normalizedPhone || ""}
            callId={selected.id}
            onContactCreated={handleContactCreated}
            onLeadCreated={handleLeadCreated}
          />
        )}

        {/* Ficha Cadastral e Dossiê (Contacto 360 ou Lead de Prospeção) */}
        {!identityLoading && (identity?.kind === "contact" || identity?.kind === "lead") && (
          <div className="space-y-3">
            {/* Modo de Edição e Visualização da Ficha Cadastral */}
            <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-xs shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-bold shadow-xs text-white",
                      identity.kind === "contact" ? "bg-emerald-600" : "bg-blue-600"
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground uppercase tracking-wider text-xs">
                        Ficha Cadastral {identity.kind === "contact" ? "do Cliente" : "do Lead"}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
                          identity.kind === "contact"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
                        )}
                      >
                        {identity.kind === "contact" ? "Cliente 360" : "Lead Prospeção"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {identity.kind === "contact"
                        ? "Consulte ou corrija os dados cadastrais diretamente nesta chamada"
                        : "Lead em prospeção — consulte, atualize ou converta em Ficha 360"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingContact((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                    title="Editar dados cadastrais"
                  >
                    <Edit2 className="h-3 w-3" />
                    {isEditingContact ? "Cancelar Edição" : "Editar / Corrigir"}
                  </button>

                  {identity.kind === "lead" && (
                    <button
                      type="button"
                      disabled={savingContact}
                      onClick={() => void handlePromoteLeadToContact()}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                      title="Promover este Lead a Contacto com Ficha 360 Completa"
                    >
                      <Sparkles className="h-3 w-3" />
                      {savingContact ? "A converter…" : "Converter em Ficha 360"}
                    </button>
                  )}

                  {contactUrl && (
                    <Link
                      to={contactUrl}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold transition-colors shadow-xs",
                        identity.kind === "contact"
                          ? "border-emerald-400/50 bg-emerald-100/80 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
                          : "border-blue-400/50 bg-blue-100/80 text-blue-900 hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/60 dark:text-blue-200"
                      )}
                      title="Abrir página completa no Customer 360"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir Ficha 360
                    </Link>
                  )}
                </div>
              </div>

              {isEditingContact ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-muted-foreground font-semibold block mb-1">Empresa / Razão Social *</label>
                      <input
                        type="text"
                        value={contactEditForm.company_name}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, company_name: e.target.value })}
                        placeholder="Nome da empresa"
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground font-semibold block mb-1">Pessoa de Contacto</label>
                      <input
                        type="text"
                        value={contactEditForm.contact_name}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, contact_name: e.target.value })}
                        placeholder="Nome do interlocutor"
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground font-semibold block mb-1">Email</label>
                      <input
                        type="email"
                        value={contactEditForm.email}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, email: e.target.value })}
                        placeholder="email@empresa.com"
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground font-semibold block mb-1">NIF / Contribuinte</label>
                      <input
                        type="text"
                        value={contactEditForm.nif}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, nif: e.target.value })}
                        placeholder="Ex: 501234567"
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground font-semibold block mb-1">Cidade / Localidade</label>
                      <input
                        type="text"
                        value={contactEditForm.city}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, city: e.target.value })}
                        placeholder="Ex: Lisboa, Porto"
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground font-semibold block mb-1">Telefone</label>
                      <input
                        type="text"
                        value={contactEditForm.phone}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, phone: e.target.value })}
                        placeholder="Telefone"
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-muted-foreground font-semibold block mb-1">Notas / Observações do Cliente</label>
                      <textarea
                        rows={2}
                        value={contactEditForm.notes}
                        onChange={(e) => setContactEditForm({ ...contactEditForm, notes: e.target.value })}
                        placeholder="Observações permanentes da ficha..."
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-border">
                    {identity.kind === "lead" ? (
                      <button
                        type="button"
                        disabled={savingContact}
                        onClick={() => void handlePromoteLeadToContact()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {savingContact ? "A converter…" : "Converter em Contacto 360"}
                      </button>
                    ) : (
                      <span />
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingContact(false)}
                        className="rounded px-3 py-1.5 text-xs border border-border text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingContact || !contactEditForm.company_name.trim()}
                        onClick={() => void handleSaveContactEdit()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {savingContact ? "A guardar…" : identity.kind === "lead" ? "Guardar Lead" : "Guardar Alterações"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-muted/40 p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-foreground truncate">
                        {String(identity.record?.company_name || identity.record?.display_name || identity.record?.name || "Sem nome")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">
                        {String(identity.record?.contact_name || identity.record?.contact_person || "—")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={`tel:${identity.record?.phone || identity.record?.mobile_phone || selected?.phone || ""}`}
                        className="text-primary hover:underline truncate font-medium"
                      >
                        {String(identity.record?.phone || identity.record?.mobile_phone || selected?.phone || "—")}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {identity.record?.email ? (
                        <a href={`mailto:${identity.record.email}`} className="text-primary hover:underline truncate">
                          {String(identity.record.email)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground truncate">Sem email</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">NIF: {String(identity.record?.nif || "—")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{String(identity.record?.city || "—")}</span>
                    </div>
                    {identity.record?.notes && (
                      <div className="col-span-full pt-1 text-[11px] text-muted-foreground border-t border-border/50">
                        <span className="font-medium text-foreground">Notas:</span> {String(identity.record.notes)}
                      </div>
                    )}
                  </div>

                  {identity.kind === "lead" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 p-2.5 text-xs text-blue-950 dark:text-blue-200">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>Este interlocutor é uma <strong>Lead</strong>. Converta-o para aceder à Ficha 360 completa.</span>
                      </div>
                      <button
                        type="button"
                        disabled={savingContact}
                        onClick={() => void handlePromoteLeadToContact()}
                        className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs shrink-0"
                      >
                        <Sparkles className="h-3 w-3" />
                        {savingContact ? "A converter…" : "Converter em Contacto 360"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dossiê contínuo — vista partilhada (CustomerDossierPanel) */}
            <CustomerDossierPanel
              contactId={identity.kind === "contact" && identity.record?.id ? String(identity.record.id) : null}
              leadId={identity.kind === "lead" && identity.record?.id ? String(identity.record.id) : null}
              variant="telecof"
              defaultSource="telecof"
              callId={selected.id}
              noteQuickTags={Array.from(QUICK_TAGS)}
              hideHeader={true}
              hideNotes={true}
              allowFollowUp
            />
          </div>
        )}


        {/* Resumo do atendimento (Telecof-específico — grava resolution_note na chamada) */}
        {selected.resolutionNote && (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resolução desta chamada
            </h3>
            <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
              {selected.resolutionNote}
            </p>
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
            onClick={() => setNextStepDialogOpen(true)}
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
        <Dialog open={confirmCallback} onOpenChange={setConfirmCallback}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar para reclamar?</DialogTitle>
              <DialogDescription>
                {selected?.contactId
                  ? `Vai criar um follow-up "Rechamar ${selected.customerName || selected.phone || "cliente"}" agendado para daqui a 1 hora, visível na Agenda.`
                  : "Este número ainda não está identificado, por isso não é criado nenhum follow-up na Agenda — só se regista o estado da chamada."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConfirmCallback(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setConfirmCallback(false)
                  void handleCallback()
                }}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          <Link
            to={crmUrl}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
            title="Abrir Ficha 360 do Cliente"
          >
            <ExternalLink className="h-4 w-4" />
            Ficha 360
          </Link>
        )}
      </div>

      {/* Modal de Recuperação de Chamada Não Atendida / Perdida via WhatsApp */}
      <TelecofMissedCallRecoveryModal
        open={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        phone={selected.phone || selected.normalizedPhone || ""}
        customerName={identity?.record?.company_name || identity?.record?.contact_name || selected.customerName}
      />

      {/* Dialog de Atendimento Tratado — Próximo Passo Obrigatório */}
      <QuickNextStepDialog
        open={nextStepDialogOpen}
        onClose={() => setNextStepDialogOpen(false)}
        contactId={identity?.kind === "contact" && identity.record?.id ? String(identity.record.id) : null}
        customerName={identity?.record?.company_name || identity?.record?.contact_name || selected.customerName}
        phone={selected.phone || selected.normalizedPhone}
        onDone={() => {
          void handleStatus("resolved", "Tratado")
        }}
      />
    </div>
  )
}
