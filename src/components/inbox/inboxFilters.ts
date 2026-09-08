// Helpers for sorting / filtering the unified inbox list.
// Pure functions — no React. Reused by column 1 and tests.

import type {
  InboxChannelKey,
  InboxStatusKey,
  UnifiedInboxItem,
} from "./types";

const URGENCY_WEIGHT: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function isOverdue(slaAt: string | null, now: number = Date.now()): boolean {
  if (!slaAt) return false;
  const t = new Date(slaAt).getTime();
  return Number.isFinite(t) && t < now;
}

/**
 * Sort by SLA overdue first → urgency → most recent.
 * Pure function — does not mutate.
 */
export function sortByUrgencyAndDate(
  a: UnifiedInboxItem,
  b: UnifiedInboxItem,
  now: number = Date.now(),
): number {
  const aOverdue = isOverdue(a.slaAt, now) ? -1 : 0;
  const bOverdue = isOverdue(b.slaAt, now) ? -1 : 0;
  if (aOverdue !== bOverdue) return aOverdue - bOverdue;
  const uA = URGENCY_WEIGHT[a.urgency] ?? 2;
  const uB = URGENCY_WEIGHT[b.urgency] ?? 2;
  if (uA !== uB) return uA - uB;
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

export function applyInboxFilters(
  items: UnifiedInboxItem[],
  options: {
    channel: InboxChannelKey | "all";
    status: InboxStatusKey;
    currentEmployeeId?: string | number | null;
    now?: number;
  },
): UnifiedInboxItem[] {
  const { channel, status, currentEmployeeId, now = Date.now() } = options;
  return items
    .filter((item) => {
      if (channel !== "all" && item.channel !== channel) return false;
      switch (status) {
        case "all":
          return true;
        case "unread":
          return item.unread;
        case "mine":
          return currentEmployeeId
            ? item.ownedByCurrentUser(currentEmployeeId)
            : false;
        case "sla_breached":
          return isOverdue(item.slaAt, now);
        default:
          return true;
      }
    })
    .sort((a, b) => sortByUrgencyAndDate(a, b, now));
}
