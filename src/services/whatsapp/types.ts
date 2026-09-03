export type WhatsAppProvider = "evolution" | "meta";

export type WhatsAppInstanceStatus = "connected" | "disconnected" | "qr_pending";

export type WhatsAppMessageDirection = "inbound" | "outbound";

export type WhatsAppMessageStatus = "sent" | "delivered" | "read" | "failed" | "pending";

export type WhatsAppMediaType =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "contacts"
  | "sticker"
  | "template"
  | "interactive"
  | "unknown";

export interface WhatsAppInstance {
  id: string;
  tenant_id: string | null;
  provider: WhatsAppProvider;
  phone_number: string;
  display_name: string;
  instance_id: string | null; // For Evolution API (e.g. "hotelequip-918", "evo-support")
  phone_number_id: string | null; // For Meta Cloud API (e.g. "943101945557713")
  access_token: string | null; // Encrypted / secure token
  business_account_id: string | null; // Meta WABA ID (e.g. "1039840294820")
  webhook_url: string | null;
  status: WhatsAppInstanceStatus;
  last_seen_at: string | null;
  enabled?: boolean;
  date_created?: string;
  date_updated?: string;
}

export interface WhatsAppMessage {
  id: string;
  instance_id: string;
  direction: WhatsAppMessageDirection;
  from_number: string;
  to_number: string;
  body: string;
  media_url?: string | null;
  media_type?: WhatsAppMediaType | null;
  whatsapp_id: string; // Unique WhatsApp message ID (WAMID or Evolution msg ID)
  lead_id?: string | number | null;
  conversation_id?: string | number | null;
  status: WhatsAppMessageStatus;
  timestamp: string;
  raw_payload?: Record<string, unknown> | null;
  date_created?: string;
}

export interface SendMessagePayload {
  to: string;
  body: string;
  mediaUrl?: string;
  mediaType?: WhatsAppMediaType | "image" | "audio" | "video" | "document";
  mimeType?: string;
  fileName?: string;
  caption?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Array<{
    type: string;
    parameters?: Array<{
      type: string;
      text?: string;
      image?: { link: string };
      document?: { link: string; filename?: string };
      video?: { link: string };
    }>;
  }>;
  quotedMessageId?: string;
}

export interface SendResult {
  success: boolean;
  whatsappId?: string;
  status: WhatsAppMessageStatus;
  error?: string;
  rawResponse?: unknown;
}

export interface QRCodeResult {
  status: WhatsAppInstanceStatus;
  qrCode?: string; // QR code text / string to render
  qrCodeBase64?: string; // Base64 data URL if provided by provider
  pairingCode?: string;
  message?: string;
  expiresInSeconds?: number;
}

export interface NormalizedIncomingMessage {
  whatsappId: string;
  instanceId?: string;
  provider: WhatsAppProvider;
  from: string;
  to?: string;
  body: string;
  direction: "inbound";
  mediaUrl?: string;
  mediaType?: WhatsAppMediaType;
  mimeType?: string;
  fileName?: string;
  timestamp: Date;
  senderName?: string;
  isGroup?: boolean;
  groupJid?: string;
  participant?: string;
  quotedMessageId?: string;
  rawPayload: Record<string, unknown>;
}

export interface WebhookSubscriptionPayload {
  webhookUrl: string;
  events?: string[];
  secret?: string;
  verifyToken?: string;
}

export interface WhatsAppAdapter {
  provider: WhatsAppProvider;
  sendMessage(instance: WhatsAppInstance, payload: SendMessagePayload | string, to?: string): Promise<SendResult>;
  getQRCode(instance: WhatsAppInstance): Promise<QRCodeResult>;
  subscribeWebhook(instance: WhatsAppInstance, config: WebhookSubscriptionPayload): Promise<{ success: boolean; message?: string }>;
  normalizeIncoming(payload: unknown, instance?: WhatsAppInstance): NormalizedIncomingMessage[];
  checkStatus?(instance: WhatsAppInstance): Promise<{ status: WhatsAppInstanceStatus; lastSeenAt?: string; details?: unknown }>;
  validateCredentials?(instance: Partial<WhatsAppInstance>): Promise<{ valid: boolean; error?: string; details?: unknown }>;
}
