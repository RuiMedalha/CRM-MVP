import { ConversationList } from "./ConversationList"
import { TelecofCallsList } from "./TelecofCallsList"
import { useInboxFilterStore } from "@/store/inboxFilterStore"

export function InboxLeftColumn() {
  const inboxViewMode = useInboxFilterStore((s) => s.inboxViewMode)
  if (inboxViewMode === "telecof_calls") return <TelecofCallsList />
  return <ConversationList />
}
