import { directusRequest } from "./client";
import {
  DIRECTUS_CONTACT_FIELD_MAP,
  DIRECTUS_CONTACTS_COLLECTION,
} from "./contacts";
import { getPhoneSearchVariations } from "@/services/contactIdentification";

/**
 * Procura um contacto Directus pelo telefone (phone / whatsapp_number / contact_phone / mobile_phone),
 * suportando todas as variações com/sem indicativo e espaços. Devolve o id Directus ou null.
 */
export async function findContactByPhone(phone: string): Promise<string | null> {
  const variations = getPhoneSearchVariations(phone);
  if (variations.length === 0) return null;

  const phoneKey = DIRECTUS_CONTACT_FIELD_MAP.phone || "phone";
  const waKey = DIRECTUS_CONTACT_FIELD_MAP.whatsapp_number || "whatsapp_number";
  const contactPhoneKey = DIRECTUS_CONTACT_FIELD_MAP.contact_phone || "contact_phone";
  const mobileKey = DIRECTUS_CONTACT_FIELD_MAP.mobile_phone || "mobile_phone";

  const fields = [phoneKey, waKey, contactPhoneKey, mobileKey];

  // 1. Fast match: _ends_with with the 9-digit tail
  const tail9 = phone.replace(/\D/g, "").slice(-9);
  if (tail9.length >= 6) {
    for (const field of fields) {
      try {
        const res = await directusRequest<{ data: Array<{ id?: unknown }> }>(
          `/items/${DIRECTUS_CONTACTS_COLLECTION}?filter[${field}][_ends_with]=${encodeURIComponent(tail9)}&limit=1&fields=id`
        );
        const id = res?.data?.[0]?.id;
        if (id != null) return String(id);
      } catch {
        // continue
      }
    }
  }

  // 2. Formatted variations match
  for (const variant of variations) {
    for (const field of fields) {
      try {
        const res = await directusRequest<{ data: Array<{ id?: unknown }> }>(
          `/items/${DIRECTUS_CONTACTS_COLLECTION}?filter[${field}][_icontains]=${encodeURIComponent(variant)}&limit=1&fields=id`
        );
        const id = res?.data?.[0]?.id;
        if (id != null) return String(id);
      } catch {
        // continue
      }
    }
  }

  return null;
}

