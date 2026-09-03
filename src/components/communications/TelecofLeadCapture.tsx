/**
 * TelecofLeadCapture — formulário de captura rápida para números desconhecidos.
 * Permite criar ou um Lead (pipeline de prospeção) ou um Contacto (Ficha Cliente 360).
 */
import { useState, useEffect, useCallback } from "react"
import { UserPlus, UserRoundPlus, Loader2, ExternalLink, Building2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { directusRequest } from "@/integrations/directus/client"
import { createContact } from "@/integrations/directus/contacts"
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
  phone: string
  callId: string
}

export function TelecofLeadCapture({ phone, callId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mergeEvent = useTelecofCallStore((s) => s.mergeEvent)
  const draftKey = `telecof_lead_${callId}`

  const [activeTab, setActiveTab] = useState<"lead" | "contact">("lead")

  // Draft state
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

  // Autosave draft
  useEffect(() => {
    const t = setTimeout(() => {
      sessionStorage.setItem(draftKey, JSON.stringify({ name, requestType }))
    }, 500)
    return () => clearTimeout(t)
  }, [name, requestType, draftKey])

  // 1. Criar Lead (pipeline de prospeção)
  const handleSaveLead = useCallback(async () => {
    if (!name.trim() && !requestType) {
      toast({ title: "Preencha o nome da empresa ou o tipo de assunto", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const displayName = name.trim() || `Chamada ${phone}`
      await directusRequest<{ data: { id: string | number } }>("/items/leads", {
        method: "POST",
        body: JSON.stringify({
          display_name: displayName,
          contact_name: contactPerson.trim() || displayName,
          phone,
          contact_phone: phone,
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
            call_id: callId,
            city: city.trim() || undefined,
          },
        }),
      })

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
    } catch (err) {
      toast({
        title: "Erro ao criar lead",
        description: String((err as Error)?.message || ""),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [name, contactPerson, phone, email, requestType, notes, callId, city, draftKey, mergeEvent, queryClient])

  // 2. Criar Contacto Definitivo (Ficha Cliente 360)
  const handleSaveContact = useCallback(async () => {
    if (!name.trim()) {
      toast({ title: "Nome da empresa / cliente é obrigatório", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const companyName = name.trim()
      const created = await createContact({
        company_name: companyName,
        contact_name: contactPerson.trim() || companyName,
        phone,
        email: email.trim() || undefined,
        nif: nif.trim() || undefined,
        city: city.trim() || undefined,
        source: "telecof",
        notes: notes.trim() || (requestType ? `Origem: Chamada Telecof (${requestType})` : undefined),
      } as any)

      const contactId = created?.id ?? (created as any)?.data?.id
      if (contactId) {
        setCreatedContactId(contactId)
        // Associar imediatamente à chamada
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
        title: "Contacto / Cliente 360 criado!",
        description: `${companyName} guardado no CRM.`,
      })
    } catch (err) {
      toast({
        title: "Erro ao criar contacto",
        description: String((err as Error)?.message || ""),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [name, contactPerson, phone, email, nif, city, notes, requestType, callId, draftKey, mergeEvent, queryClient])

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

  if (savedType === "contact") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 space-y-2">
        <p className="text-xs font-semibold text-green-800 dark:text-green-300">✓ Cliente 360 criado com sucesso</p>
        <p className="text-xs text-green-700 dark:text-green-400">
          O contacto foi criado e associado a esta chamada.
        </p>
        {createdContactId && (
          <button
            type="button"
            onClick={() => navigate(`/customer360-shell/${createdContactId}`)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline dark:text-green-300"
          >
            <ExternalLink className="h-3 w-3" /> Abrir Ficha do Cliente #{createdContactId}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Número desconhecido ({phone})
          </h3>
        </div>
      </div>

      <p className="text-xs text-amber-700 dark:text-amber-400">
        Este número não está registado. Escolha se pretende registar como <strong>Lead</strong> (para triagem comercial) ou <strong>Contacto Definitivo</strong> (Cliente 360).
      </p>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 w-full h-8 bg-amber-100/80 dark:bg-amber-900/30">
          <TabsTrigger value="lead" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-card gap-1">
            <UserRoundPlus className="h-3.5 w-3.5 text-amber-600" />
            Criar Lead
          </TabsTrigger>
          <TabsTrigger value="contact" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-card gap-1">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            Criar Contacto (360)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CRIAR LEAD */}
        <TabsContent value="lead" className="space-y-2.5 pt-2 mt-0">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente / empresa *"
            className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
          />

          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações rápidas do pedido..."
            className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
          />

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveLead()}
            className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
            {saving ? "A registar Lead..." : "Registar como Lead"}
          </button>
        </TabsContent>

        {/* TAB 2: CRIAR CONTACTO (CLIENTE 360) */}
        <TabsContent value="contact" className="space-y-2.5 pt-2 mt-0">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Empresa / Nome *"
              className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Pessoa de contacto"
              className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              value={nif}
              onChange={(e) => setNif(e.target.value)}
              placeholder="NIF / Contribuinte"
              className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade"
              className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas"
              className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveContact()}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              {saving ? "A criar..." : "Criar Contacto (360)"}
            </button>

            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams()
                if (phone) params.set("phone", phone)
                if (name.trim()) params.set("name", name.trim())
                if (email.trim()) params.set("email", email.trim())
                if (nif.trim()) params.set("nif", nif.trim())
                if (city.trim()) params.set("city", city.trim())
                params.set("source", "telecof_call")
                navigate(`/customer360-shell/novo?${params.toString()}`)
              }}
              className="rounded-lg border border-border bg-white dark:bg-card px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted"
              title="Abrir formulário de criação completo"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
