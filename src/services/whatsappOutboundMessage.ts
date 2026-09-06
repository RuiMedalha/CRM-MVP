/**
 * Serviço de envio de mensagens WhatsApp para o CRM.
 * Usa Evolution (916) ou Meta Cloud API (913) dependendo da conversa.
 */
import {
  sendTextViaEvolution,
  sendImageViaEvolution,
  sendAudioViaEvolution,
  sendDocumentViaEvolution,
  uploadToDirectus,
  fileToBase64 as evoFileToBase64,
} from "@/integrations/evolution/client"

import { sendTextViaWA913, sendMediaViaWA913, sendTemplateViaWA913 } from "@/integrations/directus/wa913"

import {
  createMessage,
  HUB_DEFAULT_AGENT,
  type CreateDirectusMessagePayload,
} from "@/integrations/directus/hubConversations"

import { directusRequest } from "@/integrations/directus/client"

import { inferMediaTypeFromFile } from "@/lib/fileMedia"

import type { Conversation } from "@/types/conversation"
import type { Message } from "@/types/message"
import type { MessageAttachment } from "@/types/communication"

function extractPhoneFromConversation(conv: Conversation): string {
  if (conv.source) {
    // Formato Meta Cloud API (913): "meta:913:351916542271"
    const metaMatch = conv.source.match(/^meta:[^:]+:(\d{7,15})$/)
    if (metaMatch) return metaMatch[1]
    const jid = conv.source
      .replace(/@s\.whatsapp\.net$/i, "")
      .replace(/@c\.us$/i, "")
      .replace(/@g\.us$/i, "")
    if (/^\d{7,15}$/.test(jid)) return jid
  }
  return ""
}

type WhatsAppProvider = 'evolution' | 'meta' | 'none'

function resolveWhatsAppProvider(conv: Conversation): WhatsAppProvider {
  // 1. Se tem instanceName (preenchido pelo n8n) — é Evolution
  if (conv.instanceName === 'hotelequip-918') return 'evolution'
  if (conv.instanceName === 'hotelequip-916') return 'evolution'
  if (conv.instanceName === 'hotelequip-913') return 'meta'
  // 2. Se channel é whatsapp_meta — é Meta Cloud API
  if (conv.channel === 'whatsapp_meta') return 'meta'
  // 3. Se source contém 913866565 e sem instanceName — é Meta (conversa legacy)
  if (conv.source?.includes('913866565') && !conv.instanceName) return 'meta'
  // 4. Se channel é whatsapp ou whatsapp_group — é Evolution
  if (conv.channel === 'whatsapp' || conv.channel === 'whatsapp_group') return 'evolution'
  // 5. Canais não-WhatsApp (askme, email, telecof) — sem provider de envio
  if (conv.channel === 'askme' || conv.channel === 'email' || conv.channel === 'telecof') return 'none'
  // 6. Fallback
  return 'evolution'
}

function resolveEvolutionInstance(conv: Conversation): string {
  // 1. Se tem instanceName guardado — usa directamente
  if (conv.instanceName === 'hotelequip-918' || conv.instanceName?.includes('918')) return 'hotelequip-918'
  if (conv.instanceName === 'hotelequip-916' || conv.instanceName?.includes('916')) return 'hotelequip-916'

  // 2. Fallback — hotelequip-916 (canal comercial ativo no Evolution)
  return 'hotelequip-916'
}

export interface SendAgentMessageResult {
  message: Message
  evolution: { ok: boolean; skipped?: boolean; reason?: string }
}

