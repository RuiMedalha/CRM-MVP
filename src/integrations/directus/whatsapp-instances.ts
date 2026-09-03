import { directusRequest } from "./client";
import type { WhatsAppInstance, WhatsAppProvider, WhatsAppInstanceStatus } from "@/services/whatsapp/types";
import { getAdapter } from "@/services/whatsapp";

const LOCAL_STORAGE_KEY = "crm_whatsapp_instances_v1";

export const DEFAULT_WHATSAPP_INSTANCES: WhatsAppInstance[] = [
  {
    id: "inst-evo-918",
    tenant_id: null,
    provider: "evolution",
    phone_number: "+351918000000",
    display_name: "HotelEquip Principal (Evolution)",
    instance_id: "hotelequip-918",
    phone_number_id: null,
    access_token: null,
    business_account_id: null,
    webhook_url: "https://api.hotelequip.pt/webhook/evolution/hotelequip-918",
    status: "connected",
    last_seen_at: new Date().toISOString(),
    enabled: true,
    date_created: "2026-07-01T00:00:00.000Z",
    date_updated: new Date().toISOString(),
  },
  {
    id: "inst-evo-916",
    tenant_id: null,
    provider: "evolution",
    phone_number: "+351916542271",
    display_name: "HotelEquip Suporte (Evolution)",
    instance_id: "hotelequip-916",
    phone_number_id: null,
    access_token: null,
    business_account_id: null,
    webhook_url: "https://api.hotelequip.pt/webhook/evolution/hotelequip-916",
    status: "connected",
    last_seen_at: new Date().toISOString(),
    enabled: true,
    date_created: "2026-07-15T00:00:00.000Z",
    date_updated: new Date().toISOString(),
  },
  {
    id: "inst-meta-913",
    tenant_id: null,
    provider: "meta",
    phone_number: "+351913866565",
    display_name: "HotelEquip Comercial (Meta Cloud WABA)",
    instance_id: null,
    phone_number_id: "943101945557713",
    access_token: "EAABw...meta_token_secure",
    business_account_id: "109384920492819",
    webhook_url: "https://api.hotelequip.pt/webhook/meta/wa913",
    status: "connected",
    last_seen_at: new Date().toISOString(),
    enabled: true,
    date_created: "2026-08-01T00:00:00.000Z",
    date_updated: new Date().toISOString(),
  },
];

function getStoredLocalInstances(): WhatsAppInstance[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed to load local WhatsApp instances:", e);
  }
  setStoredLocalInstances(DEFAULT_WHATSAPP_INSTANCES);
  return DEFAULT_WHATSAPP_INSTANCES;
}

function setStoredLocalInstances(instances: WhatsAppInstance[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(instances));
  } catch (e) {
    console.warn("Failed to save local WhatsApp instances:", e);
  }
}

