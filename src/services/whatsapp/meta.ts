import { directusRequest } from "@/integrations/directus/client";
import type {
  WhatsAppAdapter,
  WhatsAppInstance,
  SendMessagePayload,
  SendResult,
  QRCodeResult,
  NormalizedIncomingMessage,
  WebhookSubscriptionPayload,
  WhatsAppMediaType,
} from "./types";

const GRAPH_API_VERSION = "v18.0";
const META_BASE_URL = "https://graph.facebook.com";

function cleanPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 9 && cleaned.startsWith("9")) {
    cleaned = `351${cleaned}`;
  }
  return cleaned;
}

export class MetaCloudAdapter implements WhatsAppAdapter {
  readonly provider = "meta" as const;

  async sendMessage(
    instance: WhatsAppInstance,
    payload: SendMessagePayload | string,
    toOverride?: string,
  ): Promise<SendResult> {
    const data: SendMessagePayload =
      typeof payload === "string" ? { to: toOverride || "", body: payload } : payload;

    const recipient = cleanPhoneNumber(toOverride || data.to);
    if (!recipient) {
      return { success: false, status: "failed", error: "Número de destino Meta inválido ou vazio" };
    }

    const phoneNumberId = instance.phone_number_id || instance.instance_id || "943101945557713";
    const token = instance.access_token;

    try {
      // 1. Tenta envio através do proxy do backend Directus /wa-proxy (mais seguro)
      const proxyBody: Record<string, unknown> = {
        provider: "meta",
        action: data.mediaUrl ? "sendMedia" : data.templateName ? "sendTemplate" : "sendText",
        number: recipient,
        phoneNumberId,
        text: data.body,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType || "image",
        templateName: data.templateName,
        templateLanguage: data.templateLanguage || "pt_PT",
        templateComponents: data.templateComponents,
      };

      const proxyRes = await directusRequest<{ ok?: boolean; messages?: Array<{ id: string }> }>(
        "/wa-proxy",
        {
          method: "POST",
          body: JSON.stringify(proxyBody),
        },
      ).catch((err) => {
        console.warn("Meta send via wa-proxy falhou, tentando chamada direta ao Graph API:", err);
        return null;
      });

      if (proxyRes && (proxyRes.ok || proxyRes.messages?.length)) {
        const wamid = proxyRes.messages?.[0]?.id || `wamid_meta_${Date.now()}`;
        return {
          success: true,
          status: "sent",
          whatsappId: wamid,
          rawResponse: proxyRes,
        };
      }

      // 2. Fallback direto à Meta Graph API v18.0
      if (!token) {
        throw new Error("Token de acesso Meta Cloud API não fornecido para envio direto.");
      }

      const url = `${META_BASE_URL}/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`;

      let messagePayload: Record<string, unknown>;

      if (data.templateName) {
        messagePayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: data.templateName,
            language: { code: data.templateLanguage || "pt_PT" },
            components: data.templateComponents || [],
          },
        };
      } else if (data.mediaUrl) {
        const type = data.mediaType === "document" ? "document" : data.mediaType === "audio" ? "audio" : "image";
        const mediaObj: Record<string, unknown> = { link: data.mediaUrl };
        if (data.caption && type !== "audio") {
          mediaObj.caption = data.caption;
        }
        if (data.fileName && type === "document") {
          mediaObj.filename = data.fileName;
        }

        messagePayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type,
          [type]: mediaObj,
        };
      } else {
        messagePayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: true,
            body: data.body,
          },
        };
      }

      if (data.quotedMessageId) {
        messagePayload.context = {
          message_id: data.quotedMessageId,
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      });

      const resJson = await res.json().catch(() => ({}));

      if (!res.ok || resJson.error) {
        const errorMsg = resJson.error?.message || `Meta Graph API HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      const wamid = resJson.messages?.[0]?.id || `wamid_meta_${Date.now()}`;
      return {
        success: true,
        status: "sent",
        whatsappId: wamid,
        rawResponse: resJson,
      };
    } catch (err: any) {
      console.error("Meta sendMessage erro:", err);
      return {
        success: false,
        status: "failed",
        error: err.message || "Erro desconhecido ao enviar mensagem via Meta Cloud API",
      };
    }
  }

  async getQRCode(instance: WhatsAppInstance): Promise<QRCodeResult> {
    // Meta Cloud API é uma integração oficial baseada em Token Permanente de API
    const hasToken = Boolean(instance.access_token || instance.phone_number_id);
    if (hasToken) {
      return {
        status: "connected",
        message: "Meta Cloud API conectada via Token Permanente Oficial (WABA). Não necessita de QR Code.",
      };
    }
    return {
      status: "disconnected",
      message: "Configure o Phone Number ID e o Access Token permanente da Meta para conectar.",
    };
  }

  async subscribeWebhook(
    instance: WhatsAppInstance,
    config: WebhookSubscriptionPayload,
  ): Promise<{ success: boolean; message?: string }> {
    const wabaId = instance.business_account_id;
    const token = instance.access_token;

    if (!wabaId || !token) {
      return {
        success: true,
        message: "Webhook da Meta deve ser configurado no Meta Developer Portal apontando para " + config.webhookUrl,
      };
    }

    try {
      // Subscrição programática da App na WABA
      const url = `${META_BASE_URL}/${GRAPH_API_VERSION}/${encodeURIComponent(wabaId)}/subscribed_apps`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const resJson = await res.json().catch(() => ({}));
      if (res.ok && resJson.success) {
        return { success: true, message: "Subscrição de Webhook Meta concluída com sucesso" };
      }
      return {
        success: false,
        message: resJson.error?.message || "Falha ao subscrever app no Meta WABA",
      };
    } catch (err: any) {
      return { success: false, message: err.message || "Erro de rede ao subscrever webhook Meta" };
    }
  }

  normalizeIncoming(payload: any, instance?: WhatsAppInstance): NormalizedIncomingMessage[] {
    if (!payload) return [];

    const messages: NormalizedIncomingMessage[] = [];

    // Estrutura padrão Meta Cloud API:
    // payload.entry[].changes[].value.messages[]
    const entries = payload.entry || [payload];

    for (const entry of entries) {
      const changes = entry.changes || [entry];
      for (const change of changes) {
        const value = change.value || change;
        const rawMessages = value.messages || [];
        const contacts = value.contacts || [];

        const contactNameMap = new Map<string, string>();
        for (const c of contacts) {
          if (c.wa_id && c.profile?.name) {
            contactNameMap.set(c.wa_id, c.profile.name);
          }
        }

        for (const item of rawMessages) {
          const fromNumber = cleanPhoneNumber(item.from || "");
          const senderName = contactNameMap.get(item.from) || item.from;
          const whatsappId = item.id || `wamid_${Date.now()}`;
          const timestampSeconds = parseInt(item.timestamp, 10) || Math.floor(Date.now() / 1000);
          const timestamp = new Date(timestampSeconds * 1000);

          let body = "";
          let mediaType: WhatsAppMediaType | undefined = undefined;
          let mediaUrl: string | undefined = undefined;
          let mimeType: string | undefined = undefined;
          let fileName: string | undefined = undefined;

          const type = item.type;

          if (type === "text" && item.text) {
            body = item.text.body || "";
          } else if (type === "image" && item.image) {
            body = item.image.caption || "[Imagem Meta]";
            mediaType = "image";
            mimeType = item.image.mime_type || "image/jpeg";
            mediaUrl = item.image.id ? `/wa-media/${item.image.id}` : undefined;
          } else if (type === "audio" && item.audio) {
            body = "[Áudio]";
            mediaType = "audio";
            mimeType = item.audio.mime_type || "audio/ogg";
            mediaUrl = item.audio.id ? `/wa-media/${item.audio.id}` : undefined;
          } else if (type === "video" && item.video) {
            body = item.video.caption || "[Vídeo]";
            mediaType = "video";
            mimeType = item.video.mime_type || "video/mp4";
            mediaUrl = item.video.id ? `/wa-media/${item.video.id}` : undefined;
          } else if (type === "document" && item.document) {
            body = item.document.caption || item.document.filename || "[Documento]";
            mediaType = "document";
            fileName = item.document.filename || "documento.pdf";
            mimeType = item.document.mime_type || "application/pdf";
            mediaUrl = item.document.id ? `/wa-media/${item.document.id}` : undefined;
          } else if (type === "button" && item.button) {
            body = item.button.text || "[Resposta de Botão]";
          } else if (type === "interactive" && item.interactive) {
            body =
              item.interactive.button_reply?.title ||
              item.interactive.list_reply?.title ||
              "[Resposta Interativa]";
          } else if (type === "contacts") {
            body = "[Contacto Partilhado]";
            mediaType = "contacts";
          } else if (type === "location" && item.location) {
            body = `[Localização: ${item.location.latitude}, ${item.location.longitude}]`;
            mediaType = "location";
          } else if (type === "reaction" && item.reaction) {
            body = item.reaction.emoji || "👍";
          } else {
            body = item.body || "[Mensagem recebida via Meta]";
          }

          const quotedMessageId = item.context?.id || undefined;

          messages.push({
            whatsappId,
            instanceId: instance?.id,
            provider: "meta",
            from: fromNumber || "Desconhecido",
            to: instance?.phone_number || value.metadata?.display_phone_number || "",
            body: body || "[Sem conteúdo]",
            direction: "inbound",
            mediaUrl,
            mediaType,
            mimeType,
            fileName,
            timestamp,
            senderName,
            isGroup: false,
            quotedMessageId,
            rawPayload: item,
          });
        }
      }
    }

    return messages;
  }

  async validateCredentials(
    instance: Partial<WhatsAppInstance>,
  ): Promise<{ valid: boolean; error?: string; details?: unknown }> {
    const phoneNumberId = instance.phone_number_id || instance.instance_id;
    const token = instance.access_token;

    if (!phoneNumberId || !token) {
      return { valid: false, error: "Phone Number ID e Access Token são obrigatórios para validar Meta." };
    }

    try {
      const url = `${META_BASE_URL}/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=verified_name,display_phone_number,code_verification_status,quality_rating`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        return {
          valid: false,
          error: data.error?.message || `Erro de validação Meta (${res.status})`,
          details: data,
        };
      }

      return {
        valid: true,
        details: {
          verified_name: data.verified_name,
          display_phone_number: data.display_phone_number,
          quality_rating: data.quality_rating,
          code_verification_status: data.code_verification_status,
        },
      };
    } catch (err: any) {
      return { valid: false, error: err.message || "Erro ao conectar à Meta API" };
    }
  }

  async checkStatus(
    instance: WhatsAppInstance,
  ): Promise<{ status: "connected" | "disconnected" | "qr_pending"; lastSeenAt?: string; details?: unknown }> {
    if (!instance.access_token || !instance.phone_number_id) {
      return { status: "disconnected" };
    }

    const validation = await this.validateCredentials(instance);
    if (validation.valid) {
      return {
        status: "connected",
        lastSeenAt: new Date().toISOString(),
        details: validation.details,
      };
    }
    return { status: "disconnected", details: validation.error };
  }
}

export const metaAdapter = new MetaCloudAdapter();
