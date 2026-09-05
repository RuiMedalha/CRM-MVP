import { useState } from "react"
import { Calendar, Phone, FileText, Clock, Check, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createFollowUp } from "@/integrations/directus/follow-ups"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "@/hooks/use-toast"

interface Props {
  open: boolean
  onClose: () => void
  contactId?: string | null
  customerName?: string | null
  phone?: string | null
  onDone: () => void
}

export function QuickNextStepDialog({
  open,
  onClose,
  contactId,
  customerName,
  phone,
  onDone,
}: Props) {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const name = customerName?.trim() || phone || "Cliente"

  async function handleSchedule(hours: number, type: "call" | "task", titlePrefix: string) {
    setSubmitting(true)
    try {
      const dueAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
      const title = `${titlePrefix} ${name}`

      await createFollowUp({
        contact_id: contactId || undefined,
        type,
        status: "open",
        title,
        due_at: dueAt,
        assigned_employee_id: user?.id || undefined,
      })

      toast({
        title: "Próximo passo agendado na Agenda!",
        description: `"${title}" agendado para ${new Date(dueAt).toLocaleString("pt-PT")}.`,
      })
      onDone()
      onClose()
    } catch {
      toast({
        title: "Chamada tratada",
        description: "Não foi possível criar o follow-up automático.",
      })
      onDone()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    onDone()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </span>
            Atendimento Tratado — Próximo Passo
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            No modelo de vendas de alta performance, <strong>nenhum cliente activo fica sem próximo passo</strong>. Deseja agendar um seguimento para <strong>{name}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSchedule(24, "call", "Ligar para")}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Phone className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground">Ligar amanhã (+24h)</p>
                <p className="text-[11px] text-muted-foreground">Rechamar para dar seguimento ou esclarecer dúvidas</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary">Amanhã</span>
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSchedule(2, "task", "Enviar cotação para")}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground">Enviar Cotação / Proposta (+2h)</p>
                <p className="text-[11px] text-muted-foreground">Elaborar e enviar orçamento por email ou WhatsApp</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary">Em 2 horas</span>
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSchedule(72, "task", "Follow-up comercial com")}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-foreground">Follow-up comercial (+3 dias)</p>
                <p className="text-[11px] text-muted-foreground">Verificar decisão de compra ou interesse</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary">3 dias</span>
          </button>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            Concluir sem agendamento
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
