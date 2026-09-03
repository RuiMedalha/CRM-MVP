/**
 * useEmailSend — hook for sending emails via the /email-send Directus endpoint.
 * Handles file upload (to Directus files) + calls the endpoint.
 */

import { useCallback } from "react";
import { directusRequest, DIRECTUS_URL } from "@/integrations/directus/client";
import { useCompanySettings } from "@/hooks/useSettings";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { getEmailSignature } from "@/lib/emailSignature";

export interface EmailSendPayload {
  to: string;
  subject: string;
  bodyHtml: string;
  attachments: File[];
}

export function useEmailSend(options?: {
  mailbox?: string;
  threadId?: string;
  inReplyToMessageId?: string;
}) {
  const { data: settings } = useCompanySettings();
  const { employee } = useCurrentEmployee();

  const getSignature = useCallback((): string => {
    const fromEmployee = (employee as Record<string, unknown> | undefined)?.email_signature as string | null;
    const fromSettings = (settings as Record<string, unknown>)?.email_signature_html as string | null;
    return getEmailSignature(fromEmployee, fromSettings);
  }, [settings, employee]);

  const send = useCallback(async (payload: EmailSendPayload): Promise<void> => {
    // 1. Upload attachments to Directus files
    const uploadedAttachments: { file: string; filename: string }[] = [];
    for (const file of payload.attachments) {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const resp = await fetch(`${DIRECTUS_URL}/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("directus_access_token") || ""}`,
        },
        body: formData,
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.data?.id) {
          uploadedAttachments.push({ file: data.data.id, filename: file.name });
        }
      }
    }

    // 2. Call /email-send endpoint
    await directusRequest("/email-send", {
      method: "POST",
      body: JSON.stringify({
        mailbox: options?.mailbox || "geral",
        to: payload.to,
        subject: payload.subject,
        bodyHtml: payload.bodyHtml,
        threadIdExt: options?.threadId || undefined,
        inReplyToMessageId: options?.inReplyToMessageId || undefined,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      }),
    });
  }, [options?.mailbox, options?.threadId, options?.inReplyToMessageId]);

  return { send, getSignature };
}
