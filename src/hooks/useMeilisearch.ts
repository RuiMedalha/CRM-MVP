import { useState, useCallback } from 'react';

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

// Environment defaults — always prefer env vars over localStorage
const ENV_HOST = (import.meta.env.VITE_MEILISEARCH_URL || "").trim();
const ENV_KEY = (import.meta.env.VITE_MEILISEARCH_SEARCH_KEY || "").trim();
const ENV_INDEX = (import.meta.env.VITE_MEILISEARCH_INDEX || "products_stage").trim();

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
  return stored ? JSON.parse(stored) : { meilisearch_index: "products_stage" };
}

export function saveMeilisearchSettings(settings: MeilisearchSettings) {
  localStorage.setItem(MEILISEARCH_STORAGE_KEY, JSON.stringify(settings));
}

export function useMeilisearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<MeilisearchProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string): Promise<MeilisearchProduct[]> => {
    if (!query.trim()) {
      setResults([]);
      return [];
    }

    const settings = getMeilisearchSettings();
    const host = (settings.meilisearch_host || "").trim();

    if (!host) {
      setError("Meilisearch não configurado. Defina VITE_MEILISEARCH_URL ou configure nas Definições.");
      return [];
    }

    setIsSearching(true);
    setError(null);

    try {
      const indexName = settings.meilisearch_index || "products_stage";
      const url = `${host}/indexes/${indexName}/search`;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (settings.meilisearch_api_key) {
        headers["Authorization"] = `Bearer ${settings.meilisearch_api_key}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          q: query,
          limit: 20,
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

      if (!response.ok) {
        throw new Error(`Meilisearch error: ${response.status}`);
      }

      const data = await response.json();
      const products: MeilisearchProduct[] = data.hits || [];

      setResults(products);
      return products;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro na pesquisa";
      setError(errorMessage);
      console.error("Meilisearch search error:", err);
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
