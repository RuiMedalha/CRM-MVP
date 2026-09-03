/**
 * TelecofLeadCapture — formulário inline de captura de lead para números desconhecidos.
 * Aparece no TelecofCallWorkspace quando identifyByPhoneOrEmail devolve "unknown".
 * Grava directamente em /items/leads com autosave debounced.
 */
import { useState, useEffect, useCallback } from "react"
import { UserPlus, Loader2 } from "lucide-react"
import { directusRequest } from "@/integrations/directus/client"
import { toast } from "@/hooks/use-toast"

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
  const draftKey = `telecof_lead_${callId}`

  // Restaurar draft do sessionStorage
  const [name, setName] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || "{}").name || "" } catch { return "" }
  })
  const [requestType, setRequestType] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || "{}").requestType || "" } catch { return "" }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Autosave draft ao sessionStorage
  useEffect(() => {
    const t = setTimeout(() => {
      sessionStorage.setItem(draftKey, JSON.stringify({ name, requestType }))
    }, 500)
    return () => clearTimeout(t)
  }, [name, requestType, draftKey])

  const handleSaveLead = useCallback(async () => {
    if (!name.trim() && !requestType) {
      toast({ title: "Preenche pelo menos o nome ou tipo de assunto", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await directusRequest("/items/leads", {
        method: "POST",
        body: JSON.stringify({
          display_name: name.trim() || `Telecof ${phone}`,
          phone,
          source: "telecof",
          status: "incoming",
          type: "call",
          notes: requestType ? `Assunto: ${REQUEST_TYPES.find(r => r.value === requestType)?.label || requestType}` : undefined,
          lead_data: {
            request_type: requestType || undefined,
            call_id: callId,
          },
        }),
      })
      setSaved(true)
      sessionStorage.removeItem(draftKey)
      toast({ title: "Lead criado", description: `${name.trim() || phone} registado. Promover a contacto na página de Leads.` })
    } catch (err) {
      toast({ title: "Erro ao criar lead", description: String((err as Error)?.message || ""), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [name, requestType, phone, callId, draftKey])

  if (saved) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 text-center">
        <p className="text-xs font-medium text-green-800 dark:text-green-300">✓ Lead registado com sucesso</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-amber-600" />
        <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300">Número desconhecido — registar lead</h3>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Este número não está no CRM. Preenche os dados para criar um lead.
      </p>

      {/* Nome */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do cliente / empresa"
        className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
      />

      {/* Tipo de assunto */}
      <select
        value={requestType}
        onChange={(e) => setRequestType(e.target.value)}
        className="w-full rounded-lg border border-amber-200 bg-white dark:bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
      >
        {REQUEST_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Botão gravar */}
      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSaveLead()}
        className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
        {saving ? "A gravar..." : "Registar lead"}
      </button>
    </div>
  )
}
