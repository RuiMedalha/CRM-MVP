import { useEffect, useRef, useState, useCallback } from "react"
import { useConversationStore } from "@/store/conversationStore"
import { useMessageStore } from "@/store/messageStore"
import { aiRouter } from "@/services/ai/router"
import { sendAgentMessage } from "@/services/whatsappOutboundMessage"
import { fetchMessagesWithFallback } from "@/integrations/directus/hubConversations"
import { findContactByPhone } from "@/integrations/directus/contactLookup"
import { getContactById } from "@/integrations/directus/contacts"
import { toast } from "@/hooks/use-toast"
import type { Message } from "@/types/message"
import type { Conversation } from "@/types/conversation"

export type AutoAiMode = "off" | "always" | "out_of_hours"

export const AUTO_AI_STORAGE_KEY = "crm_whatsapp_auto_ai_master"
export const AUTO_AI_MODE_KEY = "crm_whatsapp_auto_ai_mode"

/**
 * Verifica se o momento atual está dentro do horário de atendimento da HotelEquip:
 * 2ª a 6ª feira (dias úteis): 09:00 - 13:00 e 14:00 - 18:00 (Fuso horário de Lisboa/Portugal)
 */
export function isWithinBusinessHours(date: Date = new Date()): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Lisbon",
      hour12: false,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
    })
    const parts = formatter.formatToParts(date)
    const partMap: Record<string, string> = {}
    for (const p of parts) partMap[p.type] = p.value

    const weekday = partMap.weekday // "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
    if (weekday === "Sat" || weekday === "Sun") return false

    const hour = parseInt(partMap.hour || "0", 10)
    const minute = parseInt(partMap.minute || "0", 10)
    const totalMinutes = hour * 60 + minute

    const morning = totalMinutes >= 9 * 60 && totalMinutes < 13 * 60
    const afternoon = totalMinutes >= 14 * 60 && totalMinutes < 18 * 60
    return morning || afternoon
  } catch {
    const day = date.getDay()
    if (day === 0 || day === 6) return false
    const h = date.getHours()
    return (h >= 9 && h < 13) || (h >= 14 && h < 18)
  }
}

export function getAutoAiMode(): AutoAiMode {
  if (typeof window === "undefined" || !window.localStorage) return "off"
  const mode = localStorage.getItem(AUTO_AI_MODE_KEY)
  if (mode === "always" || mode === "out_of_hours" || mode === "off") return mode
  return localStorage.getItem(AUTO_AI_STORAGE_KEY) === "true" ? "always" : "off"
}

export function setAutoAiModeState(mode: AutoAiMode): void {
  if (typeof window === "undefined" || !window.localStorage) return
  localStorage.setItem(AUTO_AI_MODE_KEY, mode)
  localStorage.setItem(AUTO_AI_STORAGE_KEY, mode !== "off" ? "true" : "false")
}

export function getAutoAiMasterState(): boolean {
  return getAutoAiMode() !== "off"
}

export function setAutoAiMasterState(enabled: boolean): void {
  setAutoAiModeState(enabled ? "always" : "off")
}

function isEligibleWhatsAppConversation(conv: Conversation, masterMode: AutoAiMode): boolean {
  const isWhatsApp =
    conv.channel === "whatsapp" ||
    conv.channel === "whatsapp_group" ||
    conv.channel === "whatsapp_meta" ||
    conv.channel?.startsWith("wa")

  if (!isWhatsApp) return false
  if (conv.status === "closed" || conv.status === "deleted" || conv.status === "archived") return false

  // Se o operador assumiu manualmente a conversa, a IA não interfere
  if (conv.status === "human_active" && conv.mode !== "bot") return false

  // 1. ATIVAÇÃO INDIVIDUAL: Se o utilizador ligou o Piloto Automático especificamente no cabeçalho DESTA conversa
  const isSpecificallyEnabledForThisClient =
    conv.status === "ai_active" || conv.mode === "bot" || Boolean(conv.aiEnabled)

  if (isSpecificallyEnabledForThisClient) {
    return true
  }

  // 2. ATIVAÇÃO GLOBAL: Depende do modo Master
  if (masterMode === "always") {
    return true
  }

  if (masterMode === "out_of_hours") {
    return !isWithinBusinessHours()
  }

  // Se masterMode === "off" e este cliente não está ativado individualmente, ignora
  return false
}

const globalProcessingSet = new Set<string>()
const globalPendingTimers = new Map<string, NodeJS.Timeout>()
const globalLastRepliedMsgId = new Map<string, string>()

