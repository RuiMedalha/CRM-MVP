import { memo } from "react"

import { getChannelVisual } from "@/lib/channelRegistry"
import { formatConversationUpdatedAt } from "@/lib/formatConversationTime"
import { formatLastMessagePreview } from "@/lib/messageMetadata"
import { getOperationalStatusLabel } from "./ConversationStatusBadge"
import { ConversationTagBadges } from "./ConversationTagBadges"

import type { Conversation } from "@/types/conversation"

function isPhoneLike(value: string): boolean {
  const stripped = value.replace(/[\s\-\+\(\)]/g, "");
  return /^\d{7,15}$/.test(stripped);
}

/** If customerName looks like a phone number, return a cleaner display */
function displayName(conv: Conversation): string {
  const name = conv.customerName || "";
  // If it's purely digits/spaces/+/- (phone-like), try source as JID name
  const stripped = name.replace(/[\s\-\+\(\)]/g, "");
  if (isPhoneLike(name)) {
    // Format as readable phone
    return `+${stripped.slice(0, 3)} ${stripped.slice(3, 6)} ${stripped.slice(6, 9)} ${stripped.slice(9)}`.trim();
  }
  return name || "Sem nome";
}

/** Extrai o número de telefone do "source" da conversa (JID Evolution ou "meta:ID:NUM"). */
function displayPhone(conv: Conversation): string {
  const raw = conv.source || "";
  const metaMatch = raw.match(/^meta:[^:]+:(\d{7,15})$/);
  if (metaMatch) return `+${metaMatch[1]}`;
  const withoutJid = raw.replace(/@.*$/, "").trim();
  const digits = withoutJid.replace(/[^\d+]/g, "");
  if (digits.length < 7) return "";
  return digits.startsWith("+") ? digits : `+${digits}`;
}

interface Props {
  conversation: Conversation
  company?: string
  selected?: boolean
  compact?: boolean
  onSelect?: () => void
  onAssume?: () => void
}

function statusBadgeClass(tone: "green" | "blue" | "slate" | "amber"): string {
  switch (tone) {
    case "green": return "bg-green-100 text-green-800 ring-green-600/20"
    case "blue": return "bg-blue-100 text-blue-800 ring-blue-600/20"
    case "amber": return "bg-amber-100 text-amber-900 ring-amber-600/25"
    case "slate": return "bg-muted text-muted-foreground ring-slate-400/30"
  }
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  normal: "bg-transparent",
  low: "bg-muted-foreground",
}

function ConversationItemBase({
  conversation,
  company,
  selected,
  compact = false,
  onSelect,
  onAssume,
}: Props) {
  const unread = conversation.unreadCount > 0
  // Usar instanceName para resolver o canal específico (ex: whatsapp_916 vs whatsapp_918)
  const channelKey = conversation.channel === "whatsapp" && conversation.instanceName
    ? `whatsapp_${conversation.instanceName.replace(/^hotelequip-/, "")}`
    : conversation.channel
  const channel = getChannelVisual(channelKey)
  const ChannelIcon = channel.Icon
  const showAssume =
    conversation.status === "ai_active" || conversation.status === "handoff"
  const { label: statusLabel, tone: statusTone } = getOperationalStatusLabel(conversation)
  const priority = conversation.priority ?? "normal"
  const priorityDot = PRIORITY_DOT[priority] ?? PRIORITY_DOT.normal

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect?.()
        }
      }}
      className={[
        "cursor-pointer rounded-lg border text-left transition",
        compact ? "p-2.5 shadow-sm" : "rounded-xl p-4 shadow-sm",
        "hover:border-border hover:shadow-md",
        selected
          ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/40"
          : "border-border bg-card",
        unread ? "border-l-[3px] border-l-blue-600" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot}`}
          title={`Prioridade: ${priority}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <h2 className={`truncate font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>
              {displayName(conversation)}
            </h2>
            <time className="shrink-0 text-xs font-medium text-muted-foreground" dateTime={conversation.lastActivityAt || conversation.createdAt}>
              {formatConversationUpdatedAt(conversation.lastActivityAt || conversation.createdAt)}
            </time>
          </div>

          {(() => {
            // Mostrar o número de telefone como subtítulo sempre que o nome
            // apresentado for um nome real (não o próprio número formatado).
            if (compact) return null
            const name = conversation.customerName || ""
            if (!name || isPhoneLike(name)) return null
            const phone = displayPhone(conversation)
            if (!phone) return null
            return <p className="truncate text-xs text-muted-foreground">{phone}</p>
          })()}

          {company && !compact && (
            <p className="truncate text-xs text-muted-foreground">{company}</p>
          )}

          <p className={`line-clamp-1 text-muted-foreground ${compact ? "mt-0.5 text-xs" : "mt-1 text-sm"}`}>
            {(() => {
              const preview = formatLastMessagePreview(
                conversation.lastMessage,
                conversation.lastMessageContentType,
              )
              if (preview) return preview
              if (conversation.lastMessage?.trim()) return ""
              return "Sem mensagens"
            })()}
          </p>
        </div>

        {unread && (
          <span
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-bold text-white"
            aria-label={`${conversation.unreadCount} não lidas`}
          >
            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: channel.color }}
        >
          <ChannelIcon className="h-2.5 w-2.5" aria-hidden />
          {channel.label}
        </span>

        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(statusTone)}`}
        >
          {statusLabel}
        </span>

        <ConversationTagBadges conversation={conversation} compact />

        {conversation.assignedTo && (
          <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
            {conversation.assignedTo}
          </span>
        )}
      </div>

      {showAssume && onAssume && !compact && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAssume()
          }}
          className="mt-2 w-full rounded-md bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
        >
          Assumir
        </button>
      )}
    </article>
  )
}

// React.memo evita re-render quando o pai (ConversationList) muda por causa
// de qualquer outro campo do store (filtros, scroll, fetch, etc.). O item
// só re-renderiza se a referência da conversa, selected, ou os handlers
// mudarem. Crítico em mobile onde a lista pode ter 200+ conversas.
export const ConversationItem = memo(ConversationItemBase)
