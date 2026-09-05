import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { TrendingUp, FileText, Plus, Loader2, DollarSign, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"

import { createDeal } from "@/integrations/directus/deals"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "@/hooks/use-toast"

interface Props {
  contactId?: string | null
  customerName?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  currentCallId?: string | null
  onDealCreated?: (deal: any) => void
  defaultOpen?: boolean
}

const STAGES = [
  { id: "lead", label: "Novo Lead" },
  { id: "qualificacao", label: "Qualificação" },
  { id: "proposta", label: "Proposta Enviada" },
  { id: "negociacao", label: "Negociação" },
]

export function QuickDealAndQuotationCard({
  contactId,
  customerName,
  phone,
  email,
  notes,
  currentCallId,
  onDealCreated,
  defaultOpen = false,
}: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [dealTitle, setDealTitle] = useState("")
  const [dealAmount, setDealAmount] = useState("")
  const [dealStage, setDealStage] = useState("lead")
  const [submitting, setSubmitting] = useState(false)

  const displayName = customerName?.trim() || phone || "Cliente"

  async function handleCreateDeal() {
    const title = dealTitle.trim() || `Oportunidade - ${displayName}`
    const amount = dealAmount ? parseFloat(dealAmount.replace(",", ".")) : 0

    setSubmitting(true)
    try {
      const payload: any = {
        title,
        status: dealStage,
        total_amount: Number.isFinite(amount) ? amount : 0,
        customer_id: contactId || undefined,
        owner_employee_id: user?.id || undefined,
        assigned_employee_id: user?.id || undefined,
      }

      const created = await createDeal(payload)
      queryClient.invalidateQueries({ queryKey: ["deals"] })
      queryClient.invalidateQueries({ queryKey: ["pipeline"] })
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: ["customer360", contactId] })
      }

      toast({
        title: "Oportunidade criada no Funil de Vendas!",
        description: `"${title}" foi adicionada à etapa "${STAGES.find((s) => s.id === dealStage)?.label}".`,
      })

      setDealTitle("")
      setDealAmount("")
      onDealCreated?.(created)
      setIsOpen(false)
    } catch (err) {
      toast({
        title: "Erro ao criar oportunidade",
        description: String((err as Error)?.message || "Não foi possível gravar no pipeline"),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  function handleCreateQuotation() {
    const params = new URLSearchParams()
    if (contactId) params.set("customer_id", contactId)
    if (customerName) params.set("name", customerName)
    if (phone) params.set("phone", phone)
    if (email) params.set("email", email)
    if (notes) params.set("notes", notes.slice(0, 150))
    navigate(`/propostas/nova?${params.toString()}`)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Aceleração Comercial & Vendas
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Converta este contacto numa proposta oficial ou oportunidade no pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCreateQuotation}
            className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 px-2.5 py-1 text-xs font-semibold transition-colors"
            title="Abrir elaboração de proposta comercial com os dados deste cliente"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Gerar Proposta</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 px-2.5 py-1 text-xs font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Criar Negócio</span>
            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="pt-2 border-t border-border space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Título da Oportunidade
              </label>
              <input
                type="text"
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value)}
                placeholder={`Oportunidade - ${displayName}`}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-0.5">
                <DollarSign className="h-3 w-3" /> Valor Estimado (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                placeholder="Ex: 1250.00"
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Etapa:</span>
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDealStage(s.id)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium border transition ${
                    dealStage === s.id
                      ? "bg-primary/15 border-primary/40 text-primary font-bold"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleCreateDeal()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span>{submitting ? "A gravar…" : "Gravar no Funil"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
