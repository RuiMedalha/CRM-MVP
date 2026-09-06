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
const DEFAULT_HOST = "https://search.palamenta.com.pt";
const DEFAULT_INDEX = "products_palamenta";

// Environment defaults — always prefer env vars over localStorage
const ENV_HOST = (import.meta.env.VITE_MEILISEARCH_URL || "").trim();
const ENV_KEY = (import.meta.env.VITE_MEILISEARCH_SEARCH_KEY || "").trim();
const ENV_INDEX = (import.meta.env.VITE_MEILISEARCH_INDEX || DEFAULT_INDEX).trim();

function sanitizeIndex(idx?: string): string {
  const clean = (idx || "").trim();
  if (!clean || clean === "products_stage") return DEFAULT_INDEX;
  return clean;
}

export function getMeilisearchSettings(): MeilisearchSettings {
  // Env vars take priority
  if (ENV_HOST) {
    return {
      meilisearch_host: ENV_HOST,
      meilisearch_api_key: ENV_KEY,
      meilisearch_index: sanitizeIndex(ENV_INDEX),
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
        meilisearch_index: sanitizeIndex(parsed.meilisearch_index),
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
  const normalized: MeilisearchSettings = {
    ...settings,
    meilisearch_index: sanitizeIndex(settings.meilisearch_index),
  };
  localStorage.setItem(MEILISEARCH_STORAGE_KEY, JSON.stringify(normalized));
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

    try {
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
            attributesToRetrieve: ["*"],
          }),
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const hits = data.hits || [];
          if (hits.length > 0) {
            const mapped: MeilisearchProduct[] = hits.map((h: any) => ({
              id: String(h.id),
              name: h.title || h.name || "Produto",
              title: h.title || h.name || "Produto",
              sku: h.sku || String(h.id),
              price: Number(h.price || h.sale_price || h.regular_price || 0),
              cost: Number(h.cost || 0),
              description: h.short_description || h.full_description || h.description || "",
              short_description: h.short_description || "",
              category: Array.isArray(h.categories) ? h.categories.join(", ") : (h.category || ""),
              image_url: h.thumbnail || h.featured_media_url || (Array.isArray(h.images) && h.images[0]) || h.image_url,
              thumbnail: h.thumbnail || h.image_url,
              link: h.url || h.link,
              datasheet_url: h.datasheet_url,
              brand: h.brand,
              model: h.model,
            }));
            setResults(mapped);
            return mapped;
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
    } finally {
      setIsSearching(false);
    }
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
