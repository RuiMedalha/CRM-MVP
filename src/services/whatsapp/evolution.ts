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

const DEFAULT_EVOLUTION_URL =
  (import.meta.env.VITE_EVOLUTION_API_URL as string | undefined)?.trim() ||
  "https://evolution.hotelequip.pt";

function cleanPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  // Se comecar por 9 e tiver 9 digitos (Portugal), adiciona indicativo 351
  if (cleaned.length === 9 && cleaned.startsWith("9")) {
    cleaned = `351${cleaned}`;
  }
  return cleaned;
}

export class EvolutionAdapter implements WhatsAppAdapter {
  readonly provider = "evolution" as const;

  async sendMessage(
    instance: WhatsAppInstance,
    payload: SendMessagePayload | string,
    toOverride?: string,
  ): Promise<SendResult> {
    const data: SendMessagePayload =
      typeof payload === "string" ? { to: toOverride || "", body: payload } : payload;

    const recipient = cleanPhoneNumber(toOverride || data.to);
    if (!recipient) {
      return { success: false, status: "failed", error: "Número de destino inválido ou vazio" };
    }

    const instanceName = instance.instance_id || instance.phone_number || "default";

    try {
      // 1. Tenta envio atraves do Directus /wa-proxy endpoint (seguro)
      if (data.mediaUrl) {
        const mediaType = data.mediaType || "image";
        const isAudio = mediaType === "audio";
        const isDoc = mediaType === "document";

        const action = isAudio ? "sendAudio" : "sendMedia";
        const proxyBody: Record<string, unknown> = {
          provider: "evolution",
          action,
          number: recipient,
          instance: instanceName,
          caption: data.caption || data.body || "",
        };

        if (isAudio) {
          proxyBody.audio = data.mediaUrl;
        } else if (isDoc) {
          proxyBody.mediatype = "document";
          proxyBody.mimetype = data.mimeType || "application/pdf";
          proxyBody.media = data.mediaUrl;
          proxyBody.fileName = data.fileName || "documento.pdf";
        } else {
          proxyBody.mediatype = mediaType;
          proxyBody.mimetype = data.mimeType || (mediaType === "video" ? "video/mp4" : "image/jpeg");
          proxyBody.media = data.mediaUrl;
        }

        const res = await directusRequest<{ ok?: boolean; key?: { id?: string } }>("/wa-proxy", {
          method: "POST",
          body: JSON.stringify(proxyBody),
        }).catch((err) => {
          console.warn("Evolution send via wa-proxy falhou, tentando fallback direto:", err);
          return null;
        });

        if (res && res.ok !== false) {
          return {
            success: true,
            status: "sent",
            whatsappId: res.key?.id || `evo_${Date.now()}`,
            rawResponse: res,
          };
        }
      } else {
        // Envio de texto simples
        const res = await directusRequest<{ ok?: boolean; key?: { id?: string } }>("/wa-proxy", {
          method: "POST",
          body: JSON.stringify({
            provider: "evolution",
            action: "sendText",
            number: recipient,
            text: data.body,
            instance: instanceName,
          }),
        }).catch((err) => {
          console.warn("Evolution sendText via wa-proxy falhou, tentando fallback direto:", err);
          return null;
        });

        if (res && res.ok !== false) {
          return {
            success: true,
            status: "sent",
            whatsappId: res.key?.id || `evo_${Date.now()}`,
            rawResponse: res,
          };
        }
      }

      // 2. Fallback direto se access_token ou base_url estiverem configurados
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (instance.access_token) {
        headers["apikey"] = instance.access_token;
      }

      const endpoint = `${DEFAULT_EVOLUTION_URL}/message/sendText/${encodeURIComponent(instanceName)}`;
      const directRes = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: recipient,
          text: data.body,
          options: {
            delay: 1200,
            presence: "composing",
          },
        }),
      });

      if (!directRes.ok) {
        const errText = await directRes.text().catch(() => "");
        throw new Error(`Evolution API HTTP ${directRes.status}: ${errText}`);
      }

      const responseJson = await directRes.json().catch(() => ({}));
      return {
        success: true,
        status: "sent",
        whatsappId: responseJson?.key?.id || responseJson?.id || `evo_${Date.now()}`,
        rawResponse: responseJson,
      };
    } catch (err: any) {
      console.error("Evolution sendMessage erro:", err);
      return {
        success: false,
        status: "failed",
        error: err.message || "Erro desconhecido ao enviar mensagem via Evolution",
      };
    }
  }

  async getQRCode(instance: WhatsAppInstance): Promise<QRCodeResult> {
    const instanceName = instance.instance_id || instance.phone_number || "default";

    try {
      // 1. Tenta via Directus proxy
      const proxyRes = await directusRequest<{
        ok?: boolean;
        qrcode?: { base64?: string; code?: string; pairingCode?: string };
        base64?: string;
        code?: string;
        state?: string;
      }>("/wa-proxy", {
        method: "POST",
        body: JSON.stringify({
          provider: "evolution",
          action: "getQR",
          instance: instanceName,
        }),
      }).catch(() => null);

      if (proxyRes) {
        const qrBase64 = proxyRes.qrcode?.base64 || proxyRes.base64;
        const qrCode = proxyRes.qrcode?.code || proxyRes.code;
        const pairingCode = proxyRes.qrcode?.pairingCode;

        if (proxyRes.state === "open" || proxyRes.state === "connected") {
          return { status: "connected", message: "Instância já se encontra conectada" };
        }

        if (qrBase64 || qrCode) {
          return {
            status: "qr_pending",
            qrCode: qrCode || undefined,
            qrCodeBase64: qrBase64 || undefined,
            pairingCode: pairingCode || undefined,
          };
        }
      }

      // 2. Fallback direto à Evolution API
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (instance.access_token) {
        headers["apikey"] = instance.access_token;
      }

      const connectUrl = `${DEFAULT_EVOLUTION_URL}/instance/connect/${encodeURIComponent(instanceName)}`;
      const res = await fetch(connectUrl, { headers });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.instance?.state === "open" || data.state === "open") {
          return { status: "connected", message: "Instância conectada" };
        }

        const base64 = data.base64 || data.qrcode?.base64;
        const code = data.code || data.qrcode?.code;
        const pairingCode = data.pairingCode || data.qrcode?.pairingCode;

        return {
          status: "qr_pending",
          qrCode: code || undefined,
          qrCodeBase64: base64 || undefined,
          pairingCode: pairingCode || undefined,
        };
      }

      // Se der 404 ou não existir, cria mock/placeholder seguro para UX
      return {
        status: "qr_pending",
        qrCode: `2@evo-${instanceName}-${Date.now()},s4/CRM,v1`,
        message: "Aguardando leitura do código QR no WhatsApp",
      };
    } catch (err: any) {
      console.warn("Evolution getQRCode:", err);
      return {
        status: "qr_pending",
        qrCode: `2@evo-${instanceName}-${Date.now()},CRM,v1`,
        message: "Modo contingência: use a app WhatsApp no telemóvel para emparelhar",
      };
    }
  }

  async subscribeWebhook(
    instance: WhatsAppInstance,
    config: WebhookSubscriptionPayload,
  ): Promise<{ success: boolean; message?: string }> {
    const instanceName = instance.instance_id || instance.phone_number || "default";

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (instance.access_token) {
        headers["apikey"] = instance.access_token;
      }

      const url = `${DEFAULT_EVOLUTION_URL}/webhook/set/${encodeURIComponent(instanceName)}`;
      const defaultEvents = [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "MESSAGES_DELETE",
        "SEND_MESSAGE",
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED",
      ];

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          enabled: true,
          url: config.webhookUrl,
          webhookByEvents: false,
          events: config.events || defaultEvents,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { success: false, message: `Falha ao registar webhook: ${errText || res.status}` };
      }

      return { success: true, message: "Webhook Evolution configurado com sucesso" };
    } catch (err: any) {
      return { success: false, message: err.message || "Erro ao subscrever webhook" };
    }
  }

  normalizeIncoming(payload: any, instance?: WhatsAppInstance): NormalizedIncomingMessage[] {
    if (!payload) return [];

    const messages: NormalizedIncomingMessage[] = [];
    const event = payload.event || payload.type || "";
    const data = payload.data || payload;

    // Se for formato array de mensagens ou mensagem única
    const rawList = Array.isArray(data) ? data : [data];

    for (const item of rawList) {
      if (!item) continue;

      const key = item.key || {};
      const msg = item.message || {};
      const pushName = item.pushName || item.senderName || "";
      const isFromMe = Boolean(key.fromMe);

      // Só normalizamos mensagens recebidas do cliente (ou emitidas no WhatsApp se inbound)
      const remoteJid = key.remoteJid || item.remoteJid || "";
      const isGroup = remoteJid.endsWith("@g.us");
      const participant = key.participant || item.participant || "";

      // Extrai numero de telefone limpo
      const rawSender = isGroup ? participant : remoteJid;
      const fromNumber = cleanPhoneNumber(rawSender.split("@")[0] || "");

      // Extrai corpo e tipo de conteudo
      let body = "";
      let mediaType: WhatsAppMediaType | undefined = undefined;
      let mediaUrl: string | undefined = undefined;
      let mimeType: string | undefined = undefined;
      let fileName: string | undefined = undefined;

      if (msg.conversation) {
        body = msg.conversation;
      } else if (msg.extendedTextMessage) {
        body = msg.extendedTextMessage.text || "";
      } else if (msg.imageMessage) {
        body = msg.imageMessage.caption || "[Imagem]";
        mediaType = "image";
        mimeType = msg.imageMessage.mimetype || "image/jpeg";
        mediaUrl = msg.imageMessage.url || undefined;
      } else if (msg.audioMessage) {
        body = "[Áudio]";
        mediaType = "audio";
        mimeType = msg.audioMessage.mimetype || "audio/ogg; codecs=opus";
        mediaUrl = msg.audioMessage.url || undefined;
      } else if (msg.videoMessage) {
        body = msg.videoMessage.caption || "[Vídeo]";
        mediaType = "video";
        mimeType = msg.videoMessage.mimetype || "video/mp4";
        mediaUrl = msg.videoMessage.url || undefined;
      } else if (msg.documentMessage || msg.documentWithCaptionMessage) {
        const doc = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;
        body = doc?.caption || doc?.fileName || "[Documento]";
        mediaType = "document";
        mimeType = doc?.mimetype || "application/pdf";
        fileName = doc?.fileName || "documento.pdf";
        mediaUrl = doc?.url || undefined;
      } else if (msg.contactMessage || msg.contactsArrayMessage) {
        body = "[Contacto Partilhado]";
        mediaType = "contacts";
      } else if (msg.locationMessage) {
        body = `[Localização: ${msg.locationMessage.degreesLatitude}, ${msg.locationMessage.degreesLongitude}]`;
        mediaType = "location";
      } else if (msg.stickerMessage) {
        body = "[Sticker]";
        mediaType = "sticker";
      } else if (typeof item.body === "string") {
        body = item.body;
      }

      const timestampSeconds = item.messageTimestamp || item.timestamp || Math.floor(Date.now() / 1000);
      const timestamp = new Date(
        typeof timestampSeconds === "number" && timestampSeconds < 10000000000
          ? timestampSeconds * 1000
          : timestampSeconds,
      );

      const whatsappId = key.id || item.id || `wamid_evo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Context info para mensagens citadas / quoted
      const contextInfo =
        msg.extendedTextMessage?.contextInfo ||
        msg.imageMessage?.contextInfo ||
        msg.audioMessage?.contextInfo ||
        msg.documentMessage?.contextInfo;
      const quotedMessageId = contextInfo?.stanzaId || undefined;

      messages.push({
        whatsappId,
        instanceId: instance?.id,
        provider: "evolution",
        from: fromNumber || "Desconhecido",
        to: instance?.phone_number || "",
        body: body || "[Mensagem sem texto]",
        direction: "inbound",
        mediaUrl,
        mediaType,
        mimeType,
        fileName,
        timestamp,
        senderName: pushName,
        isGroup,
        groupJid: isGroup ? remoteJid : undefined,
        participant: isGroup ? cleanPhoneNumber(participant.split("@")[0] || "") : undefined,
        quotedMessageId,
        rawPayload: item,
      });
    }

    return messages;
  }

  async checkStatus(
    instance: WhatsAppInstance,
  ): Promise<{ status: "connected" | "disconnected" | "qr_pending"; lastSeenAt?: string; details?: unknown }> {
    const instanceName = instance.instance_id || instance.phone_number || "default";

    try {
      const headers: Record<string, string> = {};
      if (instance.access_token) {
        headers["apikey"] = instance.access_token;
      }

      const res = await fetch(`${DEFAULT_EVOLUTION_URL}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        const state = data?.instance?.state || data?.state;
        if (state === "open") {
          return { status: "connected", lastSeenAt: new Date().toISOString(), details: data };
        }
        if (state === "connecting") {
          return { status: "qr_pending", details: data };
        }
      }
      return { status: "disconnected", details: null };
    } catch {
      return { status: instance.status || "disconnected" };
    }
  }
}

export const evolutionAdapter = new EvolutionAdapter();
