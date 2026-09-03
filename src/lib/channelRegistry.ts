import {
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  Send,
  Sparkles,
  Inbox,
  UserPen,
  type LucideIcon,
} from "lucide-react"

import type {
  ChannelSettings,
  CommunicationChannel,
  CommunicationProvider,
} from "@/types/communication"

const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "message-circle": MessageCircle,
  "phone-call": PhoneCall,
  facebook: MessageCircle,
  instagram: MessageCircle,
  send: Send,
  inbox: Inbox,
  "message-square": MessageSquare,
  mail: Mail,
  phone: Phone,
  "user-pen": UserPen,
}

export interface ChannelVisual {
  key: CommunicationChannel | string
  label: string
  color: string
  badgeClass: string
  Icon: LucideIcon
  provider: CommunicationProvider
  enabled: boolean
  inboxVisible: boolean
  priority: number
  notify: boolean
}

const DEFAULT_CHANNEL_SETTINGS: ChannelSettings[] = [
  {
    id: "whatsapp_916",
    key: "whatsapp_916",
    name: "WA · 916",
    provider: "whatsapp_meta",
    enabled: true,
    color: "#128C7E",
    icon: "message-circle",
    badgeLabel: "916",
    priority: 1,
    notify: true,
    inboxVisible: true,
    sortOrder: 1,
    autoTags: [],
  },
  {
    id: "whatsapp_913",
    key: "whatsapp_913",
    name: "WA · 913",
    provider: "whatsapp_meta",
    enabled: true,
    color: "#128C7E",
    icon: "message-circle",
    badgeLabel: "913",
    priority: 2,
    notify: true,
    inboxVisible: true,
    sortOrder: 2,
    autoTags: [],
  },
  {
    id: "whatsapp_918",
    key: "whatsapp_918",
    name: "WA · 918",
    provider: "whatsapp_evolution",
    enabled: true,
    color: "#128C7E",
    icon: "message-circle",
    badgeLabel: "918",
    priority: 2,
    notify: true,
    inboxVisible: true,
    sortOrder: 3,
    autoTags: [],
  },
  {
    id: "telecof",
    key: "telecof",
    name: "Telecof",
    provider: "telecof",
    enabled: true,
    color: "#7c3aed",
    icon: "phone-call",
    priority: 2,
    notify: true,
    inboxVisible: true,
    sortOrder: 2,
    autoTags: [],
  },
  {
    id: "askme",
    key: "askme",
    name: "AskMe",
    provider: "ask_me",
    enabled: true,
    color: "#0ea5e9",
    icon: "sparkles",
    priority: 3,
    notify: true,
    inboxVisible: true,
    sortOrder: 3,
    autoTags: [],
  },
  {
    id: "email",
    key: "email",
    name: "Email",
    provider: "email_smtp",
    enabled: true,
    color: "#6b7280",
    icon: "mail",
    priority: 10,
    notify: false,
    inboxVisible: true,
    sortOrder: 10,
    autoTags: [],
  },
]

function defaultVisual(channel: string): ChannelVisual {
  return {
    key: channel,
    label: channel || "Canal",
    color: "#64748b",
    badgeClass: "bg-muted text-muted-foreground ring-border",
    Icon: MessageCircle,
    provider: "manual",
    enabled: true,
    inboxVisible: true,
    priority: 999,
    notify: true,
  }
}

function settingsToVisual(s: ChannelSettings): ChannelVisual {
  const Icon = ICON_MAP[s.icon] ?? MessageCircle
  return {
    key: s.key,
    label: s.name,
    color: s.color,
    badgeClass: "ring-1 ring-inset",
    Icon,
    provider: s.provider,
    enabled: s.enabled,
    inboxVisible: s.inboxVisible,
    priority: s.priority,
    notify: s.notify,
  }
}

let cachedSettings: ChannelSettings[] = DEFAULT_CHANNEL_SETTINGS

export function setChannelSettingsRegistry(settings: ChannelSettings[]): void {
  cachedSettings = settings
}

export function getChannelSettingsRegistry(): ChannelSettings[] {
  return cachedSettings
}

export function getChannelVisual(channel: CommunicationChannel | string): ChannelVisual {
  const normalized = channel.trim().toLowerCase()
  const found = cachedSettings.find((s) => s.key === normalized)
  if (found) return settingsToVisual(found)
  // Fallback: generic "whatsapp" matches first whatsapp_* entry (backward compat)
  if (normalized === "whatsapp") {
    const waFallback = cachedSettings.find((s) => s.key.startsWith("whatsapp_"))
    if (waFallback) return settingsToVisual(waFallback)
  }
  return defaultVisual(normalized)
}

export function getInboxChannelOptions(): ChannelSettings[] {
  return [...cachedSettings].sort((a, b) => a.sortOrder - b.sortOrder)
}

export const PROVIDER_LABELS: Record<CommunicationProvider, string> = {
  ask_me: "Ask Me",
  whatsapp_meta: "WhatsApp Meta Oficial",
  whatsapp_ycloud: "YCloud",
  whatsapp_evolution: "Evolution API",
  facebook_messenger: "Facebook Messenger",
  instagram_dm: "Instagram DM",
  telegram_bot: "Telegram",
  reddit: "Reddit",
  chatwoot: "Chatwoot",
  telecof: "Telecof (chamadas)",
  email_smtp: "Email",
  manual: "Manual",
}
