/**
 * Customer 360 — tipos de domínio para a vista consolidada de uma Organization.
 * Não dependem directamente dos tipos do Directus.
 */

export interface Customer360Organization {
  id: string;
  name: string;
  status: string;
  roles: string[];
  entityType?: string;
  entityStatus?: string;
  assignedTo?: string;
  phone?: string;
  mobile_phone?: string;
  email?: string;
  vatNumber?: string;
  website?: string;
  whatsapp_number?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  district?: string;
  country?: string;
  // Dados Fiscais
  vat_intracomunitario?: string;
  cae?: string;
  share_capital?: string;
  // Redes Sociais
  facebook_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  tiktok_url?: string;
  youtube_url?: string;
  // Comercial
  segment?: string;
  origin?: string;
  businessType?: string;
  annualValue?: number;
  potential?: string;
  operationalStatus?: string;
  campanha?: string;
  score?: number;
  potencial_anual?: number;
  // Marketing
  email_marketing_permitido?: boolean;
  whatsapp_marketing?: boolean;
  consentimento?: boolean;
  origem_consentimento?: string;
  idioma?: string;
  segmento_marketing?: string;
  interesses?: string;
  // Emails adicionais
  email_compras?: string;
  email_financeiro?: string;
  email_comercial?: string;
  email_assistencia?: string;
  // Financeiro
  condicoes_pagamento?: string;
  forma_pagamento?: string;
  tabela_precos?: string;
  desconto_geral?: number;
  limite_credito?: number;
  iban?: string;
  // Fornecedor
  categoria_fornecedor?: string;
  representante?: string;
  email_encomendas?: string;
  email_pos_venda?: string;
  moq?: number;
  prazo_entrega?: string;
  incoterm?: string;
  garantia?: string;
  // Integrações
  moloni_client_id?: string;
  mautic_contact_id?: number;
  chatwoot_contact_id?: number;
  woocommerce_id?: string;
  whatsapp_id?: string;
  email_imap?: string;
  // Diversos
  nome_comercial?: string;
  razao_social?: string;
  registo_comercial?: string;
  lastActivityAt?: string;
  createdAt: string;
  notes?: string;
  internal_notes?: string;
}

export interface Customer360Contact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface Customer360TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  occurredAt: string;
  actor?: string;
}

export interface Customer360Opportunity {
  id: string;
  title: string;
  stage: string;
  value?: number;
  assignedTo?: string;
}

export interface Customer360Proposal {
  id: string;
  number: string;
  status: string;
  totalAmount?: number;
  sentAt?: string;
  /** Notas da proposta — usado para detectar IVA discriminado + Auto-IVA. */
  notes?: string | null;
}

export interface Customer360Data {
  organization: Customer360Organization;
  contacts: Customer360Contact[];
  timeline: Customer360TimelineEvent[];
  opportunities: Customer360Opportunity[];
  proposals: Customer360Proposal[];

  // ─── Wave A — extensões usadas pelo Customer 360 (cards 14/15/16) ────────
  /** Notas internas / observações do agente comercial. */
  notes?: Customer360Note[];
  /** Negócios / oportunidades (alias de `opportunities` mas com mais contexto). */
  deals?: Customer360Opportunity[];
  /** Chamadas telefónicas registadas (Telecof, manual). */
  calls?: Customer360Call[];
  /** Mensagens WhatsApp recebidas/enviadas (inbound/outbound). */
  whatsapp?: Customer360WhatsappMessage[];
  /** Emails trocados. */
  email?: Customer360EmailMessage[];
  /** Activity ledger entries — eventos registados pelo sistema. */
  activities?: Customer360Activity[];
}

// ─── Sub-tipos adicionais ────────────────────────────────────────────────

export interface Customer360Note {
  id: string;
  body: string;
  createdAt: string;
  author?: string;
  visibleToCustomer?: boolean;
}

export interface Customer360Call {
  id: string;
  direction: "inbound" | "outbound" | "missed";
  durationSeconds?: number;
  phoneNumber?: string;
  recordingUrl?: string;
  transcription?: string;
  occurredAt: string;
  agent_id?: string;
}

export interface Customer360WhatsappMessage {
  id: string;
  channel: "whatsapp_913" | "whatsapp_916" | "whatsapp_918" | "whatsapp";
  direction: "inbound" | "outbound";
  body: string;
  sentAt: string;
  agent_id?: string | null;
  /** True se foi redigido/respondido por agente IA. */
  ai_drafted?: boolean;
  ai_run_id?: string | null;
}

export interface Customer360EmailMessage {
  id: string;
  direction: "inbound" | "outbound";
  subject: string;
  preview?: string;
  fromAddress?: string;
  toAddress?: string;
  sentAt: string;
  opens?: number;
  clicks?: number;
  /** True se foi redigido por agente IA. */
  ai_drafted?: boolean;
  ai_run_id?: string | null;
}

export interface Customer360Activity {
  id: string;
  type: string; // "note" | "call" | "email" | "whatsapp" | "ai_run" | "task" | ...
  channel?: string;
  direction?: "inbound" | "outbound" | null;
  status?: string;
  summary?: string;
  occurredAt: string;
  actor?: string;
  lead_id?: string | null;
  deal_id?: string | null;
  source_collection?: string;
  source_id?: string;
}
