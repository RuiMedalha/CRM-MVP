import { create } from "zustand";

export interface ActivityItem {
  id: string;
  type: "lead" | "email" | "deal" | "proposal" | "contact";
  title: string;
  description?: string;
  icon?: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  color?: string;
}

interface ActivityFeedState {
  activities: ActivityItem[];
  addActivity: (activity: Omit<ActivityItem, "id" & "read">) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
}

export const useActivityFeedStore = create<ActivityFeedState>((set, get) => ({
  activities: [],

  addActivity: (activity) => {
    set((state) => ({
      activities: [
        {
          id: `${activity.type}-${Date.now()}-${Math.random()}`,
          read: false,
          ...activity,
        },
        ...state.activities,
      ].slice(0, 50), // Keep last 50 activities
    }));
  },

  markAsRead: (id) => {
    set((state) => ({
      activities: state.activities.map((a) => (a.id === id ? { ...a, read: true } : a)),
    }));
  },

  clearAll: () => {
    set({ activities: [] });
  },

  getUnreadCount: () => {
    return get().activities.filter((a) => !a.read).length;
  },
}));
