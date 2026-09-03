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
}

export interface Customer360Data {
  organization: Customer360Organization;
  contacts: Customer360Contact[];
  timeline: Customer360TimelineEvent[];
  opportunities: Customer360Opportunity[];
  proposals: Customer360Proposal[];
}
