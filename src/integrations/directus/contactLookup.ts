import { directusRequest, DIRECTUS_ADMIN_TOKEN } from "./client";
import {
  DIRECTUS_CONTACT_FIELD_MAP,
  DIRECTUS_CONTACTS_COLLECTION,
} from "./contacts";

/** Últimos 9 dígitos (número nacional PT), sem indicativo/espaços/símbolos. */
function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/\D/g, "").slice(-9);
}

interface DirectusIdResponse {
  data?: Array<{ id?: unknown }>;
}

/**
 * Procura um contacto Directus pelo telefone (phone / whatsapp_number / contact_phone),
 * por sufixo dos últimos 9 dígitos. Devolve o id Directus ou null. Nunca rebenta.
 */
export async function findContactByPhone(phone: string): Promise<string | null> {
  const normalized = normalizePhone(phone);
  if (normalized.length < 6) return null;

  const phoneKey = DIRECTUS_CONTACT_FIELD_MAP.phone || "phone";
  const waKey = DIRECTUS_CONTACT_FIELD_MAP.whatsapp_number || "whatsapp_number";
  const contactPhoneKey = DIRECTUS_CONTACT_FIELD_MAP.contact_phone || "contact_phone";

  // Directus v11 requer o filtro _or como JSON, não como URLSearchParams aninhados.
  const filter = JSON.stringify({
    _or: [
      { [phoneKey]: { _ends_with: normalized } },
      { [waKey]: { _ends_with: normalized } },
      { [contactPhoneKey]: { _ends_with: normalized } },
    ],
  });

  const params = new URLSearchParams({
    filter,
    limit: "1",
    fields: "id",
  });

  try {
    const res = await fetch(
      `https://api.hotelequip.pt/items/${DIRECTUS_CONTACTS_COLLECTION}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}` } },
    );
    const json = await res.json() as DirectusIdResponse;
    const id = json?.data?.[0]?.id;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}