/** Update conversation summary after sending a message */
async function patchConversationSummary(conversationId: string, content: string): Promise<void> {
  const now = new Date().toISOString()
  directusRequest(`/items/conversations/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      last_message: content.slice(0, 255),
      updated_at: now,
      last_activity_at: now,
    }),
  }).catch(() => { /* non-blocking — conversation still works without summary update */ })
}

export async function sendAgentMessage(
  conversation: Conversation,
  content: string,
  agentName: string = HUB_DEFAULT_AGENT,
): Promise<SendAgentMessageResult> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error("Mensagem vazia")

  const payload: CreateDirectusMessagePayload = {
    conversation_id: conversation.id,
    sender_type: "agent",
    sender_name: agentName,
    content: trimmed,
    delivery_status: "pending",
  }

  const message = await createMessage(payload)

  // Update conversation summary immediately
  patchConversationSummary(conversation.id, trimmed)

  const provider = resolveWhatsAppProvider(conversation)

  if (provider === 'none') {
    return {
      message: { ...message, deliveryStatus: 'sent' },
      evolution: { ok: true, skipped: true, reason: 'Canal não WhatsApp' },
    }
  }

  const phone = extractPhoneFromConversation(conversation)
  if (!phone) {
    return {
      message,
      evolution: { ok: false, reason: "Número de telefone não encontrado na conversa" },
    }
  }

  try {
    let providerMessageId: string | undefined;
    if (provider === 'meta') {
      const metaResult = await sendTextViaWA913(phone, trimmed)
      providerMessageId = (metaResult as any)?.messages?.[0]?.id ?? undefined;
    } else {
      const evoResult = await sendTextViaEvolution(phone, trimmed, resolveEvolutionInstance(conversation))
      providerMessageId = (evoResult as any)?.data?.key?.id ?? (evoResult as any)?.key?.id ?? undefined;
    }
    // Phase 2.F2: Persistir delivery_status=sent + provider_message_id no Directus
    directusRequest(`/items/messages/${encodeURIComponent(message.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        delivery_status: "sent",
        external_message_id: providerMessageId || null,
      }),
    }).catch(() => { /* non-blocking */ })
    return { message: { ...message, deliveryStatus: 'sent', externalMessageId: providerMessageId }, evolution: { ok: true } }
  } catch (err) {
    // Phase 2.F2: Persistir delivery_status=failed no Directus
    directusRequest(`/items/messages/${encodeURIComponent(message.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ delivery_status: "failed" }),
    }).catch(() => { /* non-blocking */ })
    return {
      message: { ...message, deliveryStatus: 'failed' },
      evolution: {
        ok: false,
        reason: err instanceof Error ? err.message : `Falha ao enviar via ${provider}`,
      },
    }
  }
}

export interface SendAgentTemplateInput {
  name: string
  language: string
  components: object[]
  preview: string
}

export async function sendAgentTemplateMessage(
  conversation: Conversation,
  template: SendAgentTemplateInput,
  agentName: string = HUB_DEFAULT_AGENT,
): Promise<SendAgentMessageResult> {
  if (resolveWhatsAppProvider(conversation) !== "meta") {
    throw new Error("Templates oficiais só podem ser enviados pela instância 913")
  }

  const phone = extractPhoneFromConversation(conversation)
  if (!phone) throw new Error("Número de telefone não encontrado na conversa")

  const content = template.preview.trim() || `Template: ${template.name}`
  const message = await createMessage({
    conversation_id: conversation.id,
    sender_type: "agent",
    sender_name: agentName,
    content,
    content_type: "template",
    delivery_status: "pending",
  })

  patchConversationSummary(conversation.id, content)

  try {
    const result = await sendTemplateViaWA913(
      phone,
      template.name,
      template.language,
      template.components,
    )
    directusRequest(`/items/messages/${encodeURIComponent(message.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        delivery_status: "sent",
        external_message_id: result.messageId || null,
      }),
    }).catch(() => { /* non-blocking */ })
    return {
      message: { ...message, deliveryStatus: "sent", externalMessageId: result.messageId },
      evolution: { ok: true },
    }
  } catch (err) {
    directusRequest(`/items/messages/${encodeURIComponent(message.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ delivery_status: "failed" }),
    }).catch(() => { /* non-blocking */ })
    return {
      message: { ...message, deliveryStatus: "failed" },
      evolution: {
        ok: false,
        reason: err instanceof Error ? err.message : "Falha ao enviar template via Meta",
      },
    }
  }
}

export async function sendAgentMedia(
  conversation: Conversation,
  file: File | Blob,
  filename: string,
  caption?: string,
  agentName: string = HUB_DEFAULT_AGENT,
): Promise<SendAgentMessageResult> {
  const mediaType = inferMediaTypeFromFile(file, filename)
  const mimeType = file instanceof File ? file.type : file.type || "application/octet-stream"
  const fileObj = file instanceof File ? file : new File([file], filename, { type: mimeType })

  const placeholderAttachment: MessageAttachment = {
    type: mediaType,
    filename,
    mimeType,
    placeholder: true,
  }

  const message = await createMessage({
    conversation_id: conversation.id,
    sender_type: "agent",
    sender_name: agentName,
    content: caption || filename,
    content_type: mediaType,
    attachments: [placeholderAttachment],
    delivery_status: "pending",
  })

  // Update conversation summary immediately
  patchConversationSummary(conversation.id, caption || `📎 ${filename}`)

  const provider = resolveWhatsAppProvider(conversation)

  if (provider === 'none') {
    return {
      message: { ...message, deliveryStatus: 'sent' },
      evolution: { ok: true, skipped: true },
    }
  }

  const phone = extractPhoneFromConversation(conversation)
  if (!phone) {
    return {
      message,
      evolution: { ok: false, reason: "Número de telefone não encontrado na conversa" },
    }
  }

  try {
    let mediaUrl: string | null = null
    try {
      mediaUrl = await uploadToDirectus(fileObj)
    } catch {
      // fallback: proceed without URL (evolution still sends via base64 for docs)
    }

    if (provider === 'meta') {
      // Meta Cloud API — envio via URL
      if (!mediaUrl) throw new Error('Upload falhou — Meta Cloud API requer URL pública')
      const metaType = (() => {
        if (mimeType.startsWith('image/')) return 'image' as const
        if (mimeType.startsWith('video/')) return 'video' as const
        if (mimeType.startsWith('audio/')) return 'audio' as const
        return 'document' as const
      })()
      await sendMediaViaWA913(phone, metaType, mediaUrl, filename)
    } else {
      // Evolution API — envio via base64 ou URL
      const instance = resolveEvolutionInstance(conversation)
      if (mediaType === "image" && mediaUrl) {
        await sendImageViaEvolution(phone, mediaUrl, caption, false, instance)
      } else if (mediaType === "video" && mediaUrl) {
        await sendImageViaEvolution(phone, mediaUrl, caption, true, instance)
      } else if (mediaType === "audio") {
        if (mediaUrl) {
          await sendAudioViaEvolution(phone, mediaUrl, instance)
        } else {
          const base64 = await evoFileToBase64(fileObj)
          await sendDocumentViaEvolution(phone, base64, mimeType, filename, instance)
        }
      } else {
        const base64 = await evoFileToBase64(fileObj)
        await sendDocumentViaEvolution(phone, base64, mimeType, filename, instance)
      }
    }

    const attachment: MessageAttachment = {
      type: mediaType,
      filename: fileObj.name,
      mimeType,
      placeholder: false,
      url: mediaUrl ?? undefined,
    }

    // PATCH the message in Directus with the real attachment URL + delivery status
    if (message.id) {
      directusRequest(`/items/messages/${message.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          attachments: [attachment],
          delivery_status: "sent",
        }),
      }).catch(() => { /* non-blocking */ });
    }

    return {
      message: { ...message, deliveryStatus: "sent", attachments: [attachment] },
      evolution: { ok: true },
    }
  } catch (err) {
    return {
      message,
      evolution: {
        ok: false,
        reason: err instanceof Error ? err.message : "Falha ao enviar media",
      },
    }
  }
}
