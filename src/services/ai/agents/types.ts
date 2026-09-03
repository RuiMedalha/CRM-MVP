/**
 * Card 16 — tipos partilhados pelos 3 agentes AI do CRM MVP.
 *
 * Estes tipos modelam:
 *   - Input/output payload de cada agente (leadQualifier, emailDrafter, followupScheduler)
 *   - A linha da collection `ai_agent_runs` (AiAgentRunRow)
 *   - Discriminators e auxiliares para o runRecorder e CRUD.
 *
 * Não dependem do schema Directus em runtime — são apenas o lado TS.
 */

// ─── Agent types ───────────────────────────────────────────────────────────

export type AgentType =
  | "lead_qualifier"
  | "email_drafter"
  | "followup_scheduler";

export type AgentRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "awaiting_human"
  | "approved"
  | "rejected"
  | "failed"
  | "error"
  | "cancelled";

/** Threshold abaixo do qual um run `completed` é automaticamente
 *  degradado para `awaiting_human` (política definida no runRecorder). */
export const CONFIDENCE_THRESHOLD = 0.7;

/** Output union discriminada por `agent_type`. */
export type AgentOutput =
  | LeadQualifierOutput
  | EmailDrafterOutput
  | FollowupSchedulerOutput;

// ─── Lead Qualifier ────────────────────────────────────────────────────────

export interface LeadQualifierInput {
  lead_id?: string | null;
  name: string;
  email?: string | null;
  source?: string | null;
  context?: Record<string, unknown> | null;
}

export interface LeadQualifierOutput {
  qualification_score: number; // 0-100
  suggested_stage: string; // ex: "novo", "qualificado", "proposta", "negociacao"
  suggested_pipeline_id: string | null;
  suggested_assignee_id: string | null;
  key_signals: string[];
  recommended_action: string; // máx 140 chars
  confidence: number; // 0-1
}

// ─── Email Drafter ────────────────────────────────────────────────────────

export interface EmailDrafterInput {
  lead_id?: string | null;
  deal_id?: string | null;
  lead_name: string;
  deal_title?: string | null;
  stage?: string | null;
  recent_messages?: string[] | null;
  context?: Record<string, unknown> | null;
}

export interface EmailDrafterOutput {
  subject: string; // máx 80 chars
  body: string; // PT-PT, 3-6 parágrafos curtos
  call_to_action: string;
  followup_date: string; // ISO YYYY-MM-DD
  /** 0-1; pode estar ausente quando o output vem de fallback determinístico. */
  confidence?: number;
}

// ─── Follow-up Scheduler ──────────────────────────────────────────────────

export interface FollowupSchedulerInput {
  lead_id: string;
  lead_name: string;
  last_follow_up_days: number;
  context?: Record<string, unknown> | null;
}

export type FollowupChannel = "call" | "email" | "whatsapp" | "task";
export type FollowupPriority = "low" | "normal" | "high" | "urgent";

export interface FollowupSchedulerOutput {
  next_action: string; // verbo + alvo, máx 100 chars
  suggested_date: string; // ISO YYYY-MM-DD
  priority: FollowupPriority;
  channel: FollowupChannel;
  draft_message: string; // PT-PT, máx 280 chars
  /** 0-1; pode estar ausente quando o output vem de fallback determinístico. */
  confidence?: number;
  awaiting_human?: boolean;
}

// ─── AgentRun (linha da collection ai_agent_runs) ──────────────────────────

/** Payload de criação (campos obrigatórios + opcionais no POST). */
export interface AgentRunCreate {
  agent_type: AgentType;
  input_payload: Record<string, unknown>;
  status?: AgentRunStatus;
  lead_id?: string | null;
  deal_id?: string | null;
  follow_up_id?: string | null;
}

/** Linha persistida — corresponde a todos os campos da collection
 *  `ai_agent_runs` no Directus. Campos opcionais no create podem vir
 *  populados após o `update` final via runRecorder. */
export interface AiAgentRunRow {
  id: number | string;
  agent_type: AgentType;
  input_payload: Record<string, unknown>;
  output_payload?: AgentOutput | Record<string, unknown> | null;
  status: AgentRunStatus;
  confidence_score?: number | null;
  human_reviewed_by?: string | null;
  human_approved?: boolean | null;
  human_reject_reason?: string | null;
  provider?: string | null;
  model?: string | null;
  tokens_used?: number | null;
  latency_ms?: number | null;
  error?: string | null;
  lead_id?: string | null;
  deal_id?: string | null;
  follow_up_id?: string | null;
  date_created?: string;
  date_updated?: string;
}

/** Resultado público devolvido pelas funções `qualifyLead` /
 *  `draftEmail` / `scheduleFollowup`. */
export interface AgentRunResult<TOutput extends AgentOutput = AgentOutput> {
  run: AiAgentRunRow;
  output: TOutput;
}
