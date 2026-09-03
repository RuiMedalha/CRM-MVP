import { create } from "zustand"
import type { TelecofCallEventRecord } from "@/types/telecof"

interface TelecofCallState {
  events: TelecofCallEventRecord[]
  selectedEventId?: string
  loading: boolean
  customerPanelFocusEventId?: string

  setEvents: (events: TelecofCallEventRecord[]) => void
  setLoading: (loading: boolean) => void
  mergeEvent: (event: TelecofCallEventRecord) => void
  removeEventFromQueue: (id: string) => void
  selectEvent: (id?: string) => void
  requestCustomerPanelFocus: (eventId: string) => void
  clearCustomerPanelFocus: () => void
}

export const useTelecofCallStore = create<TelecofCallState>((set) => ({
  events: [],
  selectedEventId: undefined,
  loading: false,
  customerPanelFocusEventId: undefined,

  setEvents: (events) => set({ events }),

  setLoading: (loading) => set({ loading }),

  mergeEvent: (event) =>
    set((state) => {
      const exists = state.events.some((e) => e.id === event.id)
      if (!exists) {
        return { events: [event, ...state.events] }
      }
      return {
        events: state.events.map((e) =>
          e.id === event.id ? { ...e, ...event } : e,
        ),
      }
    }),

  removeEventFromQueue: (id) =>
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
      selectedEventId:
        state.selectedEventId === id ? undefined : state.selectedEventId,
    })),

  selectEvent: (selectedEventId) => set({ selectedEventId }),

  requestCustomerPanelFocus: (customerPanelFocusEventId) =>
    set({ customerPanelFocusEventId }),

  clearCustomerPanelFocus: () =>
    set({ customerPanelFocusEventId: undefined }),
}))
