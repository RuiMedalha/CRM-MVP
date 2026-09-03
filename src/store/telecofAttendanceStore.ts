import { create } from "zustand"

export interface TelecofContactForm {
  customerName: string
  phone: string
  email?: string
  company?: string
  notes?: string
}

interface TelecofAttendanceState {
  forms: Record<string, TelecofContactForm>
  quickNotes: Record<string, string>
  initForm: (eventId: string, draft: TelecofContactForm) => void
  updateForm: (eventId: string, patch: Partial<TelecofContactForm>) => void
  getForm: (eventId: string) => TelecofContactForm | undefined
  setQuickNote: (eventId: string, text: string) => void
  getQuickNote: (eventId: string) => string
}

export const useTelecofAttendanceStore = create<TelecofAttendanceState>(
  (set, get) => ({
    forms: {},
    quickNotes: {},

    initForm: (eventId, draft) =>
      set((s) => ({ forms: { ...s.forms, [eventId]: draft } })),

    updateForm: (eventId, patch) =>
      set((s) => ({
        forms: {
          ...s.forms,
          [eventId]: { ...(s.forms[eventId] ?? patch), ...patch },
        },
      })),

    getForm: (eventId) => get().forms[eventId],

    setQuickNote: (eventId, text) =>
      set((s) => ({ quickNotes: { ...s.quickNotes, [eventId]: text } })),

    getQuickNote: (eventId) => get().quickNotes[eventId] ?? "",
  }),
)