export async function fetchWhatsAppInstances(): Promise<WhatsAppInstance[]> {
  try {
    const res = await directusRequest<{ data: any[] }>("/items/whatsapp_instances?sort=-date_created");
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      const mapped: WhatsAppInstance[] = res.data.map((item) => ({
        id: String(item.id),
        tenant_id: item.tenant_id ? String(item.tenant_id) : null,
        provider: (item.provider as WhatsAppProvider) || "evolution",
        phone_number: item.phone_number || "",
        display_name: item.display_name || "Instância WhatsApp",
        instance_id: item.instance_id || null,
        phone_number_id: item.phone_number_id || null,
        access_token: item.access_token || null,
        business_account_id: item.business_account_id || null,
        webhook_url: item.webhook_url || null,
        status: (item.status as WhatsAppInstanceStatus) || "disconnected",
        last_seen_at: item.last_seen_at || null,
        enabled: item.enabled ?? true,
        date_created: item.date_created,
        date_updated: item.date_updated,
      }));
      setStoredLocalInstances(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn("Directus fetch /items/whatsapp_instances falhou, usando armazenamento local:", err);
  }
  return getStoredLocalInstances();
}

export async function getWhatsAppInstanceById(id: string): Promise<WhatsAppInstance | null> {
  const instances = await fetchWhatsAppInstances();
  return instances.find((i) => i.id === id) || null;
}

export async function createWhatsAppInstance(
  payload: Partial<WhatsAppInstance>,
): Promise<WhatsAppInstance> {
  const newId =
    payload.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);

  const now = new Date().toISOString();
  const provider = payload.provider || "evolution";
  const defaultWebhook =
    payload.webhook_url ||
    (provider === "meta"
      ? `https://api.hotelequip.pt/webhook/meta/${payload.phone_number_id || "waba"}`
      : `https://api.hotelequip.pt/webhook/evolution/${payload.instance_id || "instance"}`);

  const record: WhatsAppInstance = {
    id: newId,
    tenant_id: payload.tenant_id || null,
    provider,
    phone_number: payload.phone_number || "",
    display_name: payload.display_name || (provider === "meta" ? "Meta Cloud Oficial" : "Evolution API"),
    instance_id: payload.instance_id || null,
    phone_number_id: payload.phone_number_id || null,
    access_token: payload.access_token || null,
    business_account_id: payload.business_account_id || null,
    webhook_url: defaultWebhook,
    status: payload.status || (provider === "meta" ? "connected" : "qr_pending"),
    last_seen_at: now,
    enabled: payload.enabled ?? true,
    date_created: now,
    date_updated: now,
  };

  try {
    const res = await directusRequest<{ data: any }>("/items/whatsapp_instances", {
      method: "POST",
      body: JSON.stringify(record),
    });
    if (res?.data?.id) {
      record.id = String(res.data.id);
    }
  } catch (err) {
    console.warn("Directus create /items/whatsapp_instances falhou, persistindo localmente:", err);
  }

  const list = getStoredLocalInstances();
  list.unshift(record);
  setStoredLocalInstances(list);
  return record;
}

export async function updateWhatsAppInstance(
  id: string,
  payload: Partial<WhatsAppInstance>,
): Promise<WhatsAppInstance> {
  const list = getStoredLocalInstances();
  const idx = list.findIndex((i) => i.id === id);
  const now = new Date().toISOString();

  const updatedRecord: WhatsAppInstance = {
    ...(idx >= 0 ? list[idx] : ({ id } as WhatsAppInstance)),
    ...payload,
    id,
    date_updated: now,
  };

  try {
    await directusRequest(`/items/whatsapp_instances/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("Directus update /items/whatsapp_instances falhou, persistindo localmente:", err);
  }

  if (idx >= 0) {
    list[idx] = updatedRecord;
  } else {
    list.push(updatedRecord);
  }
  setStoredLocalInstances(list);
  return updatedRecord;
}

export async function deleteWhatsAppInstance(id: string): Promise<void> {
  try {
    await directusRequest(`/items/whatsapp_instances/${id}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("Directus delete /items/whatsapp_instances falhou, removendo localmente:", err);
  }

  const list = getStoredLocalInstances().filter((i) => i.id !== id);
  setStoredLocalInstances(list);
}

export async function testWhatsAppInstanceConnection(
  instance: WhatsAppInstance,
  targetPhone: string,
  customText?: string,
): Promise<{ success: boolean; message: string; whatsappId?: string }> {
  const adapter = getAdapter(instance.provider);
  const text = customText || `[CRM Teste de Conexão] Número ${instance.phone_number} (${instance.display_name}) operacional via ${instance.provider === "meta" ? "Meta Cloud API v18.0" : "Evolution API"}.`;

  const result = await adapter.sendMessage(instance, {
    to: targetPhone,
    body: text,
  });

  if (result.success) {
    // Atualiza o last_seen_at e status da instância
    await updateWhatsAppInstance(instance.id, {
      status: "connected",
      last_seen_at: new Date().toISOString(),
    }).catch(() => null);

    return {
      success: true,
      message: `Mensagem de teste enviada com sucesso! WAMID: ${result.whatsappId || "ok"}`,
      whatsappId: result.whatsappId,
    };
  }

  return {
    success: false,
    message: result.error || "Falha no envio da mensagem de teste",
  };
}
