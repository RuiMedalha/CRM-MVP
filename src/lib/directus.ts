import { createDirectus, rest, staticToken, createItem, readItems, updateItem, deleteItem } from '@directus/sdk';
import { getDirectusTokenForRequest } from '@/integrations/directus/client';

export const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || 'https://api.hotelequip.pt';
export const DIRECTUS_TOKEN = import.meta.env.VITE_DIRECTUS_TOKEN || '';

/**
 * Directus SDK Client configured with REST and static token fallback.
 */
export const directus = createDirectus(DIRECTUS_URL)
  .with(staticToken(DIRECTUS_TOKEN))
  .with(rest());

/**
 * Helper to get a configured client with the latest session token if present.
 */
export function getDirectusClient() {
  const token = getDirectusTokenForRequest() || DIRECTUS_TOKEN;
  return createDirectus(DIRECTUS_URL)
    .with(staticToken(token))
    .with(rest());
}

export { createItem, readItems, updateItem, deleteItem };
