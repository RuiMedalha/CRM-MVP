import {
  isWhatsAppGroupConversation,
  resolveConversationWhatsAppInstance,
  type WhatsAppInstanceId,
} from "./whatsappConversation"

import type {
  CommunicationChannel,
  ConversationPriority,
  InboxStatusFilter,
} from "@/types/communication"
import type { Conversation } from "@/types/conversation"

/** @deprecated — usar user.id UUID do contexto de auth em vez de literal */
export const HUB_DEFAULT_AGENT = "Rui"

export interface InboxFilterState {
  statusFilter: InboxStatusFilter
  channelFilters: CommunicationChannel[]
  tagFilters: string[]
  agentFilter?: string
  priorityFilter?: ConversationPriority
  unreadOnly: boolean
  noContactOnly: boolean
  showArchive: boolean
  searchQuery: string
  /** Phase 2.F1: filtrar por instance_name (e.g. hotelequip-916 vs hotelequip-913) */
  instanceFilter?: string
}

export const DEFAULT_INBOX_FILTERS: InboxFilterState = {
  statusFilter: "all_open",
  channelFilters: [],
  tagFilters: [],
  unreadOnly: false,
  noContactOnly: false,
  showArchive: false,
  searchQuery: "",
}

export function isGroupConversation(conv: Conversation): boolean {
  return isWhatsAppGroupConversation(conv)
}

function isActiveInboxStatus(status: string): boolean {
  if (!status) return true
  const s = status.toLowerCase()
  if (s === "closed" || s === "resolved" || s === "archived" || s === "deleted" || s === "done") {
    return false
  }
  return true
}

function isNotDeleted(status: string): boolean {
  return status !== "deleted"
}

export interface InboxFilterPipelineStats {
  totalReceived: number
  afterExcludeGroups: number
  afterChannel: number
  afterStatus: number
  afterTags: number
  final: number
  activeFilters: Partial<InboxFilterState> & { groupsOnly?: boolean }
}

export function filterConversations(
  conversations: Conversation[],
  filters: InboxFilterState,
  options?: { groupsOnly?: boolean },
): Conversation[] {
  return filterConversationsWithStats(conversations, filters, options).list
}

export function filterConversationsWithStats(
  conversations: Conversation[],
  filters: InboxFilterState,
  options?: { groupsOnly?: boolean },
): { list: Conversation[]; stats: InboxFilterPipelineStats } {
  const stats: InboxFilterPipelineStats = {
    totalReceived: conversations.length,
    afterExcludeGroups: 0,
    afterChannel: 0,
    afterStatus: 0,
    afterTags: 0,
    final: 0,
    activeFilters: {
      statusFilter: filters.statusFilter,
      channelFilters: [...filters.channelFilters],
      tagFilters: [...filters.tagFilters],
      showArchive: filters.showArchive,
      unreadOnly: filters.unreadOnly,
      noContactOnly: filters.noContactOnly,
      agentFilter: filters.agentFilter,
      priorityFilter: filters.priorityFilter,
      searchQuery: filters.searchQuery,
      groupsOnly: options?.groupsOnly,
    },
  }

  let list = [...conversations]

  // Strictly exclude Telecof/phone call events from chat conversations
  list = list.filter((c) => {
    const ch = String(c.channel ?? "").toLowerCase()
    return ch !== "telecof" && ch !== "call" && ch !== "phone"
  })

  if (options?.groupsOnly) {
    list = list.filter(
      (c) => c.source?.includes("@g.us") || isGroupConversation(c),
    )
  } else {
    list = list.filter((c) => !isGroupConversation(c))
  }
  stats.afterExcludeGroups = list.length

  list = list.filter((c) => isNotDeleted(c.status))

  if (filters.showArchive) {
    // Arquivo: todas excepto deleted (já excluídas)
  } else if (options?.groupsOnly) {
    list = list.filter((c) => c.status !== "archived")
  } else {
    switch (filters.statusFilter) {
      case "all_open":
        list = list.filter((c) => isActiveInboxStatus(c.status))
        break
      case "ai_active":
        list = list.filter((c) => c.status === "ai_active")
        break
      case "human":
        list = list.filter(
          (c) =>
            (c.status === "open" || c.status === "human_active" || c.status === "active") &&
            c.mode === "human",
        )
        break
      case "closed":
        list = list.filter((c) => c.status === "closed" || c.status === "resolved" || c.status === "done")
        break
      case "mine":
        list = list.filter(
          (c) => {
            if (!isActiveInboxStatus(c.status)) return false
            const assigned = c.assignedTo?.toLowerCase() ?? ""
            // Compatível com UUID (novo) e nome literal (legacy)
            const me = (filters.agentFilter || HUB_DEFAULT_AGENT).toLowerCase()
            return assigned === me || assigned === HUB_DEFAULT_AGENT.toLowerCase()
          },
        )
        break
      case "unassigned":
        list = list.filter(
          (c) => isActiveInboxStatus(c.status) && !c.assignedTo?.trim(),
        )
        break
    }
  }
  stats.afterStatus = list.length

  if (filters.channelFilters.length > 0) {
    const channelSet = new Set(filters.channelFilters.map((c) => c.toLowerCase()))
    const hasAnyWa = filters.channelFilters.some((c) => c.startsWith("wa") || c === "waha")
    const instanceFilter = filters.instanceFilter?.trim().toLowerCase()

    let targetWaInstance: WhatsAppInstanceId | null = null
    if (instanceFilter) {
      if (instanceFilter.includes("918")) targetWaInstance = "918"
      else if (instanceFilter.includes("916") || instanceFilter === "waha") targetWaInstance = "916"
      else if (instanceFilter.includes("913") || instanceFilter === "waba") targetWaInstance = "913"
    }

    list = list.filter((c) => {
      if (options?.groupsOnly && c.source?.includes("@g.us")) return true
      const ch = String(c.channel ?? "").toLowerCase()
      const isWa = ch.startsWith("wa") || ch === "whatsapp" || ch === "whatsapp_meta" || ch === "waha"

      if (isWa) {
        if (!hasAnyWa && !channelSet.has(ch)) return false
        if (targetWaInstance) {
          const cInst = resolveConversationWhatsAppInstance(c)
          return cInst === targetWaInstance
        }
        return true
      }

      return channelSet.has(ch)
    })
  }
  stats.afterChannel = list.length

  if (filters.tagFilters.length > 0 && !options?.groupsOnly) {
    list = list.filter((c) => {
      const tags = c.tagIds ?? []
      return filters.tagFilters.some((t) => tags.includes(t))
    })
  }
  stats.afterTags = list.length

  if (filters.agentFilter?.trim() && !options?.groupsOnly) {
    const agent = filters.agentFilter.trim().toLowerCase()
    list = list.filter((c) => c.assignedTo?.toLowerCase() === agent)
  }

  if (filters.priorityFilter && !options?.groupsOnly) {
    list = list.filter(
      (c) => (c.priority ?? "normal") === filters.priorityFilter,
    )
  }

  if (filters.unreadOnly && !options?.groupsOnly) {
    list = list.filter((c) => c.unreadCount > 0)
  }

  if (filters.noContactOnly && !options?.groupsOnly) {
    list = list.filter((c) => !c.contactId?.trim())
  }

  const q = filters.searchQuery.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        (c.lastMessage?.toLowerCase().includes(q) ?? false),
    )
  }

  const sorted = list.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  stats.final = sorted.length

  return { list: sorted, stats }
}
