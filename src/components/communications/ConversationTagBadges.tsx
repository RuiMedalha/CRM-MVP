import { QUICK_TAGS, QUICK_TAG_COLORS, getQuickTagById } from "@/lib/quickConversationTags"
import type { Conversation } from "@/types/conversation"

export function ConversationTagBadges({
  conversation,
  compact = false,
}: {
  conversation: Conversation
  compact?: boolean
}) {
  const tagIds = conversation.tagIds ?? []
  if (tagIds.length === 0) return null

  const applied = tagIds.map((id) => {
    const quick = getQuickTagById(id)
    if (quick) {
      return {
        id,
        label: quick.label,
        color: QUICK_TAG_COLORS[quick.color],
      }
    }
    return { id, label: id, color: "#64748b" }
  })

  return (
    <>
      {applied.map((tag) => (
        <span
          key={tag.id}
          className={`rounded-full font-medium ring-1 ring-inset ring-black/5 ${
            compact ? "px-1.5 py-0 text-xs" : "px-2 py-0.5 text-xs"
          }`}
          style={{
            backgroundColor: `${tag.color}22`,
            color: tag.color,
          }}
        >
          {tag.label}
        </span>
      ))}
    </>
  )
}
