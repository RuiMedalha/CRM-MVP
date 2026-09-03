/**
 * Product Specifications — CRUD para a coleção product_specifications.
 *
 * Fase 2 do P3: formulário público de especificação ligado a quotation_items.
 *
 * READ público: usa publicFetch (sem auth).
 * WRITE: usa directusAdminFetch (admin token, server-side safe).
 */

import { DIRECTUS_ADMIN_TOKEN, directusAdminFetch } from "@/integrations/directus/client";

const DIRECTUS_URL = (import.meta.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt").replace(/\/$/, "");

export const PRODUCT_SPECIFICATIONS_COLLECTION = "product_specifications";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpecQuestion {
  question: string;
  type: "text" | "number" | "choice" | "photo";
  choices?: string[];
  /** Optional conditional free-text question shown when a given choice is selected. */
  followUpQuestion?: Record<string, string>;
}

export interface SpecAnswer {
  answer_text?: string;
  answer_number?: number;
  answer_choice?: string;
  follow_up_answer?: string;
  extra_photo_urls?: string[];
  meta_type?: "client_notes";
}

export interface ProductSpecification {
  id: number | string;
  quotation_item_id: number | string;
  questions: SpecQuestion[];
  answers: SpecAnswer[];
  photo_url?: string | null;
  status: "draft" | "ready" | "submitted" | "reviewed";
  date_created?: string;
  date_updated?: string;
}

// ─── Public fetch (no auth — relies on Directus Public role) ──────────────────

async function publicFetch<T>(path: string): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${DIRECTUS_URL}${normalizedPath}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Public fetch ${res.status}: ${text}`);
  }
  return await res.json();
}

// ─── READ (público) ───────────────────────────────────────────────────────────

/**
 * Get product specification by quotation_item_id (public — sem auth).
 * Returns null if not found.
 */
export async function getSpecificationByItemId(
  itemId: number | string
): Promise<ProductSpecification | null> {
  const res = await publicFetch<{ data: any[] }>(
    `/items/${PRODUCT_SPECIFICATIONS_COLLECTION}?filter[quotation_item_id][_eq]=${encodeURIComponent(String(itemId))}&fields=id,quotation_item_id,questions,answers,photo_url,status&limit=1`
  );
  return (res?.data?.[0] as ProductSpecification) || null;
}

/**
 * Get all product specifications for a set of quotation_item IDs (public — sem auth).
 */
export async function getSpecificationsByItemIds(
  itemIds: Array<number | string>
): Promise<ProductSpecification[]> {
  const ids = itemIds.map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) return [];
  // Only show specs that are ready/submitted/reviewed (not draft — those are still being reviewed by agent)
  const res = await publicFetch<{ data: any[] }>(
    `/items/${PRODUCT_SPECIFICATIONS_COLLECTION}?filter[quotation_item_id][_in]=${encodeURIComponent(ids.join(","))}&filter[status][_in]=ready,submitted,reviewed&fields=id,quotation_item_id,questions,answers,photo_url,status&limit=200`
  );
  return (res?.data || []) as ProductSpecification[];
}

// ─── WRITE (admin token) ──────────────────────────────────────────────────────

/**
 * Create product specification record (admin only).
 * Called when agent clicks "Gerar formulário".
 */
export async function createProductSpecification(
  quotationItemId: number | string,
  questions: SpecQuestion[]
): Promise<ProductSpecification> {
  const res = await directusAdminFetch<{ data: ProductSpecification }>(
    `/items/${PRODUCT_SPECIFICATIONS_COLLECTION}`,
    {
      method: "POST",
      body: JSON.stringify({
        quotation_item_id: quotationItemId,
        questions,
        answers: [],
        status: "draft",
      }),
    }
  );
  return res.data;
}

/**
 * Update questions/status after agent review.
 */
export async function approveProductSpecificationQuestions(
  specId: number | string,
  questions: SpecQuestion[]
): Promise<void> {
  await directusAdminFetch(
    `/items/${PRODUCT_SPECIFICATIONS_COLLECTION}/${encodeURIComponent(String(specId))}`,
    {
      method: "PATCH",
      body: JSON.stringify({ questions, status: "ready" }),
    }
  );
}

/**
 * Upload a public specification photo through Directus /files.
 * Do not set Content-Type manually — browser must set multipart boundary.
 */
export async function uploadSpecificationPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload Directus ${res.status}: ${text}`);
  }
  const data = await res.json();
  const fileId = data?.data?.id;
  if (!fileId) throw new Error("Upload Directus: sem fileId");
  return `${DIRECTUS_URL}/assets/${fileId}`;
}

/**
 * Submit client answers (admin token — public page validates token/item first).
 */
export async function submitSpecificationAnswers(
  specId: number | string,
  answers: SpecAnswer[],
  photoUrl?: string | null
): Promise<void> {
  await directusAdminFetch(
    `/items/${PRODUCT_SPECIFICATIONS_COLLECTION}/${encodeURIComponent(String(specId))}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        answers,
        ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
        status: "submitted",
      }),
    }
  );
}

/**
 * Mark specification as reviewed by agent.
 */
export async function markSpecificationReviewed(
  specId: number | string
): Promise<void> {
  await directusAdminFetch(
    `/items/${PRODUCT_SPECIFICATIONS_COLLECTION}/${encodeURIComponent(String(specId))}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "reviewed" }),
    }
  );
}
