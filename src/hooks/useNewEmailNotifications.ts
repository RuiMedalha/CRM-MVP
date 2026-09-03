/**
 * useNewEmailNotifications — alerts for unassigned and urgent emails.
 * - Every 60s: toasts for new unassigned emails
 * - Every 15 min: repeats alert for urgent threads without reply
 */

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import { toast } from "@/hooks/use-toast";

const CHECK_INTERVAL = 60_000; // 1 minute for new emails
const URGENT_REPEAT_INTERVAL = 15 * 60_000; // 15 min for urgent repeat

interface EmailThread {
  id: string;
  subject: string;
  from_address: string;
  assigned_to: number | null;
  urgency: string | null;
  first_replied_at: string | null;
  status: string;
}

export function useNewEmailNotifications(): void {
  const notifiedIds = useRef<Set<string>>(new Set());
  const urgentLastNotified = useRef<Record<string, number>>({});

  // Unassigned emails
  const { data: unassigned } = useQuery({
    queryKey: ["email-notifications-unassigned"],
    queryFn: async () => {
      const res = await directusRequest<{ data: EmailThread[] }>(
        "/items/email_threads?filter[assigned_to][_null]=true&filter[status][_neq]=closed&sort=-date_created&limit=10&fields=id,subject,from_address,assigned_to,urgency,status"
      );
      return res?.data ?? [];
    },
    refetchInterval: CHECK_INTERVAL,
    staleTime: CHECK_INTERVAL - 5000,
  });

  // Urgent without reply
  const { data: urgentThreads } = useQuery({
    queryKey: ["email-notifications-urgent"],
    queryFn: async () => {
      const res = await directusRequest<{ data: EmailThread[] }>(
        "/items/email_threads?filter[urgency][_in]=alta,urgente&filter[first_replied_at][_null]=true&filter[status][_neq]=closed&sort=-date_created&limit=10&fields=id,subject,from_address,urgency,first_replied_at,status"
      );
      return res?.data ?? [];
    },
    refetchInterval: CHECK_INTERVAL,
    staleTime: CHECK_INTERVAL - 5000,
  });

  // Notify unassigned
  useEffect(() => {
    if (!unassigned?.length) return;
    for (const thread of unassigned) {
      if (notifiedIds.current.has(thread.id)) continue;
      notifiedIds.current.add(thread.id);
      toast({
        title: "📧 Email não atribuído",
        description: `${thread.subject || "Sem assunto"} — ${thread.from_address || "?"}`,
      });
    }
  }, [unassigned]);

  // Repeat alert for urgent
  useEffect(() => {
    if (!urgentThreads?.length) return;
    const now = Date.now();
    for (const thread of urgentThreads) {
      const lastNotified = urgentLastNotified.current[thread.id] || 0;
      if (now - lastNotified < URGENT_REPEAT_INTERVAL) continue;
      urgentLastNotified.current[thread.id] = now;
      toast({
        title: "🔴 Email URGENTE sem resposta",
        description: `${thread.subject || "Sem assunto"} — aguarda resposta`,
        variant: "destructive",
      });
    }
  }, [urgentThreads]);
}
