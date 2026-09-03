/**
 * Audit Mutation — wrapper para dual-write no Activity Ledger.
 * Fire-and-forget: nunca bloqueia a mutação original.
 * Retry queue em IndexedDB: se a escrita falhar (rede/503),
 * persiste localmente e retenta a cada 30s.
 *
 * Uso nos hooks:
 *   import { auditMutation, startAuditRetryQueue } from "./audit";
 *   await auditMutation("leads", "create", null, result);
 */

import { DIRECTUS_URL, getDirectusAccessToken } from "./client";

const AUDIT_COLLECTION = "activity";

// === IndexedDB retry queue ===

const DB_NAME = "AuditRetryQueue";
const DB_VERSION = 1;
const STORE_NAME = "pending";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistToQueue(payload: Record<string, unknown>) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({ payload, createdAt: Date.now() });
    tx.commit();
  } catch (e) {
    console.warn("[audit-queue] falhou ao persistir", e);
  }
}

async function flushQueue() {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise<{ id: number; payload: Record<string, unknown> }[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const entry of all) {
      try {
        await writeToActivity(entry.payload);
        store.delete(entry.id);
      } catch {
        break; // keep remaining for next retry
      }
    }
    tx.commit();
  } catch {
    // nothing
  }
}

// === Core write ===

async function writeToActivity(payload: Record<string, unknown>): Promise<void> {
  const token = getDirectusAccessToken();
  if (!token) throw new Error("Sem sessão");

  const url = `${DIRECTUS_URL.replace(/\/+$/, "")}/items/${AUDIT_COLLECTION}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Activity write failed: ${res.status}`);
  }
}

// === Public API ===

export async function auditMutation(
  collection: string,
  action: "create" | "update" | "delete",
  before: unknown | null,
  after: unknown | null,
  extra?: { source?: string; user_id?: string; user_email?: string },
): Promise<void> {
  try {
    const itemId = (after as any)?.id ?? (before as any)?.id ?? null;
    const payload: Record<string, unknown> = {
      collection,
      item_id: itemId,
      action,
      user_id: extra?.user_id ?? null,
      user_email: extra?.user_email ?? null,
      server_timestamp: new Date().toISOString(),
      source: extra?.source ?? "ui",
      before_data: before != null ? JSON.parse(JSON.stringify(before)) : null,
      after_data: after != null ? JSON.parse(JSON.stringify(after)) : null,
    };

    await writeToActivity(payload);
  } catch (err) {
    console.warn("[audit-mutation] falhou, enfileirando", err);
    const itemId = (after as any)?.id ?? (before as any)?.id ?? null;
    await persistToQueue({
      collection,
      action,
      item_id: itemId,
      user_id: extra?.user_id ?? null,
      user_email: extra?.user_email ?? null,
      server_timestamp: new Date().toISOString(),
      source: extra?.source ?? "ui",
      before_data: before,
      after_data: after,
    });
  }
}

// Start periodic retry flush
let flushInterval: ReturnType<typeof setInterval> | null = null;
export function startAuditRetryQueue(intervalMs = 30000) {
  if (flushInterval) return;
  flushInterval = setInterval(() => {
    flushQueue().catch(() => {});
  }, intervalMs);
}

export function stopAuditRetryQueue() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

// Auto-start on import in browser
if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
  startAuditRetryQueue();
}
