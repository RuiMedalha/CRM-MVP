import { create } from "zustand";
import { realtimeClient, type RealtimeMessagePayload } from "@/services/realtime/client";
import type { ActivityItem } from "@/store/activityFeedStore";

export interface RealtimeLeadItem {
  id: string | number;
  display_name?: string;
  contact_name?: string;
  contact_phone?: string;
  email?: string;
  source?: string;
  status: string;
  date_created?: string;
  isNew?: boolean;
  receivedAt: number;
}

export interface RealtimeDealUpdateItem {
  id: string | number;
  title?: string;
  stage_id?: string;
  status?: string;
  total_amount?: number;
  updated_at?: string;
  receivedAt: number;
}

interface CrossTabBusState {
  newLeads: RealtimeLeadItem[];
  updatedDeals: Record<string, RealtimeDealUpdateItem>;
  unreadMessages: number;
  activities: ActivityItem[];
  lastEvent: RealtimeMessagePayload | null;

  // Lead actions
  addNewLead: (lead: Partial<RealtimeLeadItem> & { id: string | number }) => void;
  markLeadSeen: (leadId: string | number) => void;
  clearNewLeads: () => void;
  getNewLeadsCount: () => number;

  // Deal actions
  recordDealUpdate: (deal: Partial<RealtimeDealUpdateItem> & { id: string | number }) => void;
  clearDealUpdates: () => void;

  // Message actions
  setUnreadMessages: (count: number | ((prev: number) => number)) => void;
  incrementUnreadMessages: (by?: number) => void;

  // Activity actions (compatible with activityFeedStore)
  addActivity: (activity: Omit<ActivityItem, "id" | "read">) => void;
  markActivityAsRead: (id: string) => void;
  clearAllActivities: () => void;
  getUnreadActivityCount: () => number;

  // Global broadcast
  emit: (collection: string, event: "create" | "update" | "delete" | "custom", data: any, meta?: Record<string, any>) => void;
}

export const useCrossTabBus = create<CrossTabBusState>((set, get) => ({
  newLeads: [],
  updatedDeals: {},
  unreadMessages: 0,
  activities: [],
  lastEvent: null,

  addNewLead: (lead) => {
    const item: RealtimeLeadItem = {
      id: lead.id,
      display_name: lead.display_name || lead.contact_name || lead.contact_phone || "Lead",
      contact_name: lead.contact_name,
      contact_phone: lead.contact_phone,
      email: lead.email,
      source: lead.source || "manual",
      status: lead.status || "incoming",
      date_created: lead.date_created || new Date().toISOString(),
      isNew: true,
      receivedAt: Date.now(),
    };

    set((state) => {
      // Dedup by lead ID
      const filtered = state.newLeads.filter((l) => String(l.id) !== String(lead.id));
      return {
        newLeads: [item, ...filtered].slice(0, 50),
      };
    });

    // Also add to activities
    get().addActivity({
      type: "lead",
      title: `Lead: ${item.display_name || item.contact_phone || "Novo"}`,
      description: item.contact_phone || item.email || `Origem: ${item.source}`,
      timestamp: new Date(),
      actionUrl: "/leads",
    });
  },

  markLeadSeen: (leadId) => {
    set((state) => ({
      newLeads: state.newLeads.map((l) =>
        String(l.id) === String(leadId) ? { ...l, isNew: false } : l
      ),
    }));
  },

  clearNewLeads: () => {
    set({ newLeads: [] });
  },

  getNewLeadsCount: () => {
    return get().newLeads.filter((l) => l.isNew).length;
  },

  recordDealUpdate: (deal) => {
    const idStr = String(deal.id);
    const item: RealtimeDealUpdateItem = {
      id: deal.id,
      title: deal.title,
      stage_id: deal.stage_id,
      status: deal.status,
      total_amount: deal.total_amount,
      updated_at: deal.updated_at || new Date().toISOString(),
      receivedAt: Date.now(),
    };

    set((state) => ({
      updatedDeals: {
        ...state.updatedDeals,
        [idStr]: item,
      },
    }));

    if (deal.status === "ganho") {
      get().addActivity({
        type: "deal",
        title: `🎉 Negócio Ganho: ${deal.title || "Negócio"}`,
        description: deal.total_amount ? `Valor: €${deal.total_amount}` : undefined,
        timestamp: new Date(),
        actionUrl: "/pipeline",
      });
    } else if (deal.stage_id || deal.status) {
      get().addActivity({
        type: "deal",
        title: `Negócio atualizado: ${deal.title || "Negócio"}`,
        description: `Estado: ${deal.status || deal.stage_id}`,
        timestamp: new Date(),
        actionUrl: "/pipeline",
      });
    }
  },

  clearDealUpdates: () => {
    set({ updatedDeals: {} });
  },

  setUnreadMessages: (count) => {
    set((state) => ({
      unreadMessages: typeof count === "function" ? count(state.unreadMessages) : count,
    }));
  },

  incrementUnreadMessages: (by = 1) => {
    set((state) => ({
      unreadMessages: Math.max(0, state.unreadMessages + by),
    }));
  },

  addActivity: (activity) => {
    const id = `${activity.type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newActivity: ActivityItem = {
      id,
      read: false,
      ...activity,
    };

    set((state) => ({
      activities: [newActivity, ...state.activities].slice(0, 50),
    }));
  },

  markActivityAsRead: (id) => {
    set((state) => ({
      activities: state.activities.map((a) => (a.id === id ? { ...a, read: true } : a)),
    }));
  },

  clearAllActivities: () => {
    set({ activities: [] });
  },

  getUnreadActivityCount: () => {
    return get().activities.filter((a) => !a.read).length;
  },

  emit: (collection, event, data, meta) => {
    realtimeClient.broadcast(collection, event, data, meta);
  },
}));

// Automatic subscription binding for incoming events to feed the store
if (typeof window !== "undefined") {
  realtimeClient.subscribe("*", (payload) => {
    const { collection, event, data } = payload;
    const store = useCrossTabBus.getState();

    // Store the last event
    useCrossTabBus.setState({ lastEvent: payload });

    const items = Array.isArray(data) ? data : data ? [data] : [];

    if (collection === "leads" && (event === "create" || event === "update")) {
      items.forEach((lead) => {
        if (lead && lead.id) {
          store.addNewLead(lead);
        }
      });
    } else if (collection === "deals" && (event === "create" || event === "update")) {
      items.forEach((deal) => {
        if (deal && deal.id) {
          store.recordDealUpdate(deal);
        }
      });
    } else if (collection === "messages" || collection === "whatsapp_messages") {
      if (event === "create") {
        store.incrementUnreadMessages(items.length || 1);
        items.forEach((msg) => {
          store.addActivity({
            type: "email",
            title: `Nova mensagem: ${msg.sender || msg.from || "Contacto"}`,
            description: msg.body || msg.text || "Nova mensagem recebida",
            timestamp: new Date(),
            actionUrl: "/comunicacoes",
          });
        });
      }
    } else if (collection === "activity") {
      items.forEach((act) => {
        if (act && act.title) {
          store.addActivity({
            type: act.type || "lead",
            title: act.title,
            description: act.description,
            timestamp: new Date(act.timestamp || Date.now()),
            actionUrl: act.action_url || act.actionUrl,
          });
        }
      });
    }
  });
}
