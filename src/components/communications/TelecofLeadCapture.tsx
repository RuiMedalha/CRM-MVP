/**
 * TelecofLeadCapture — formulário de captura rápida para números desconhecidos.
 * Permite preencher diretamente as linhas de contacto (Ficha Cliente 360),
 * associar a um cliente existente ou criar um Lead de prospeção.
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { UserPlus, UserRoundPlus, Loader2, ExternalLink, Building2, Search, Link2, Check, User } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { directusRequest } from "@/integrations/directus/client"
import { createContact, getContactById } from "@/integrations/directus/contacts"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"
import { useTelecofCallStore } from "@/store/telecofCallStore"
import { toast } from "@/hooks/use-toast"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const REQUEST_TYPES = [
  { value: "", label: "— Tipo de assunto —" },
  { value: "orcamento", label: "Orçamento" },
  { value: "assistencia_tecnica", label: "Assistência técnica" },
  { value: "encomenda", label: "Encomenda" },
  { value: "reclamacao", label: "Reclamação" },
  { value: "informacao", label: "Informação" },
  { value: "outro", label: "Outro" },
] as const

interface Props {
  phone?: string
  callId?: string
  onContactCreated?: (contact: any, contactId: string | number) => void
  onLeadCreated?: (lead: any, leadId: string | number) => void
}

export function TelecofLeadCapture({ phone = "", callId = "", onContactCreated, onLeadCreated }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mergeEvent = useTelecofCallStore((s) => s.mergeEvent)
  const draftKey = `telecof_lead_${callId || "manual"}`

  const [activeTab, setActiveTab] = useState<"contact" | "lead">("contact")

  // Draft state
  const [phoneInput, setPhoneInput] = useState(phone || "")
  useEffect(() => {
    setPhoneInput(phone || "")
  }, [phone])

  const [name, setName] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || "{}").name || "" } catch { return "" }
  })
  const [contactPerson, setContactPerson] = useState("")
  const [email, setEmail] = useState("")
  const [nif, setNif] = useState("")
  const [city, setCity] = useState("")
  const [requestType, setRequestType] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || "{}").requestType || "" } catch { return "" }
  })
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [savedType, setSavedType] = useState<"lead" | "contact" | null>(null)
  const [createdContactId, setCreatedContactId] = useState<string | number | null>(null)

  // Search existing contact to link
  const [searchQuery, setSearchQuery] = useState("")
  const [searchingContacts, setSearchingContacts] = useState(false)
  const [contactResults, setContactResults] = useState<Array<{
    id: string | number
    company_name?: string
    contact_name?: string
    name?: string
    phone?: string
    email?: string
    nif?: string
    city?: string
  }>>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autosave draft
  useEffect(() => {
    const t = setTimeout(() => {
      sessionStorage.setItem(draftKey, JSON.stringify({ name, requestType, contactPerson, email, nif, city, notes }))
    }, 500)
    return () => clearTimeout(t)
  }, [name, requestType, contactPerson, email, nif, city, notes, draftKey])

  // Search existing contacts debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    const q = searchQuery.trim()
    if (!q || q.length < 2) {
      setContactResults([])
      setShowSearchDropdown(false)
      return
    }

    setSearchingContacts(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(q)
        const res = await directusRequest<{ data: any[] }>(
          `/items/contacts?search=${encoded}&limit=6&fields=id,company_name,contact_name,name,phone,email,nif,city`
        )
        setContactResults(res?.data || [])
        setShowSearchDropdown(true)
      } catch {
        setContactResults([])
      } finally {
        setSearchingContacts(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery])

  // Link existing contact
  const handleLinkExistingContact = async (contact: any) => {
    setSaving(true)
    try {
      const contactId = String(contact.id)
      const companyName = String(contact.company_name || contact.name || contact.contact_name || "").trim()

      if (callId) {
        const updated = await patchHubCommunicationEvent(callId, {
          contact_id: contactId,
          customer_name: companyName || undefined,
        }).catch(() => null)
        if (updated) mergeEvent(updated)
      }

      setCreatedContactId(contactId)
      setSavedType("contact")
      sessionStorage.removeItem(draftKey)
      setShowSearchDropdown(false)
      setSearchQuery("")
      queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
      toast({
        title: "Contacto associado com sucesso!",
        description: `Esta chamada foi vinculada à ficha de ${companyName || `#${contactId}`}.`,
      })
      if (onContactCreated) {
        onContactCreated(contact, contactId)
      }
    } catch (err) {
      toast({
        title: "Erro ao associar contacto",
        description: String((err as Error)?.message || ""),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // 1. Criar Contacto Definitivo (Ficha Cliente 360)
  const handleSaveContact = useCallback(async () => {
    if (!name.trim()) {
      toast({ title: "Nome da empresa / cliente é obrigatório", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const companyName = name.trim()
      const contactPayload = {
        company_name: companyName,
        contact_name: contactPerson.trim() || companyName,
        phone: phoneInput.trim() || undefined,
        email: email.trim() || undefined,
        nif: nif.trim() || undefined,
        city: city.trim() || undefined,
        source: "telecof",
        notes: notes.trim() || (requestType ? `Origem: Chamada Telecof (${requestType})` : undefined),
      }
      const created = await createContact(contactPayload as any)

      const contactId = created?.id ?? (created as any)?.data?.id
      if (contactId) {
        setCreatedContactId(contactId)
        // Associar imediatamente à chamada se houver callId
        if (callId) {
          const updated = await patchHubCommunicationEvent(callId, {
            contact_id: String(contactId),
            customer_name: companyName,
          }).catch(() => null)
          if (updated) mergeEvent(updated)
        }
      }

      setSavedType("contact")
      sessionStorage.removeItem(draftKey)
      queryClient.invalidateQueries({ queryKey: ["contacts-directus"] })
      queryClient.invalidateQueries({ queryKey: ["customer360"] })
      toast({
        title: "Ficha do Cliente 360 criada!",
        description: `${companyName} registado no CRM.`,
      })
      if (onContactCreated && contactId) {
        onContactCreated(created || { id: contactId, ...contactPayload }, contactId)
      }
    } catch (err) {
      toast({
        title: "Erro ao criar contacto",
        description: String((err as Error)?.message || ""),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [name, contactPerson, phoneInput, email, nif, city, notes, requestType, callId, draftKey, mergeEvent, queryClient, onContactCreated])

  // 2. Criar Lead (pipeline de prospeção)
  const handleSaveLead = useCallback(async () => {
    if (!name.trim() && !requestType) {
      toast({ title: "Preencha o nome da empresa ou o tipo de assunto", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const displayName = name.trim() || (phoneInput.trim() ? `Chamada ${phoneInput.trim()}` : "Novo Lead")
      const leadPayload = {
        display_name: displayName,
        contact_name: contactPerson.trim() || displayName,
        phone: phoneInput.trim() || undefined,
        contact_phone: phoneInput.trim() || undefined,
        email: email.trim() || undefined,
        source: "telecof",
        status: "incoming",
        type: "call",
        notes: [
          requestType ? `Assunto: ${REQUEST_TYPES.find(r => r.value === requestType)?.label || requestType}` : null,
          notes.trim() || null,
        ].filter(Boolean).join("\n\n") || undefined,
        lead_data: {
          request_type: requestType || undefined,
          call_id: callId || undefined,
          city: city.trim() || undefined,
        },
      }
      const res = await directusRequest<{ data: { id: string | number } }>("/items/leads", {
        method: "POST",
        body: JSON.stringify(leadPayload),
      })

      const leadId = res?.data?.id

      // Atualizar nome da chamada
      if (callId) {
        const updated = await patchHubCommunicationEvent(callId, {
          customer_name: displayName,
        }).catch(() => null)
        if (updated) mergeEvent(updated)
      }

      setSavedType("lead")
      sessionStorage.removeItem(draftKey)
      queryClient.invalidateQueries({ queryKey: ["leads-page"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast({
        title: "Lead criado com sucesso",
        description: `${displayName} registado na lista de leads.`,
      })
      if (onLeadCreated && leadId) {
        onLeadCreated({ id: leadId, ...leadPayload }, leadId)
      }
    } catch (err) {
      toast({
        title: "Erro ao criar lead",
        description: String((err as Error)?.message || ""),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [name, contactPerson, phone, email, requestType, notes, callId, city, draftKey, mergeEvent, queryClient, onLeadCreated])

  if (savedType === "contact") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4 space-y-2">
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">✓ Cliente 360 associado com sucesso</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          A ficha do cliente foi vinculada a esta chamada e o dossiê está disponível.
        </p>
        {createdContactId && (
          <button
            type="button"
            onClick={() => navigate(`/customer360-shell/${createdContactId}`)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            <ExternalLink className="h-3 w-3" /> Abrir Ficha Completa #{createdContactId}
          </button>
        )}
      </div>
    )
  }

  if (savedType === "lead") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 space-y-2">
        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">✓ Lead registado na fila de prospeção</p>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          O lead foi criado e pode ser gerido na página de Leads.
        </p>
        <button
          type="button"
          onClick={() => navigate("/leads")}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
        >
          <ExternalLink className="h-3 w-3" /> Ver página de Leads
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-sm">
      {/* Header & Quick Search */}
      <div className="flex flex-col gap-2 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Ficha do Chamador {phone ? `(${phone})` : ""}
            </h3>
          </div>
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
            Contacto Novo / Não Registado
          </span>
        </div>

        {/* Live Link to Existing Contact */}
        <div className="relative mt-1">
          <div className="flex items-center rounded-lg border border-border bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-primary/30">
            <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar cliente existente para associar (nome, nif, telefone)..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {searchingContacts && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0 ml-1" />}
          </div>

          {showSearchDropdown && contactResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Clientes Encontrados:</p>
              {contactResults.map((c) => {
                const cName = c.company_name || c.name || c.contact_name || `Contacto #${c.id}`
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={saving}
                    onClick={() => void handleLinkExistingContact(c)}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{cName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.phone ? `Tel: ${c.phone}` : ""} {c.nif ? `· NIF: ${c.nif}` : ""} {c.city ? `· ${c.city}` : ""}
                      </p>
                    </div>
                    <span className="ml-2 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
                      <Link2 className="h-3 w-3" /> Associar
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Formulário Unificado de Preenchimento Imediato da Ficha */}
      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Empresa / Nome Comercial *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Hotel Mar & Sol Lda"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Pessoa de Contacto
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Ex: João Pereira"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Telefone
            </label>
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Ex: 917226585 ou +351917226585"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: compras@hotelmarsol.pt"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              NIF / Contribuinte
            </label>
            <input
              type="text"
              value={nif}
              onChange={(e) => setNif(e.target.value)}
              placeholder="Ex: 509123456"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Cidade / Localidade
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex: Lisboa"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Tipo de Assunto
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Observações / Notas da Chamada
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Interessado em forno combinado e mesa inox..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Acções Diretas: Criar Contacto ou Criar Lead */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-border">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveContact()}
            className="flex-1 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            {saving ? "A guardar..." : "Criar Contacto (Ficha 360)"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveLead()}
            className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
            Criar Lead (Prospeção)
          </button>

          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams()
              if (phoneInput.trim()) params.set("phone", phoneInput.trim())
              if (name.trim()) params.set("name", name.trim())
              if (email.trim()) params.set("email", email.trim())
              if (nif.trim()) params.set("nif", nif.trim())
              if (city.trim()) params.set("city", city.trim())
              params.set("source", "telecof_call")
              navigate(`/customer360-shell/novo?${params.toString()}`)
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1"
            title="Abrir no formulário avançado de criação"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ficha Avançada
          </button>
        </div>
      </div>
    </div>
  )
}
