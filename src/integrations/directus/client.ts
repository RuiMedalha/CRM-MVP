type DirectusErrorPayload =
  | {
      errors?: Array<{
        message?: string;
        extensions?: { code?: string };
      }>;
    }
  | { error?: string; message?: string };

type DirectusRefreshResponse = {
  data?: {
    access_token?: string;
    refresh_token?: string;
    expires?: number;
  };
};

const DEFAULT_DIRECTUS_URL = "http://localhost:8055";

function normalizeBaseUrl(url: string) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function inferDirectusUrlFromLocation(): string | null {
  try {
    const host = window.location?.hostname || "";
    if (!host) return null;
    // Local dev
    if (host === "localhost" || host === "127.0.0.1") return null;

    // Prefer "api." sibling when app runs on "crm."
    if (host.startsWith("crm.")) return `https://${host.replace(/^crm\./, "api.")}`;

    // Known prod domain fallback
    if (host.endsWith("hotelequip.pt")) return "https://api.hotelequip.pt";

    return null;
  } catch {
    return null;
  }
}

function getRuntimeDirectusUrl(): string {
  // Allow manual override for debugging
  try {
    const override = localStorage.getItem("directus_url_override") || "";
    if (override.trim()) return normalizeBaseUrl(override);
  } catch {
    // ignore
  }

  const env = (typeof import.meta !== "undefined" && import.meta.env) || (typeof process !== "undefined" ? process.env : {}) || {};
  const envUrl = normalizeBaseUrl(env.VITE_DIRECTUS_URL || "");
  const inferred = inferDirectusUrlFromLocation();

  // If env is missing OR points to localhost in production, prefer inferred URL.
  const envLooksLocal =
    !envUrl ||
    envUrl === "http://localhost:8055" ||
    envUrl === "http://127.0.0.1:8055" ||
    envUrl === "https://localhost:8055" ||
    envUrl === "https://127.0.0.1:8055";

  if (envLooksLocal && inferred) return inferred;
  return envUrl || DEFAULT_DIRECTUS_URL;
}

export const DIRECTUS_URL: string = getRuntimeDirectusUrl();

const safeEnv = (typeof import.meta !== "undefined" && import.meta.env) || (typeof process !== "undefined" ? process.env : {}) || {};
// Optional fallback token (service-token mode). Prefer user session token.
const DIRECTUS_FALLBACK_TOKEN: string = safeEnv.VITE_DIRECTUS_TOKEN || "";

/** Token admin directo para operações de comunicações (lido de VITE_DIRECTUS_ADMIN_TOKEN). */
export const DIRECTUS_ADMIN_TOKEN = ((safeEnv.VITE_DIRECTUS_ADMIN_TOKEN as string) || "").trim();

/** Helper para fetch directo com token admin (bypass session). */
export async function directusAdminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = DIRECTUS_URL.replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const url = `${base}${normalizedPath}`

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${DIRECTUS_ADMIN_TOKEN}`)
  if (init.method && init.method !== "GET") {
    headers.set("Content-Type", headers.get("Content-Type") || "application/json")
  }

  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Directus ${res.status} ${res.statusText}: ${text || url}`)
  }

  const ct = res.headers.get("content-type") ?? ""
  if (!ct.includes("application/json")) return undefined as T
  return (await res.json()) as T
}

const DIRECTUS_ACCESS_TOKEN_STORAGE_KEY = "directus_access_token";
const DIRECTUS_REFRESH_TOKEN_STORAGE_KEY = "directus_refresh_token";
const DIRECTUS_ACCESS_EXPIRES_AT_STORAGE_KEY = "directus_access_expires_at";

function toEpochMsFromExpires(expires: unknown): number | null {
  const n = Number(expires);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Directus costuma devolver "expires" como segundos até expirar.
  // Se vier em ms, será muito maior.
  const ms = n > 1e10 ? n : n * 1000;
  return Date.now() + ms;
}

export function getDirectusAccessToken(): string {
  try {
    const t = localStorage.getItem(DIRECTUS_ACCESS_TOKEN_STORAGE_KEY) || "";
    return t.trim();
  } catch {
    return "";
  }
}

