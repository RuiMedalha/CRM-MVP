export const CHATWOOT_URL =
  (import.meta.env.VITE_CHATWOOT_URL as string)?.trim() ?? "";
export const CHATWOOT_TOKEN =
  (import.meta.env.VITE_CHATWOOT_TOKEN as string)?.trim() ?? "";
export const CHATWOOT_ACCOUNT_ID =
  (import.meta.env.VITE_CHATWOOT_ACCOUNT_ID as string)?.trim() ?? "1";

export const isChatwootConfigured = Boolean(CHATWOOT_URL && CHATWOOT_TOKEN);

/** Base do fetch: proxy Vite em dev (evita CORS); URL directo em produção. */
const CHATWOOT_BASE = import.meta.env.DEV ? "/chatwoot-api" : CHATWOOT_URL || "";

export async function chatwootRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  if (!isChatwootConfigured) throw new Error("Chatwoot não configurado");
  const res = await fetch(`${CHATWOOT_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      api_access_token: CHATWOOT_TOKEN,
      ...options?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Chatwoot ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}
