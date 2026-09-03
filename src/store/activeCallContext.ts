import { create } from "zustand";

export interface ActiveCallContext {
  phone: string;
  name: string;
  contactId?: string;
  startedAt: string;
  channel: string;
}

interface ActiveCallStore {
  context: ActiveCallContext | null;
  setContext: (ctx: ActiveCallContext) => void;
  clear: () => void;
}

export const useActiveCallStore = create<ActiveCallStore>((set) => ({
  context: null,
  setContext: (ctx) => set({ context: ctx }),
  clear: () => set({ context: null }),
}));
