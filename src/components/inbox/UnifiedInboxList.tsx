import { useEffect, useMemo } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { InboxFilterChips } from "./InboxFilterChips";
import { UnifiedInboxRow } from "./UnifiedInboxRow";
import { applyInboxFilters } from "./inboxFilters";
import type {
  InboxChannelKey,
  InboxStatusKey,
  UnifiedInboxItem,
} from "./types";

export interface UnifiedInboxListProps {
  items: UnifiedInboxItem[];
  selectedId: string | null;
  onSelect: (item: UnifiedInboxItem) => void;
  channel: InboxChannelKey | "all";
  status: InboxStatusKey;
  onStatusChange: (next: InboxStatusKey) => void;
  currentEmployeeId?: string | number | null;
  /**
   * Notifica o pai sobre a lista filtrada/ordenada actual.
   * Usado pela navegação por teclado (J/K/Enter/Esc) na página Inbox.
   */
  onFilteredChange?: (filtered: UnifiedInboxItem[]) => void;
}

export function UnifiedInboxList({
  items,
  selectedId,
  onSelect,
  channel,
  status,
  onStatusChange,
  currentEmployeeId,
  onFilteredChange,
}: UnifiedInboxListProps) {
  const filtered = useMemo(
    () =>
      applyInboxFilters(items, {
        channel,
        status,
        currentEmployeeId,
      }),
    [items, channel, status, currentEmployeeId],
  );

  // Empurra a lista filtrada para o pai sempre que muda — usado pelo keyboard nav.
  useEffect(() => {
    if (!onFilteredChange) return;
    onFilteredChange(filtered);
  }, [filtered, onFilteredChange]);

  const counts = useMemo(() => {
    const acc: Partial<Record<InboxStatusKey, number>> = {
      all: items.length,
      unread: 0,
      mine: 0,
      sla_breached: 0,
    };
    const now = Date.now();
    for (const item of items) {
      if (item.unread) acc.unread = (acc.unread ?? 0) + 1;
      if (currentEmployeeId && item.ownedByCurrentUser(currentEmployeeId)) {
        acc.mine = (acc.mine ?? 0) + 1;
      }
      if (item.slaAt && new Date(item.slaAt).getTime() < now) {
        acc.sla_breached = (acc.sla_breached ?? 0) + 1;
      }
    }
    return acc;
  }, [items, currentEmployeeId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InboxFilterChips
        value={status}
        onChange={onStatusChange}
        counts={counts}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground">
            <InboxIcon className="mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">Sem mensagens para este filtro.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/0">
            {filtered.map((item) => (
              <li key={item.id}>
                <UnifiedInboxRow
                  item={item}
                  active={item.id === selectedId}
                  onSelect={() => onSelect(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
