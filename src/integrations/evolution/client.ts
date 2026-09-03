import { DIRECTUS_URL as _DURL, DIRECTUS_ADMIN_TOKEN as _DTOKEN } from "@/integrations/directus/client"
import { directusRequest } from "@/integrations/directus/client"

const DEFAULT_INSTANCE =
  (import.meta.env.VITE_EVOLUTION_INSTANCE as string | undefined)?.trim() ||
  "hotelequip-918";

// ─── All Evolution calls go through /wa-proxy endpoint ───────────────────

// Enviar texto
export async function sendTextViaEvolution(
  number: string,
  text: string,
  instanceName: string = DEFAULT_INSTANCE,
): Promise<void> {
  const resp = await directusRequest<{ ok: boolean; status: number }>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({ provider: "evolution", action: "sendText", number, text, instance: instanceName }),
  });
  if (!(resp as any)?.ok) throw new Error(`Evolution sendText failed`);
}

// Enviar imagem ou vídeo (URL pública)
export async function sendImageViaEvolution(
  number: string,
  mediaUrl: string,
  caption?: string,
  isVideo = false,
  instanceName: string = DEFAULT_INSTANCE,
): Promise<void> {
  const resp = await directusRequest<{ ok: boolean }>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({
      provider: "evolution", action: "sendMedia", number, instance: instanceName,
      mediatype: isVideo ? "video" : "image",
      mimetype: isVideo ? "video/mp4" : "image/jpeg",
      media: mediaUrl, caption: caption ?? "",
    }),
  });
  if (!(resp as any)?.ok) throw new Error(`Evolution sendMedia failed`);
}

// Enviar áudio como mensagem de voz
export async function sendAudioViaEvolution(
  number: string,
  audioUrl: string,
  instanceName: string = DEFAULT_INSTANCE,
): Promise<void> {
  const resp = await directusRequest<{ ok: boolean }>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({ provider: "evolution", action: "sendAudio", number, audio: audioUrl, instance: instanceName }),
  });
  if (!(resp as any)?.ok) throw new Error(`Evolution sendAudio failed`);
}

// Enviar documento (PDF, Word, etc.) — DEVE ser base64 puro (sem "data:..." prefix)
export async function sendDocumentViaEvolution(
  number: string,
  fileBase64: string,
  mimetype: string,
  fileName: string,
  instanceName: string = DEFAULT_INSTANCE,
): Promise<void> {
  const resp = await directusRequest<{ ok: boolean }>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({
      provider: "evolution", action: "sendMedia", number, instance: instanceName,
      mediatype: "document", mimetype, media: fileBase64, fileName,
    }),
  });
  if (!(resp as any)?.ok) throw new Error(`Evolution sendDocument failed`);
}

// Upload de ficheiro: converte File → base64 puro
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remover o prefix "data:...;base64," — a Evolution API só aceita base64 puro
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload de ficheiro para o Directus e devolver URL pública
const DIRECTUS_URL = _DURL;
const DIRECTUS_TOKEN = _DTOKEN;

export async function uploadToDirectus(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  const resp = await fetch(`${DIRECTUS_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    body: formData,
  });
  if (!resp.ok) throw new Error(`Directus upload ${resp.status}`);
  const data = await resp.json();
  const fileId = data?.data?.id;
  if (!fileId) throw new Error("Directus upload: sem fileId");
  // URL pública (assets do Directus são públicos — token na URL causa "Encoding error" nalguns browsers)
  return `${DIRECTUS_URL}/assets/${fileId}`;
}

export interface EvolutionNumberCheck {
  ok: boolean
  exists: boolean
  jid: string | null
  profileName: string | null
}

// Verificar se um número existe no WhatsApp
export async function checkNumberViaEvolution(
  number: string,
  instanceName: string = DEFAULT_INSTANCE,
): Promise<EvolutionNumberCheck> {
  const resp = await directusRequest<EvolutionNumberCheck>("/wa-proxy", {
    method: "POST",
    body: JSON.stringify({ provider: "evolution", action: "checkNumber", number, instance: instanceName }),
  });
  return {
    ok: Boolean((resp as any)?.ok),
    exists: Boolean((resp as any)?.exists),
    jid: (resp as any)?.jid ?? null,
    profileName: (resp as any)?.profileName ?? null,
  };
}
