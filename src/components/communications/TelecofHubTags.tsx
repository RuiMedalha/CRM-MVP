import {
  getTelecofHubTags,
  TELECOF_ATTENDANCE_TAGS,
  type TelecofAttendanceTag,
} from "@/lib/telecofHubData"
import type { TelecofCallEventRecord } from "@/types/telecof"

export function TelecofHubTags({
  event,
  size = "sm",
}: {
  event: TelecofCallEventRecord
  size?: "sm" | "xs"
}) {
  const tags = getTelecofHubTags(event)
  if (tags.length === 0) return null

  const cls =
    size === "xs"
      ? "rounded px-1 py-0.5 text-xs font-medium"
      : "rounded-md px-1.5 py-0.5 text-xs font-medium"

  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className={`${cls} bg-primary/10 text-primary`}>
          {tag}
        </span>
      ))}
    </span>
  )
}

export function TelecofTagPicker({
  activeTags,
  disabled,
  onToggle,
}: {
  activeTags: TelecofAttendanceTag[]
  disabled?: boolean
  onToggle: (tag: TelecofAttendanceTag) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TELECOF_ATTENDANCE_TAGS.map((tag) => {
        const active = activeTags.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(tag)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
              active
                ? "border-primary bg-primary text-white"
                : "border-border bg-card text-foreground hover:border-primary"
            }`}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}
