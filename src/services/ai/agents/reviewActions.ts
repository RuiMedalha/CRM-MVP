/**
 * Card 16 — Ações executadas pela UI /ai-review quando o humano
 * Aprova / Edita / Rejeita um run do agente.
 */

import { updateAiAgentRun } from "@/integrations/directus/ai-agent-runs";
import { createActivity } from "@/integrations/directus/activities";
import { createFollowUp } from "@/integrations/directus/follow-ups";
import {
  AiAgentRunRow,
  EmailDrafterOutput,
  FollowupSchedulerOutput,
  LeadQualifierOutput,
} from "./types";

export interface Reviewer {
  id: string;
  email?: string | null;
  name?: string | null;
}

async function markReviewed(
  runId: string | number,
  patch: Partial<AiAgentRunRow>,
  reviewer: Reviewer,
  summary: string
): Promise<AiAgentRunRow | null> {
  const updated = await updateAiAgentRun(runId, {
    human_reviewed_by: reviewer.id,
    ...patch,
  });
  await createActivity({
    type: "note",
    channel: "crm",
    status: (patch.status as string) ?? "completed",
    direction: null,
    summary,
    occurred_at: new Date().toISOString(),
    lead_id: updated?.lead_id ?? null,
    deal_id: updated?.deal_id ?? null,
    source_collection: "ai_agent_runs",
    source_id: String(runId),
    payload: {
      reviewer_id: reviewer.id,
      reviewer_email: reviewer.email ?? null,
      action: summary,
    },
  });
  return updated;
}

export async function approveLeadQualification(
  run: AiAgentRunRow,
  reviewer: Reviewer
): Promise<AiAgentRunRow | null> {
  const out = run.output_payload as LeadQualifierOutput | undefined;
  return markReviewed(
    run.id,
    {
      status: "completed",
      human_approved: true,
    },
    reviewer,
    `[ai:lead_qualifier] aprovado por ${reviewer.name || reviewer.email} (score=${
      out?.qualification_score ?? "?"
    })`
  );
}

export async function approveEmailDraft(
  run: AiAgentRunRow,
  reviewer: Reviewer
): Promise<AiAgentRunRow | null> {
  const out = run.output_payload as EmailDrafterOutput | undefined;
  if (out?.followup_date && run.lead_id) {
    await createFollowUp({
      title: `Follow-up email aprovado (${out.subject?.slice(0, 50) || "sem assunto"})`,
      notes: out.body || "",
      status: "open",
      type: "email",
      due_at: `${out.followup_date}T09:00:00.000Z`,
      contact_id: null,
    } as any).catch(() => null);
  }

  return markReviewed(
    run.id,
    { status: "completed", human_approved: true },
    reviewer,
    `[ai:email_drafter] aprovado por ${reviewer.name || reviewer.email}`
  );
}

export async function approveFollowupDraft(
  run: AiAgentRunRow,
  reviewer: Reviewer
): Promise<AiAgentRunRow | null> {
  const out = run.output_payload as FollowupSchedulerOutput | undefined;
  if (out?.suggested_date && run.lead_id) {
    await createFollowUp({
      title: out.next_action,
      notes: out.draft_message,
      status: "open",
      type: out.channel,
      due_at: `${out.suggested_date}T09:00:00.000Z`,
      contact_id: null,
    } as any).catch(() => null);
  }
  return markReviewed(
    run.id,
    { status: "completed", human_approved: true },
    reviewer,
    `[ai:followup_scheduler] aprovado por ${reviewer.name || reviewer.email}`
  );
}

export async function rejectAgentRun(
  run: AiAgentRunRow,
  reviewer: Reviewer,
  reason: string
): Promise<AiAgentRunRow | null> {
  return markReviewed(
    run.id,
    {
      status: "failed",
      human_approved: false,
      human_reject_reason: reason,
    },
    reviewer,
    `[ai:${run.agent_type}] rejeitado por ${reviewer.name || reviewer.email}: ${reason}`
  );
}