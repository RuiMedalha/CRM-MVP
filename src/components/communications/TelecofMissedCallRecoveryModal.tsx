import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { MessageCircle, Send, CheckCircle2, Loader2, Sparkles } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { sendTextViaEvolution } from "@/integrations/evolution/client"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"
import { createInteraction } from "@/integrations/directus/interactions"
import { useTelecofCallStore } from "@/store/telecofCallStore"
import type { TelecofCallEventRecord } from "@/types/telecof"

interface Props {
  call: TelecofCallEventRecord | null
  open: boolean
  onClose: () => void
  onRecovered?: () => void
}

const TEMPLATES = [
  {
    id: "standard",
    label: "Padrão de Central",
    text: "Olá! Vimos que nos ligou há pouco para a equipa da Profihotel, mas infelizmente não conseguimos atender a tempo. Em que podemos ajudar?",
  },
  {
    id: "direct",
    label: "Direto / Encomenda",
    text: "Olá! Verificámos a sua chamada não atendida. Tem alguma questão sobre um equipamento, cotação ou encomenda? Estamos disponíveis para ajudar por aqui!",
  },
  {
    id: "quotation",
    label: "Orçamento / Comercial",
    text: "Olá! Agradecemos o seu contacto telefónico. Pretende obter informações sobre preços, disponibilidade ou orçamentos? Pode indicar-nos aqui os detalhes.",
  },
]

export function TelecofMissedCallRecoveryModal({
  call,
  open,
  onClose,
  onRecovered,
}: Props) {
  const navigate = useNavigate()
  const mergeEvent = useTelecofCallStore((s) => s.mergeEvent)

  const [selectedTemplateId, setSelectedTemplateId] = useState("standard")
  const [messageText, setMessageText] = useState(TEMPLATES[0].text)
  const [sending, setSending] = useState(false)

  if (!call) return null

  const phone = call.normalizedPhone || call.phone || ""
  const customerName = call.customerName?.trim() || phone

  function handleSelectTemplate(tplId: string) {
    setSelectedTemplateId(tplId)
    const t = TEMPLATES.find((x) => x.id === tplId)
    if (t) setMessageText(t.text)
  }

  async function handleSendViaEvolution() {
    if (!phone) {
      toast({ title: "Número de telefone inválido", variant: "destructive" })
      return
    }
    setSending(true)
    try {
      // 1. Enviar mensagem de texto pelo Evolution API (instância activa 918)
      await sendTextViaEvolution(phone, messageText.trim())

      // 2. Marcar a chamada como tratada e registar que foi recuperada via WhatsApp
      const now = new Date().toISOString()
      const updated = await patchHubCommunicationEvent(call.id, {
        status: "resolved",
        call_status: "missed",
        resolved_at: now,
        resolution_note: `Recuperada via WhatsApp pós-chamada não atendida: "${messageText.trim().slice(0, 80)}…"`,
        raw_payload: {
          ...(call.rawPayload ?? {}),
          call_qualification: "missed",
          missed_call_recovery_sent_at: now,
        },
      })
      mergeEvent(updated)

      // 3. Dual-write na timeline de interações do cliente
      await createInteraction({
        contact_id: call.contactId,
        type: "message",
        direction: "out",
        status: "done",
        source: "whatsapp",
        phone,
        summary: `Recuperação de Chamada Não Atendida via WhatsApp`,
        occurred_at: now,
        payload: {
          text: messageText.trim(),
          call_id: call.id,
          phone,
        },
      }).catch(() => {})

      toast({
        title: "Mensagem enviada com sucesso!",
        description: `Recuperação via WhatsApp enviada para ${phone}. A chamada foi marcada como tratada.`,
      })
      onRecovered?.()
      onClose()
    } catch (err) {
      toast({
        title: "Erro ao enviar mensagem",
        description: String((err as Error)?.message || "Verifique a ligação da Evolution API"),
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  function handleOpenInChat() {
    onClose()
    navigate(`/comunicacoes?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(messageText.trim())}`)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="h-5 w-5" />
            </span>
            Recuperação de Chamada Não Atendida
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Envie uma mensagem de WhatsApp instantânea para <strong>{customerName}</strong> ({phone}) e recupere esta oportunidade comercial antes que contacte um concorrente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Seletor de Modelo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              Escolha um modelo de mensagem:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTemplate(t.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                    selectedTemplateId === t.id
                      ? "bg-primary/10 border-primary/40 text-primary font-semibold shadow-xs"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editor da Mensagem */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Mensagem a enviar:
            </label>
            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-3 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Escreva a mensagem de recuperação..."
            />
            <p className="text-[11px] text-muted-foreground">
              A mensagem será enviada pelo número WhatsApp conectado da empresa.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenInChat}>
            💬 Abrir no Chat do CRM
          </Button>

          <Button
            size="sm"
            disabled={sending || !messageText.trim()}
            onClick={() => void handleSendViaEvolution()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>{sending ? "A enviar…" : "Enviar via WhatsApp Agora"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