export function useWhatsAppAutoResponder() {
  const [autoAiMode, setAutoAiModeCurrent] = useState<AutoAiMode>(() => getAutoAiMode())
  const autoAiActive = autoAiMode !== "off"

  const setAutoAiMode = useCallback((mode: AutoAiMode) => {
    setAutoAiModeState(mode)
    setAutoAiModeCurrent(mode)
    if (mode === "off") {
      globalPendingTimers.forEach((t) => clearTimeout(t))
      globalPendingTimers.clear()
    }
    const titles: Record<AutoAiMode, string> = {
      off: "🛑 Piloto Automático Geral DESLIGADO",
      always: "🤖 Piloto Automático: SEMPRE ATIVO (24/7)",
      out_of_hours: "🌙 Piloto Automático: APENAS FORA DE HORAS",
    }
    const descs: Record<AutoAiMode, string> = {
      off: "Apenas responderá a clientes onde o robô for ativado individualmente.",
      always: "A IA responderá a todas as novas mensagens recebidas de qualquer cliente.",
      out_of_hours: "A IA responderá automaticamente fora do horário comercial (dias úteis das 09h às 13h e 14h às 18h).",
    }
    toast({
      title: titles[mode],
      description: descs[mode],
    })
  }, [])

  const setAutoAiActive = useCallback(
    (enabled: boolean) => {
      setAutoAiMode(enabled ? "always" : "off")
    },
    [setAutoAiMode],
  )

  const allMessages = useMessageStore((s) => s.messages)
  const conversations = useConversationStore((s) => s.conversations)

  const handleRespondToConversation = useCallback(
    async (conv: Conversation, messages: Message[]) => {
      const sorted = [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      const lastMsg = sorted[sorted.length - 1]

      if (!lastMsg || lastMsg.senderType !== "customer") return
      if (!lastMsg.content || !lastMsg.content.trim()) return

      // REGRA DE SEGURANÇA MÁXIMA: NUNCA responder a mensagens antigas!
      // Apenas mensagens recebidas nos últimos 2 minutos (120 segundos) são elegíveis.
      const msgTimestamp = new Date(lastMsg.createdAt).getTime()
      if (Number.isNaN(msgTimestamp) || Date.now() - msgTimestamp > 120_000) {
        return
      }

      // Evitar responder se já respondemos a esta mensagem
      if (globalProcessingSet.has(lastMsg.id)) return
      if (globalLastRepliedMsgId.get(conv.id) === lastMsg.id) return

      if (globalPendingTimers.has(conv.id)) {
        clearTimeout(globalPendingTimers.get(conv.id)!)
      }

      const timer = setTimeout(async () => {
        globalPendingTimers.delete(conv.id)
        if (globalProcessingSet.has(lastMsg.id)) return
        globalProcessingSet.add(lastMsg.id)
        globalLastRepliedMsgId.set(conv.id, lastMsg.id)

        try {
          const recentHistory = sorted.slice(-8)
          const historyText = recentHistory
            .map(
              (m) =>
                (m.senderType === "customer" ? "Cliente" : "HotelEquip") +
                ": " +
                (m.content || "(mídia)"),
            )
            .join("\n")

          let crmContext = ""
          try {
            const rawPhone = conv.source || conv.customerName || ""
            const phoneDigits = rawPhone.replace(/^meta:[^:]+:/, "").replace(/@.*$/, "").replace(/\D/g, "")
            const contactId = conv.contactId || (phoneDigits.length >= 7 ? await findContactByPhone(phoneDigits) : null)
            if (contactId) {
              const contact = await getContactById(contactId)
              if (contact) {
                const cName = contact.company_name || contact.contact_name || ""
                const nifStr = contact.nif ? `NIF: ${contact.nif}` : "sem NIF registado"
                const addrStr = [contact.address, contact.city].filter(Boolean).join(", ")
                crmContext = `\n\n[DADOS LOCALIZADOS NO CRM]: Cliente já identificado na ficha: "${cName}" (${nifStr}). Morada da sede/fiscal registada: ${addrStr || "não registada"}.`
              }
            } else {
              crmContext = `\n\n[DADOS DO CRM]: Cliente ainda sem ficha identificada no sistema por este contacto.`
            }
          } catch {
            // non-blocking
          }

          const customerName = conv.customerName || "o cliente"
          const hasPreviousAgentReplies = recentHistory.some(
            (m) => m.senderType === "agent" || m.senderType === "user",
          )

          const prompt =
            "Histórico da conversa no WhatsApp com " +
            customerName +
            ":\n" +
            historyText +
            crmContext +
            "\n\n" +
            'A ÚLTIMA mensagem enviada pelo cliente foi: "' +
            lastMsg.content +
            '"\n\n' +
            "Gera a próxima resposta direta da HotelEquip para este cliente:"

          const inHours = isWithinBusinessHours()
          const outOfHoursInstruction = !inHours
            ? "\n6. REGRA ESTRITA DE FORA DE HORÁRIO:\n" +
              "   - Estamos de momento FORA DO HORÁRIO DE EXPEDIENTE (o nosso horário de atendimento é de 2ª a 6ª feira das 09:00 às 13:00 e 14:00 às 18:00).\n" +
              "   - Dá um acolhimento simpático e breve, informando que a mensagem foi registada e que a nossa equipa entrará em contacto no início do próximo dia útil.\n" +
              "   - Solicita desde já os detalhes necessários (NIF da empresa, marca/modelo do equipamento e morada ou avaria) para agilizar o tratamento logo de manhã.\n"
            : ""

          const systemPrompt =
            "És o assistente comercial e de suporte da HotelEquip (equipamentos para hotelaria e restauração em Portugal) a responder em tempo real no WhatsApp.\n" +
            "O teu tom é profissional, rápido, acolhedor e em Português de Portugal.\n\n" +
            "REGRAS DE OURO:\n" +
            (hasPreviousAgentReplies
              ? "1. A conversa JÁ ESTÁ EM CURSO. É TERMINANTEMENTE PROIBIDO dizer 'Olá', 'Agradecemos o seu contacto', repetir saudações formais ou repetir o nome do cliente. Responde direto ao assunto como uma pessoa real no chat.\n"
              : "1. Faz um acolhimento inicial cordial e objetivo.\n") +
            "2. CONTINUIDADE REAL: Lê a última mensagem do cliente e responde especificamente a ela. Não repitas o que já disseste nas mensagens anteriores.\n" +
            "3. REGRA ESTRITA DE GARANTIA E ASSISTÊNCIA TÉCNICA:\n" +
            "   - NUNCA assumas ou declares que o equipamento está garantido ou que a reparação é gratuita sem validação documental prévia.\n" +
            "   - Mostra compreensão pelo transtorno, mas esclarece que para a nossa equipa técnica analisar e verificar o processo de garantia é necessário facultar o NIF da empresa ou enviar foto da fatura de compra.\n" +
            "   - Morada: se houver morada no CRM, pergunta com naturalidade se o equipamento avariado está instalado nessa morada ou noutro local. Se não houver, pede a morada de instalação.\n" +
            "4. Tamanho: Máximo de 1 a 2 frases curtas e diretas.\n" +
            "5. Sem aspas, sem markdown, sem parecer um robô mecânico." +
            outOfHoursInstruction

          const result = await aiRouter.completeWithFallback(prompt, {
            systemPrompt,
            maxTokens: 200,
            temperature: 0.3,
          })

          const replyText = result.text?.trim()
          if (!replyText) return

          await sendAgentMessage(conv, replyText)

          toast({
            title: "🤖 Resposta automática enviada a " + customerName,
            description: '"' + replyText.slice(0, 70) + (replyText.length > 70 ? "..." : "") + '"',
          })
        } catch (err) {
          console.error("[AutoAI] Falha ao responder automaticamente:", err)
        }
      }, 3000)

      globalPendingTimers.set(conv.id, timer)
    },
    [],
  )

  // Monitorização em tempo real: ativa se o modo master estiver ligado OU se houver conversas com IA ativada individualmente
  useEffect(() => {
    const hasAnyIndividualActive = conversations.some(
      (c) => c.status === "ai_active" || c.mode === "bot" || Boolean(c.aiEnabled),
    )

    if (autoAiMode === "off" && !hasAnyIndividualActive) {
      globalPendingTimers.forEach((t) => clearTimeout(t))
      globalPendingTimers.clear()
      return
    }

    const convMsgMap = new Map<string, Message[]>()
    for (const msg of allMessages) {
      if (!msg.conversationId) continue
      const list = convMsgMap.get(msg.conversationId) || []
      list.push(msg)
      convMsgMap.set(msg.conversationId, list)
    }

    for (const [convId, msgs] of convMsgMap.entries()) {
      const conv = conversations.find((c) => c.id === convId)
      if (!conv) continue
      if (!isEligibleWhatsAppConversation(conv, autoAiMode)) continue

      void handleRespondToConversation(conv, msgs)
    }
  }, [allMessages, conversations, autoAiMode, handleRespondToConversation])

  return {
    autoAiActive,
    autoAiMode,
    setAutoAiMode,
    setAutoAiActive,
    isWithinBusinessHours,
  }
}
