/**
 * Lead — tipos de domínio para a entidade `lead`.
 *
 * Estes tipos são consumidos pelos serviços de captação, scoring,
 * qualificação IA e pela vista de Customer 360. Não dependem do schema
 * Directus em runtime — são apenas o lado TS.
 */

export type LeadStatus =
  | "novo"
  | "contactado"
  | "qualificado"
  | "proposta"
  | "negociacao"
  | "ganho"
  | "perdido"
  | "descartado";

export type LeadSource =
  | "website"
  | "formulario"
  | "email"
  | "telefone"
  | "whatsapp"
  | "indicacao"
  | "manual"
  | "importacao"
  | "outro";

/** Resposta de WhatsApp (inbound) associada a um lead. */
export interface WhatsappReply {
  id: string;
  lead_id: string;
  channel: "whatsapp_913" | "whatsapp_916" | "whatsapp_918" | "whatsapp";
  from_number?: string;
  body: string;
  received_at: string;
  agent_run_id?: string | null;
}

/** Evento de abertura de email (tracking pixel). */
export interface EmailOpen {
  id: string;
  lead_id: string;
  message_id?: string;
  opened_at: string;
  ip_address?: string;
  user_agent?: string;
  device?: "desktop" | "mobile";
}

/** Entidade principal — `LeadItem`. */
export interface LeadItem {
  id: string;
  name: string;
  email?: string | null;
  /** Telefone principal de contacto. */
  contact_phone?: string | null;
  /** Telefone alternativo / whatsapp. */
  whatsapp_phone?: string | null;
  company?: string | null;
  job_title?: string | null;
  source?: LeadSource | null;
  status: LeadStatus;
  score?: number | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  tags?: string[];
  estimated_value?: number | null;
  currency?: string;
  campaign?: string | null;

  /** Respostas WhatsApp recebidas (relação 1-N). */
  whatsapp_replies?: WhatsappReply[];

  /** Eventos de abertura de email (relação 1-N). */
  email_opens?: EmailOpen[];

  /** Timestamps ISO. */
  created_at?: string;
  updated_at?: string;
  last_contacted_at?: string | null;
  last_activity_at?: string | null;
}
