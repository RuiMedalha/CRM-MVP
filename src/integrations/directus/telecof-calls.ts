/**
 * Telecof Calls — camada de acesso ao Directus.
 * Collection: Historico_Chamadas (schema real)
 * Updated para suportar campos de audio + transcricao.
 */

import { directusRequest } from "./client";

export const HISTORICO_CHAMADAS_COLLECTION = "Historico_Chamadas";

export interface TelecofCallRow {
  id: string | number;
  contact_id?: any;
  phone?: string | null;
  duration?: number | null;
  direction?: "inbound" | "outbound" | string | null;
  start_time?: string | null;
  end_time?: string | null;
  agent_name?: string | null;
  summary?: string | null;
  ai_summary?: string | null;
  tags?: string[] | string | null;
  date_created?: string | null;
  // Novos campos Voice AI
  audio_url?: string | null;
  duration_seconds?: number | null;
  transcription_status?: "pending" | "processing" | "done" | "failed" | null;
}

export async function listTelecofCallsByContact(contactId: string | number): Promise<TelecofCallRow[]> {
  if (!contactId && contactId !== 0) return [];
  try {
    const res = await directusRequest<{ data: TelecofCallRow[] }>(
      `/items/${HISTORICO_CHAMADAS_COLLECTION}?filter[contact_id][_eq]=${encodeURIComponent(String(contactId))}&sort=-start_time&fields=*&limit=100`,
    );
    return res?.data ?? [];
  } catch {
    return [];
  }
}
