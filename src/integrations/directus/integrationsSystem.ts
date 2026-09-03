import { directusRequest } from "@/integrations/directus/client";

/**
 * Sistema de Canais/Integrações — genérico, guiado por dados.
 * Cada canal (WhatsApp, email, redes sociais...) é uma LINHA nesta coleção,
 * não código escrito à mão. Adicionar um canal = criar uma linha, não fazer deploy.
 * credential_ref guarda só o NOME da credencial no n8n — nunca o segredo.
 */

export type IntegrationStatus = "connected" | "configurable" | "planned";
export type IntegrationCategory = "mensagens" | "redes_sociais" | "outros";

export interface IntegrationRow {
  id: number;
  key: string;
  label: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  icon: string | null;
  credential_ref: string | null;
  webhook_url: string | null;
  notes: string | null;
  health_note: string | null;
  sort: number;
  active: boolean;
}

const COLLECTION = "integrations";

export async function listIntegrations(): Promise<IntegrationRow[]> {
  try {
    const res = await directusRequest<{ data: IntegrationRow[] }>(
      `/items/${COLLECTION}?limit=-1&sort=sort&filter[active][_eq]=true`,
    );
    return res?.data ?? [];
  } catch {
    return [];
  }
}

export async function createIntegration(row: Omit<IntegrationRow, "id">): Promise<IntegrationRow> {
  const res = await directusRequest<{ data: IntegrationRow }>(`/items/${COLLECTION}`, {
    method: "POST",
    body: JSON.stringify(row),
  });
  return res.data;
}

export async function updateIntegration(id: number, patch: Partial<Omit<IntegrationRow, "id">>): Promise<void> {
  await directusRequest(`/items/${COLLECTION}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteIntegration(id: number): Promise<void> {
  await directusRequest(`/items/${COLLECTION}/${id}`, { method: "DELETE" });
}

export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Ligado",
  configurable: "Configurável",
  planned: "Planeado",
};

export const STATUS_TINT: Record<IntegrationStatus, string> = {
  connected: "bg-green-100 text-green-800",
  configurable: "bg-amber-100 text-amber-800",
  planned: "bg-muted text-muted-foreground",
};

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  mensagens: "Mensagens Directas",
  redes_sociais: "Redes Sociais",
  outros: "Outros",
};
