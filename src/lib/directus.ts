import { directusRequest, DIRECTUS_URL } from "@/integrations/directus/client";

export { DIRECTUS_URL };

/**
 * Directus helper functions mimicking SDK signatures on top of directusRequest.
 */
export function getDirectusClient() {
  return {
    request: async <T>(reqOrPromise: (() => Promise<T>) | Promise<T>): Promise<T> => {
      if (typeof reqOrPromise === "function") {
        return (reqOrPromise as () => Promise<T>)();
      }
      return reqOrPromise;
    },
  };
}

export function readItems(collection: string, query?: { filter?: any; fields?: string[]; limit?: number; sort?: string[] }) {
  return async () => {
    const sp = new URLSearchParams();
    if (query?.limit !== undefined) sp.set("limit", String(query.limit));
    if (query?.fields) sp.set("fields", Array.isArray(query.fields) ? query.fields.join(",") : String(query.fields));
    if (query?.filter) sp.set("filter", JSON.stringify(query.filter));
    if (query?.sort) sp.set("sort", Array.isArray(query.sort) ? query.sort.join(",") : String(query.sort));
    const qs = sp.toString() ? `?${sp.toString()}` : "";
    const res = await directusRequest<{ data: any[] }>(`/items/${collection}${qs}`);
    return res?.data || [];
  };
}

export function createItem(collection: string, item: Record<string, any>) {
  return async () => {
    const res = await directusRequest<{ data: any }>(`/items/${collection}`, {
      method: "POST",
      body: JSON.stringify(item),
    });
    return res?.data;
  };
}

export function updateItem(collection: string, id: string | number, item: Record<string, any>) {
  return async () => {
    const res = await directusRequest<{ data: any }>(`/items/${collection}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(item),
    });
    return res?.data;
  };
}

export function deleteItem(collection: string, id: string | number) {
  return async () => {
    await directusRequest(`/items/${collection}/${id}`, {
      method: "DELETE",
    });
  };
}

