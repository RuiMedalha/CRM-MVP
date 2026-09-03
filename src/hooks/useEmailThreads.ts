import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";

export interface EmailThread {
  id: string;
  subject: string;
  from_address: string;
  to_address: string;
  mailbox: string | null;
  category: string;
  status: string;
  urgency: string;
  sla_due_at: string | null;
  ai_summary: string | null;
  ai_draft: string | null;
  assigned_to: number | null;
  assigned_at: string | null;
  date_created: string;
  first_replied_at: string | null;
  contact_id: number | null;
  read_at: string | null;
  lead_id: number | null;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  to_address: string;
  subject: string;
  body_text: string;
  body_html?: string;
  attachments?: { file: string; filename: string; mimetype: string; size?: number }[] | null;
  received_at: string | null;
  sent_at: string | null;
  is_draft: boolean;
}

export interface EmailFilters {
  mailbox: string;
  status: string;
  category: string;
  onlyUnassigned: boolean;
}

const THREAD_FIELDS = [
  "id","subject","from_address","to_address","mailbox","category","status","urgency",
  "sla_due_at","ai_summary","ai_draft","assigned_to","assigned_at","date_created",
  "first_replied_at","contact_id","read_at","lead_id"
].join(",");

function buildThreadParams(filters: EmailFilters): string {
  const parts: string[] = [
    `fields=${THREAD_FIELDS}`,
    "limit=50",
    "sort=-date_created",
    "filter[status][_neq]=invalid", // Exclude invalid/malformed threads (null mailbox, etc)
  ];

  if (filters.onlyUnassigned) {
    parts.push("filter[assigned_to][_null]=true");
  }
  if (filters.mailbox) {
    parts.push(`filter[mailbox][_eq]=${encodeURIComponent(filters.mailbox)}`);
  }
  if (filters.status) {
    parts.push(`filter[status][_eq]=${encodeURIComponent(filters.status)}`);
  }
  if (filters.category) {
    parts.push(`filter[category][_eq]=${encodeURIComponent(filters.category)}`);
  }

  return parts.join("&");
}

export function useEmailThreads(filters: EmailFilters) {
  return useQuery({
    queryKey: ["email-threads", filters],
    queryFn: async (): Promise<EmailThread[]> => {
      const params = buildThreadParams(filters);
      const res = await directusRequest<{ data: EmailThread[] }>(`/items/email_threads?${params}`);
      return res?.data ?? [];
    },
    refetchInterval: 30_000, // polling every 30s
  });
}

export function useEmailUnassignedCount() {
  return useQuery({
    queryKey: ["email-threads-unassigned-count"],
    queryFn: async (): Promise<number> => {
      const res = await directusRequest<{ data: Array<{ count: { id: number } }> }>(
        "/items/email_threads?filter[assigned_to][_null]=true&filter[status][_neq]=closed&aggregate[count]=id"
      );
      return res?.data?.[0]?.count?.id ?? 0;
    },
    refetchInterval: 60_000,
  });
}

export function useEmailMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: ["email-messages", threadId],
    queryFn: async (): Promise<EmailMessage[]> => {
      const res = await directusRequest<{ data: EmailMessage[] }>(
        `/items/email_messages?filter[thread_id][_eq]=${threadId}&sort=received_at&fields=id,direction,from_address,to_address,subject,body_text,body_html,attachments,received_at,sent_at,is_draft`
      );
      return res?.data ?? [];
    },
    enabled: !!threadId,
  });
}

export function useAssignThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, employeeId }: { threadId: string; employeeId: number }) => {
      const res = await directusRequest<{ data: EmailThread }>(`/items/email_threads/${threadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          assigned_to: employeeId,
          assigned_at: new Date().toISOString(),
          status: "assigned",
        }),
      });
      return res?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-threads"] });
      qc.invalidateQueries({ queryKey: ["email-threads-unassigned-count"] });
    },
  });
}

export function useCloseThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const res = await directusRequest<{ data: EmailThread }>(`/items/email_threads/${threadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "closed",
          closed_at: new Date().toISOString(),
        }),
      });
      return res?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-threads"] });
      qc.invalidateQueries({ queryKey: ["email-threads-unassigned-count"] });
    },
  });
}
