import { DIRECTUS_URL, getDirectusTokenForRequest } from "@/integrations/directus/client";

export type RealtimeEventType = "create" | "update" | "delete" | "init" | "custom" | "*";

export interface RealtimeMessagePayload<T = any> {
  type?: string;
  collection: string;
  event: RealtimeEventType;
  data: T;
  meta?: {
    userId?: string;
    userName?: string;
    sourceTabId?: string;
    timestamp: number;
    [key: string]: any;
  };
}

export type RealtimeCallback<T = any> = (payload: RealtimeMessagePayload<T>) => void;

// Generate a random tab ID for deduplication of broadcast events
const TAB_ID = typeof crypto !== "undefined" && crypto.randomUUID
  ? crypto.randomUUID()
  : `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

const DEFAULT_COLLECTIONS = [
  "activity",
  "contacts",
  "deals",
  "leads",
  "whatsapp_messages",
  "messages",
  "quotations",
  "follow_ups",
  "email_threads",
  "communication_events",
  "interactions",
];

function wsUrlFromDirectus(): string {
  if (DIRECTUS_URL) {
    try {
      const u = new URL(DIRECTUS_URL);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      u.pathname = u.pathname.replace(/\/+$/, "") + "/websocket";
      return u.toString();
    } catch {
      // ignore
    }
  }
  return "wss://api.hotelequip.pt/websocket";
}

class DirectusRealtimeClient {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private isStopped = false;
  private retries = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<string, Set<RealtimeCallback>>();
  private wildcardListeners = new Set<RealtimeCallback>();
  private activeSubscriptions = new Set<string>();
  private broadcastChannel: BroadcastChannel | null = null;
  private isConnected = false;

  constructor() {
    this.setupBroadcastChannel();
    this.setupVisibilityListener();
    // Auto-subscribe to standard CRM collections
    DEFAULT_COLLECTIONS.forEach((c) => this.activeSubscriptions.add(c));
    this.connect();
  }

  private setupBroadcastChannel() {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel("crm_crosstab_realtime_bus");
        this.broadcastChannel.onmessage = (event) => {
          const payload = event.data as RealtimeMessagePayload;
          if (!payload || typeof payload !== "object") return;
          // Ignore events originating from this exact same tab
          if (payload.meta?.sourceTabId === TAB_ID) return;
          this.dispatchLocal(payload);
        };
      } catch (err) {
        console.warn("[RealtimeClient] BroadcastChannel initialization failed:", err);
      }
    } else if (typeof window !== "undefined") {
      // Fallback for storage events
      window.addEventListener("storage", (event) => {
        if (event.key === "crm_crosstab_realtime_event" && event.newValue) {
          try {
            const payload = JSON.parse(event.newValue) as RealtimeMessagePayload;
            if (payload.meta?.sourceTabId === TAB_ID) return;
            this.dispatchLocal(payload);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  private setupVisibilityListener() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          if (!this.isConnected && !this.isConnecting && !this.isStopped) {
            this.connect();
          }
        }
      });
    }
  }

  public getTabId(): string {
    return TAB_ID;
  }

  public isSocketOpen(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect() {
    if (this.isStopped || this.isConnecting) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(this.retries, 5)));
    this.retries++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public connect() {
    if (this.isStopped) return;
    if (typeof WebSocket === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    const url = wsUrlFromDirectus();

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.warn("[RealtimeClient] WebSocket connection failed:", err);
      this.isConnecting = false;
      this.isConnected = false;
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.isConnecting = false;
      const token = getDirectusTokenForRequest();
      if (token) {
        this.ws?.send(JSON.stringify({ type: "auth", access_token: token }));
      } else {
        // Directus also supports public subscriptions
        this.onAuthenticated();
      }
    };

    this.ws.onmessage = (event) => {
      this.handleSocketMessage(event.data);
    };

    this.ws.onerror = (err) => {
      console.warn("[RealtimeClient] WebSocket error:", err);
      try {
        this.ws?.close();
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      this.isConnecting = false;
      this.isConnected = false;
      this.ws = null;
      this.scheduleReconnect();
    };
  }

  private onAuthenticated() {
    this.isConnected = true;
    this.retries = 0;
    // Resubscribe to all active collections
    for (const collection of this.activeSubscriptions) {
      this.sendSubscription(collection);
    }
  }

  private sendSubscription(collection: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: "subscribe",
            collection,
            query: { fields: ["*"] },
            uid: `sub_${collection}`,
          })
        );
      } catch (err) {
        console.warn(`[RealtimeClient] Failed to subscribe to ${collection}:`, err);
      }
    }
  }

  private handleSocketMessage(raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "auth") {
      if (msg.status === "ok") {
        this.onAuthenticated();
      } else if (msg.status === "error") {
        // Token might have expired, close socket so reconnect will pick up refreshed token
        try {
          this.ws?.close();
        } catch {
          // ignore
        }
      }
      return;
    }

    if (msg.type === "ping") {
      try {
        this.ws?.send(JSON.stringify({ type: "pong" }));
      } catch {
        // ignore
      }
      return;
    }

    if (msg.type === "subscription") {
      const collection = msg.collection || (msg.uid ? msg.uid.replace(/^sub_/, "") : "unknown");
      const eventType = (msg.event as RealtimeEventType) || "update";
      const data = msg.data;

      const payload: RealtimeMessagePayload = {
        type: "realtime_event",
        collection,
        event: eventType,
        data,
        meta: {
          sourceTabId: "server_ws",
          timestamp: Date.now(),
        },
      };

      // Dispatch locally & broadcast to other tabs
      this.dispatchLocal(payload);
      this.broadcastToOtherTabs(payload);
    }
  }

  private dispatchLocal(payload: RealtimeMessagePayload) {
    // Notify collection-specific listeners
    const specific = this.listeners.get(payload.collection);
    if (specific) {
      specific.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`[RealtimeClient] Error in callback for ${payload.collection}:`, e);
        }
      });
    }

    // Notify wildcard listeners
    this.wildcardListeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error("[RealtimeClient] Error in wildcard callback:", e);
      }
    });
  }

  private broadcastToOtherTabs(payload: RealtimeMessagePayload) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch {
        // ignore
      }
    } else if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("crm_crosstab_realtime_event", JSON.stringify(payload));
      } catch {
        // ignore
      }
    }
  }

  /**
   * Broadcast an event immediately to all local listeners AND other browser tabs.
   * Useful when an action (e.g. Lead Created or Deal Moved) happens in this tab,
   * guaranteeing instantaneous (<5ms) cross-tab synchronization before or alongside WebSocket roundtrips.
   */
  public broadcast<T = any>(
    collection: string,
    event: RealtimeEventType,
    data: T,
    meta?: Record<string, any>
  ) {
    const payload: RealtimeMessagePayload<T> = {
      type: "realtime_event",
      collection,
      event,
      data,
      meta: {
        sourceTabId: TAB_ID,
        timestamp: Date.now(),
        ...meta,
      },
    };

    // Dispatch in this tab
    this.dispatchLocal(payload);

    // Broadcast to other tabs
    this.broadcastToOtherTabs(payload);
  }

  /**
   * Subscribe to real-time events for a specific collection or wildcard "*".
   * Returns an unsubscribe function.
   */
  public subscribe<T = any>(
    collection: string,
    callback: RealtimeCallback<T>
  ): () => void {
    if (collection === "*") {
      this.wildcardListeners.add(callback as RealtimeCallback);
      return () => {
        this.wildcardListeners.delete(callback as RealtimeCallback);
      };
    }

    if (!this.listeners.has(collection)) {
      this.listeners.set(collection, new Set());
    }
    const set = this.listeners.get(collection)!;
    set.add(callback as RealtimeCallback);

    if (!this.activeSubscriptions.has(collection)) {
      this.activeSubscriptions.add(collection);
      this.sendSubscription(collection);
    }

    return () => {
      set.delete(callback as RealtimeCallback);
      if (set.size === 0) {
        this.listeners.delete(collection);
      }
    };
  }

  public destroy() {
    this.isStopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      this.broadcastChannel?.close();
      this.ws?.close();
    } catch {
      // ignore
    }
    this.listeners.clear();
    this.wildcardListeners.clear();
    this.ws = null;
  }
}

// Export singleton instance
export const realtimeClient = new DirectusRealtimeClient();
