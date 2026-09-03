/**
 * Directus integration: saved_filters collection
 *
 * Colecção pessoal de filtros guardados por utilizador.
 * RBAC: user_created = $CURRENT_USER em read/update/delete.
 *
 * Schema creation (run once via admin):
 *   POST /collections { collection: "saved_filters", fields: [id(uuid), page(string), name(string), filters(json)] }
 *   + enable system fields: user_created, date_created
 *   + set role permissions with filter: { user_created: { _eq: "$CURRENT_USER" } }
 */
import { directusRequest } from "./client";
import { qs } from "./utils";

export interface SavedFilter {
  id: string;
  user_created: string;
  date_created: string;
  page: "contacts" | "pipeline";
  name: string;
  filters: Record<string, unknown>;
}

export type SavedFilterInsert = Pick<SavedFilter, "page" | "name" | "filters">;

const COLLECTION = "saved_filters";

export async function listSavedFilters(page: "contacts" | "pipeline"): Promise<SavedFilter[]> {
  try {
    const res = await directusRequest<{ data: SavedFilter[] }>(
      `/items/${COLLECTION}${qs({
        "filter[page][_eq]": page,
        sort: "-date_created",
        limit: 50,
        fields: "id,user_created,date_created,page,name,filters",
      })}`
    );
    return res.data || [];
  } catch {
    // Collection may not exist yet — degrade gracefully
    return [];
  }
}

export async function createSavedFilter(payload: SavedFilterInsert): Promise<SavedFilter> {
  const res = await directusRequest<{ data: SavedFilter }>(`/items/${COLLECTION}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteSavedFilter(id: string): Promise<void> {
  await directusRequest(`/items/${COLLECTION}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
