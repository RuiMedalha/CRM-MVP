import { create } from "zustand"

import {
  DEFAULT_INBOX_FILTERS,
  type InboxFilterState,
} from "@/lib/inboxFilters"

import type {
  CommunicationChannel,
  ConversationPriority,
  InboxStatusFilter,
  TelecofQueueFilter,
} from "@/types/communication"

export type InboxViewMode = "conversations" | "telecof_calls"

export type InboxListTab = "inbox" | "groups"

interface InboxFilterStore extends InboxFilterState {
  inboxViewMode: InboxViewMode
  telecofQueueFilter: TelecofQueueFilter
  activeTab: InboxListTab

  setInboxViewMode: (mode: InboxViewMode) => void
  setActiveTab: (tab: InboxListTab) => void
  setTelecofQueueFilter: (filter: TelecofQueueFilter) => void
  setStatusFilter: (filter: InboxStatusFilter) => void
  toggleChannelFilter: (channel: CommunicationChannel) => void
  toggleTagFilter: (tagId: string) => void
  setAgentFilter: (agent?: string) => void
  setPriorityFilter: (priority?: ConversationPriority) => void
  setUnreadOnly: (value: boolean) => void
  setNoContactOnly: (value: boolean) => void
  setShowArchive: (value: boolean) => void
  setSearchQuery: (query: string) => void
  setMessageChannelScope: (channel: CommunicationChannel, instanceFilter?: string) => void
  setMessageTagScope: (tagId: string) => void
  setInstanceFilter: (instance?: string) => void
  clearMessageScope: () => void
  resetFilters: () => void
}

export const useInboxFilterStore = create<InboxFilterStore>((set) => ({
  ...DEFAULT_INBOX_FILTERS,
  inboxViewMode: "conversations",
  telecofQueueFilter: "open",
  activeTab: "inbox",

  setInboxViewMode: (inboxViewMode) => set({ inboxViewMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setTelecofQueueFilter: (telecofQueueFilter) => set({ telecofQueueFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),

  toggleChannelFilter: (channel) =>
    set((state) => {
      const exists = state.channelFilters.includes(channel)
      return {
        channelFilters: exists
          ? state.channelFilters.filter((c) => c !== channel)
          : [...state.channelFilters, channel],
      }
    }),

  toggleTagFilter: (tagId) =>
    set((state) => {
      const exists = state.tagFilters.includes(tagId)
      return {
        tagFilters: exists
          ? state.tagFilters.filter((t) => t !== tagId)
          : [...state.tagFilters, tagId],
      }
    }),

  setAgentFilter: (agentFilter) => set({ agentFilter }),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setUnreadOnly: (unreadOnly) => set({ unreadOnly }),
  setNoContactOnly: (noContactOnly) => set({ noContactOnly }),
  setShowArchive: (showArchive) => set({ showArchive }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setInstanceFilter: (instanceFilter) => set({ instanceFilter }),

  setMessageChannelScope: (channel, instanceFilter) =>
    set({
      channelFilters: [channel],
      tagFilters: [],
      activeTab: "inbox",
      showArchive: false,
      unreadOnly: false,
      noContactOnly: false,
      statusFilter: "all_open",
      instanceFilter,
    }),

  setMessageTagScope: (tagId) =>
    set({
      channelFilters: [],
      tagFilters: [tagId],
      activeTab: "inbox",
      showArchive: false,
      unreadOnly: false,
      noContactOnly: false,
    }),

  clearMessageScope: () =>
    set({
      channelFilters: [],
      tagFilters: [],
      activeTab: "inbox",
      showArchive: false,
      unreadOnly: false,
      noContactOnly: false,
      statusFilter: "all_open",
    }),

  resetFilters: () =>
    set({
      ...DEFAULT_INBOX_FILTERS,
      inboxViewMode: "conversations",
      telecofQueueFilter: "open",
    }),
}))
