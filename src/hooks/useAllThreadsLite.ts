/**
 * useAllThreadsLite — fetches minimal thread data from BOTH mailboxes
 * for cross-mailbox duplicate detection. Limited to last 30 days.
 */

import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import type { EmailThread } from "@/hooks/useEmailThreads";

export function useAllThreadsLite() {
  return useQuery({
    queryKey: ["email-threads-all-lite"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const res = await directusRequest<{ data: EmailThread[] }>(
        `/items/email_threads?filter[date_created][_gte]=${thirtyDaysAgo}&fields=id,from_address,subject,mailbox,date_created&limit=500&sort=-date_created`
      );
      return res?.data ?? [];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
