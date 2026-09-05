import { useState, useCallback } from 'react';
import { directusRequest } from '@/integrations/directus/client';

export interface MeilisearchSettings {
  meilisearch_host?: string;
  meilisearch_api_key?: string;
  meilisearch_index?: string;
}

export interface MeilisearchProduct {
  id: string;
  name: string;
  title?: string;
  sku: string;
  price: number;
  cost?: number;
  description?: string;
  short_description?: string;
  content?: string;
  category?: string;
  image_url?: string;
  featured_media_url?: string;
  media_url?: string;
  thumbnail?: string;
  link?: string;
  /** URL da ficha técnica/datasheet PDF (quando disponível no índice) */
  datasheet_url?: string;
  // Extra (depends on index schema) - helps resolve images
  images?: any;
  image?: any;
  featured_media?: any;
  featured_media_id?: any;
}

const MEILISEARCH_STORAGE_KEY = "hotelequip_meilisearch_settings";
const DEFAULT_HOST = "https://meilisearch.hotelequip.pt";
const DEFAULT_INDEX = "products_stage";

// Environment defaults — always prefer env vars over localStorage
const ENV_HOST = (import.meta.env.VITE_MEILISEARCH_URL || "").trim();
const ENV_KEY = (import.meta.env.VITE_MEILISEARCH_SEARCH_KEY || "").trim();
const ENV_INDEX = (import.meta.env.VITE_MEILISEARCH_INDEX || DEFAULT_INDEX).trim();

export function getMeilisearchSettings(): MeilisearchSettings {
  // Env vars take priority
  if (ENV_HOST) {
    return {
      meilisearch_host: ENV_HOST,
      meilisearch_api_key: ENV_KEY,
      meilisearch_index: ENV_INDEX,
    };
  }
  // Fallback to localStorage (Definições page)
  const stored = localStorage.getItem(MEILISEARCH_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        meilisearch_host: parsed.meilisearch_host || DEFAULT_HOST,
        meilisearch_api_key: parsed.meilisearch_api_key || "",
        meilisearch_index: parsed.meilisearch_index || DEFAULT_INDEX,
      };
    } catch {
      // ignore
    }
  }
  return {
    meilisearch_host: DEFAULT_HOST,
    meilisearch_api_key: "",
    meilisearch_index: DEFAULT_INDEX,
  };
}

export function saveMeilisearchSettings(settings: MeilisearchSettings) {
  localStorage.setItem(MEILISEARCH_STORAGE_KEY, JSON.stringify(settings));
}

export function useMeilisearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<MeilisearchProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string): Promise<MeilisearchProduct[]> => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return [];
    }

    const settings = getMeilisearchSettings();
    const host = (settings.meilisearch_host || DEFAULT_HOST).trim().replace(/\/+$/, "");

    setIsSearching(true);
    setError(null);

    // 1. Tentar Meilisearch primário
    try {
      const indexName = settings.meilisearch_index || DEFAULT_INDEX;
      const url = `${host}/indexes/${indexName}/search`;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (settings.meilisearch_api_key) {
        headers["Authorization"] = `Bearer ${settings.meilisearch_api_key}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          q,
          limit: 24,
          attributesToRetrieve: [
            "id",
            "name",
            "title",
            "sku",
            "price",
            "cost",
            "description",
            "short_description",
            "content",
            "category",
            "image_url",
            "featured_media_url",
            "media_url",
            "link",
            "images",
            "image",
            "featured_media",
            "featured_media_id",
            "thumbnail",
            "thumb",
            "imageId",
            "mediaId",
          ],
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const products: MeilisearchProduct[] = data.hits || [];
        if (products.length > 0) {
          setResults(products);
          return products;
        }
      }
    } catch (meiliErr) {
      console.warn("[Meilisearch] Primário falhou ou sem resposta, a tentar catálogo Directus:", meiliErr);
    }

    // 2. Fallback Directus (products / loja_produtos)
    try {
      const encoded = encodeURIComponent(q);
      const directusRes = await directusRequest<{ data: any[] }>(
        `/items/products?search=${encoded}&limit=20`
      ).catch(() => null);

      if (directusRes?.data && Array.isArray(directusRes.data) && directusRes.data.length > 0) {
        const mappedProducts: MeilisearchProduct[] = directusRes.data.map((item) => ({
          id: String(item.id),
          name: item.name || item.title || "Produto",
          title: item.title || item.name || "Produto",
          sku: item.sku || item.reference || String(item.id),
          price: Number(item.price || item.unit_price || 0),
          cost: Number(item.cost || item.cost_price || 0),
          description: item.description || item.short_description || "",
          category: item.category || item.family || "",
          image_url: item.image_url || item.thumbnail || (item.image ? `/assets/${item.image}` : undefined),
          link: item.link || item.url || undefined,
        }));
        setResults(mappedProducts);
        return mappedProducts;
      }
    } catch {
      // ignore
    }

    // Nenhum resultado encontrado
    setResults([]);
    return [];
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    search,
    results,
    isSearching,
    error,
    clearResults,
  };
}
