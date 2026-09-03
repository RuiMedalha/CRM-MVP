import { create } from "zustand"
import type { NotificationToastItem } from "@/types/operationalEvent"

export interface CommunicationBadgeCounts {
  newCount: number
  unhandledCount: number
  unreadCount: number
}

interface NotificationState {
  badgeCounts: CommunicationBadgeCounts
  activeToasts: NotificationToastItem[]
  notificationsEnabled: boolean
  browserPermissionRequested: boolean

  setBadgeCounts: (counts: CommunicationBadgeCounts) => void
  setNotificationsEnabled: (enabled: boolean) => void
  setBrowserPermissionRequested: (value: boolean) => void
  pushToast: (toast: NotificationToastItem) => void
  dismissToast: (key: string) => void
  clearToasts: () => void
}

const TOAST_AUTO_DISMISS_MS = 2500
const MAX_ACTIVE_TOASTS = 3

export const useNotificationStore = create<NotificationState>((set, get) => ({
  badgeCounts: { newCount: 0, unhandledCount: 0, unreadCount: 0 },
  activeToasts: [],
  notificationsEnabled: true,
  browserPermissionRequested: false,

  setBadgeCounts: (badgeCounts) => set({ badgeCounts }),
  setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
  setBrowserPermissionRequested: (browserPermissionRequested) =>
    set({ browserPermissionRequested }),

  pushToast: (toast) => {
    set((state) => {
      if (state.activeToasts.some((t) => t.key === toast.key)) return state
      const next = [...state.activeToasts, toast]
      return { activeToasts: next.slice(-MAX_ACTIVE_TOASTS) }
    })
    window.setTimeout(() => {
      get().dismissToast(toast.key)
    }, TOAST_AUTO_DISMISS_MS)
  },

  dismissToast: (key) =>
    set((state) => ({
      activeToasts: state.activeToasts.filter((t) => t.key !== key),
    })),

  clearToasts: () => set({ activeToasts: [] }),
}))
