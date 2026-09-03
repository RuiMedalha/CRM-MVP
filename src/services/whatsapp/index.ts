import { evolutionAdapter, EvolutionAdapter } from "./evolution";
import { metaAdapter, MetaCloudAdapter } from "./meta";
import type {
  WhatsAppAdapter,
  WhatsAppProvider,
  WhatsAppInstance,
  SendMessagePayload,
  SendResult,
  QRCodeResult,
  NormalizedIncomingMessage,
  WebhookSubscriptionPayload,
} from "./types";

export * from "./types";
export { evolutionAdapter, EvolutionAdapter } from "./evolution";
export { metaAdapter, MetaCloudAdapter } from "./meta";

/**
 * Factory que retorna o Adapter correspondente ao provedor WhatsApp
 */
export function getAdapter(provider: WhatsAppProvider | string): WhatsAppAdapter {
  const norm = String(provider || "").toLowerCase().trim();
  if (norm === "meta" || norm === "meta_cloud" || norm === "waba") {
    return metaAdapter;
  }
  // Default to Evolution API
  return evolutionAdapter;
}

/**
 * Envia uma mensagem através da instância e seu respectivo adaptador
 */
export async function sendWhatsAppMessage(
  instance: WhatsAppInstance,
  payload: SendMessagePayload | string,
  toOverride?: string,
): Promise<SendResult> {
  const adapter = getAdapter(instance.provider);
  return adapter.sendMessage(instance, payload, toOverride);
}

/**
 * Obtém o QR Code ou status de emparelhamento da instância
 */
export async function getWhatsAppQRCode(instance: WhatsAppInstance): Promise<QRCodeResult> {
  const adapter = getAdapter(instance.provider);
  return adapter.getQRCode(instance);
}

/**
 * Subscreve / configura webhook para a instância
 */
export async function subscribeWhatsAppWebhook(
  instance: WhatsAppInstance,
  config: WebhookSubscriptionPayload,
): Promise<{ success: boolean; message?: string }> {
  const adapter = getAdapter(instance.provider);
  return adapter.subscribeWebhook(instance, config);
}

/**
 * Normaliza payloads de webhook recebidos (Evolution ou Meta) para o formato padrão do CRM
 */
export function normalizeIncomingWhatsAppPayload(
  payload: unknown,
  provider: WhatsAppProvider,
  instance?: WhatsAppInstance,
): NormalizedIncomingMessage[] {
  const adapter = getAdapter(provider);
  return adapter.normalizeIncoming(payload, instance);
}