export function setDirectusAccessToken(token: string) {
  try {
    localStorage.setItem(DIRECTUS_ACCESS_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export function setDirectusAccessExpiresAt(expires: unknown) {
  try {
    const epoch = toEpochMsFromExpires(expires);
    if (!epoch) return;
    localStorage.setItem(DIRECTUS_ACCESS_EXPIRES_AT_STORAGE_KEY, String(epoch));
  } catch {
    // ignore
  }
}

export function getDirectusAccessExpiresAt(): number | null {
  try {
    const raw = localStorage.getItem(DIRECTUS_ACCESS_EXPIRES_AT_STORAGE_KEY) || "";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function clearDirectusAccessToken() {
  try {
    localStorage.removeItem(DIRECTUS_ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getDirectusRefreshToken(): string {
  try {
    const t = localStorage.getItem(DIRECTUS_REFRESH_TOKEN_STORAGE_KEY) || "";
    return t.trim();
  } catch {
    return "";
  }
}

export function setDirectusRefreshToken(token: string) {
  try {
    localStorage.setItem(DIRECTUS_REFRESH_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export function clearDirectusRefreshToken() {
  try {
    localStorage.removeItem(DIRECTUS_REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function clearDirectusSession() {
  clearDirectusAccessToken();
  clearDirectusRefreshToken();
  try {
    localStorage.removeItem(DIRECTUS_ACCESS_EXPIRES_AT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getDirectusTokenForRequest(): string {
  return getDirectusAccessToken() || DIRECTUS_FALLBACK_TOKEN || "";
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export function directusApiUrl(path: string) {
  return joinUrl(DIRECTUS_URL, path);
}

// FIX: renovação de sessão partilhada entre pedidos em paralelo.
// Antes, cada chamada com 401 chamava /auth/refresh por si própria. Como o
// Directus invalida o refresh_token anterior a cada uso, quando várias
// chamadas (ex: abrir a Ficha 360, que dispara vários pedidos ao mesmo
// tempo) recebiam 401 em simultâneo, só a primeira renovação tinha sucesso —
// as restantes usavam um refresh_token já gasto e falhavam com 401 outra
// vez. Isto explicava "algumas coisas gravam, outras não" na mesma sessão.
// Com esta variável partilhada, só a PRIMEIRA chamada pede a renovação a
// sério; todas as outras que chegarem entretanto esperam pelo mesmo
// resultado, em vez de gastarem o bilhete de renovação umas das outras.
let sharedRefreshPromise: Promise<string | null> | null = null;

async function refreshDirectusSessionOnce(): Promise<string | null> {
  if (sharedRefreshPromise) return sharedRefreshPromise;

  sharedRefreshPromise = (async () => {
    const refresh_token = getDirectusRefreshToken();
    if (!refresh_token) return null;
    try {
      const res = await fetch(directusApiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token, mode: "json" }),
      });
      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
      if (!res.ok) return null;
      const data = body as DirectusRefreshResponse;
      const nextAccess = String(data?.data?.access_token || "").trim();
      const nextRefresh = String(data?.data?.refresh_token || "").trim();
      if (nextAccess) setDirectusAccessToken(nextAccess);
      if (nextRefresh) setDirectusRefreshToken(nextRefresh);
      if (data?.data?.expires !== undefined) setDirectusAccessExpiresAt(data.data.expires);
      return nextAccess || null;
    } finally {
      // Liberta a promise partilhada pouco depois, para uma futura expiração
      // real (não relacionada com esta rajada de pedidos) poder tentar de novo.
      setTimeout(() => { sharedRefreshPromise = null; }, 500);
    }
  })();

  return sharedRefreshPromise;
}

export async function directusRequest<T>(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth, ...rest } = init;

  const token = skipAuth ? "" : getDirectusTokenForRequest();
  if (!skipAuth && !token) throw new Error("Sem sessão. Faça login para continuar.");

  const doFetch = async (accessToken?: string) => {
    return await fetch(directusApiUrl(path), {
      ...rest,
      headers: (() => {
        const h = new Headers(rest.headers);
        h.set("Content-Type", h.get("Content-Type") || "application/json");
        if (!skipAuth) h.set("Authorization", `Bearer ${accessToken || token}`);
        return h;
      })(),
    });
  };

  // Usa a renovação partilhada em vez de uma tentativa própria por pedido.
  const tryRefresh = refreshDirectusSessionOnce;

  let res = await doFetch();

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    // Auto-refresh session once on 401 (prevents random logouts while working).
    if (!skipAuth && res.status === 401) {
      const nextAccess = await tryRefresh().catch(() => null);
      if (nextAccess) {
        res = await doFetch(nextAccess);
        const ct2 = res.headers.get("content-type") || "";
        const isJson2 = ct2.includes("application/json");
        const body2: unknown = isJson2 ? await res.json().catch(() => null) : await res.text().catch(() => null);
        if (res.ok) return body2 as T;
      }

      // Refresh failed -> clear stored tokens to avoid endless 401 loops.
      clearDirectusSession();
    }
    const payload = (body || {}) as DirectusErrorPayload;
    const message = (() => {
      if (typeof body === "string" && body.trim()) return body;
      const first = (payload as { errors?: Array<{ message?: string }> }).errors?.[0]?.message;
      if (first) return first;
      if ("message" in payload && typeof payload.message === "string") return payload.message;
      if ("error" in payload && typeof payload.error === "string") return payload.error;
      return `Directus request failed (${res.status})`;
    })();
    throw new Error(message);
  }

  return body as T;
}

