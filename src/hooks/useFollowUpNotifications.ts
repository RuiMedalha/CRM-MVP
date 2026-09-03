/**
 * useFollowUpNotifications — checks for upcoming/overdue follow-ups
 * and shows toast notifications. Runs every 60 seconds.
 */

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listFollowUps, type FollowUpRow } from "@/integrations/directus/follow-ups";
import { toast } from "@/hooks/use-toast";

const CHECK_INTERVAL = 60_000; // 1 minute
const NOTIFY_WITHIN_MINUTES = 30; // notify if due within 30 min

export function useFollowUpNotifications(): void {
  const notifiedIds = useRef<Set<string>>(new Set());

  const { data: followUps } = useQuery({
    queryKey: ["follow-up-notifications"],
    queryFn: async () => {
      const now = new Date();
      const soon = new Date(now.getTime() + NOTIFY_WITHIN_MINUTES * 60 * 1000);
      return await listFollowUps({
        status: "open",
        dueBefore: soon.toISOString(),
        limit: 20,
      });
    },
    refetchInterval: CHECK_INTERVAL,
    staleTime: CHECK_INTERVAL - 5000,
  });

  useEffect(() => {
    if (!followUps?.length) return;

    const now = new Date();
    for (const fu of followUps) {
      if (notifiedIds.current.has(fu.id)) continue;

      const dueAt = fu.due_at ? new Date(fu.due_at) : null;
      if (!dueAt) continue;

      const isOverdue = dueAt < now;
      const isDueSoon = dueAt >= now && dueAt.getTime() - now.getTime() <= NOTIFY_WITHIN_MINUTES * 60 * 1000;

      if (isOverdue || isDueSoon) {
        notifiedIds.current.add(fu.id);
        const timeLabel = isOverdue
          ? `Atrasado (${formatRelative(dueAt, now)})`
          : `Daqui a ${formatRelative(dueAt, now)}`;
        toast({
          title: `📋 ${fu.title || "Follow-up"}`,
          description: timeLabel,
          ...(isOverdue ? { variant: "destructive" as const } : {}),
        });
      }
    }
  }, [followUps]);
}

function formatRelative(date: Date, now: Date): string {
  const diffMs = Math.abs(date.getTime() - now.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
