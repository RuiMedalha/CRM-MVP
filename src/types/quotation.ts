// ─── Quotation Types ─────────────────────────────────────────────────────────
// Tipos completos para o módulo de propostas (Offerneo-style upgrade)

export type QuotationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "converted"
  | "expired";

export type QuotationItemType = "product" | "service" | "additional";

export type QuotationTheme = "light" | "dark" | "system";

export type QuotationLanguage = "pt" | "en" | "es";

export type Treatment = "Sr." | "Sra." | "Empresa";

export type DepositType = "partial" | "full";

export type NextStepIcon = "payment" | "phone" | "calendar" | "email" | "custom";

export type ReviewSource = "manual" | "google";

// ─── Nested Types ────────────────────────────────────────────────────────────

export interface NextStep {
  icon: NextStepIcon;
  title: string;
  description: string;
}

export interface QuotationReview {
  id?: number;
  quotation_id?: number;
  reviewer_name: string;
  rating: number; // 1-5
  review_text?: string;
  source: ReviewSource;
  date_created?: string;
}

export interface QuotationTemplate {
  id?: number;
  name: string;
  description?: string;
  data: Record<string, unknown>; // snapshot completo da proposta
  date_created?: string;
  date_updated?: string;
  created_by?: string;
}

export interface QuotationViewLog {
  id?: number;
  quotation_id: number;
  viewed_at: string;
  duration_seconds?: number;
  ip_hash?: string;
  device?: "desktop" | "mobile";
}

// ─── Quotation Item ──────────────────────────────────────────────────────────

export interface QuotationItem {
  id?: number | string;
  quotation_id?: number | string;
  item_type: QuotationItemType;
  product_id?: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  discount_percent?: number;
  line_total: number;
  notes?: string;
  sort_order?: number;
  image_url?: string;
  images?: string[]; // até 5 imagens
  product_url?: string;
  iva_percent?: number;
  manual_entry?: boolean;
  datasheet_url?: string; // ficha técnica PDF ou link externo
  datasheet_label?: string;
  ai_description?: string;
  // Comparação
  comparison_group?: string; // ex: "A", "B" — produtos com o mesmo grupo são comparados
  is_recommended?: boolean;
  comparison_specs?: Array<{ label: string; value: string }>;

  /** Sub-itens (ex: acessórios de um produto, opções aninhadas). */
  items?: QuotationLineItem[];
}

/**
 * Line item mais simples, usado pelo builder/proposal wizard onde
 * os campos ricos (AI description, datasheet, etc.) ainda não estão
 * preenchidos.
 */
export interface QuotationLineItem {
  id?: number | string;
  product_id?: string | number;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  line_total: number;
  notes?: string;
}

/**
 * Alias para compatibilidade com o ProposalBuilder / quotation-builder
 * que importa `QuotationBuilderItem` em vez de `QuotationItem`.
 */
export type QuotationBuilderItem = QuotationItem;

/**
 * Alias de `QuotationItem` para compat — algumas áreas do código
 * ainda importam `LineItem` em vez de `QuotationItem`.
 */
export type LineItem = QuotationItem;

// ─── Quotation (main entity) ─────────────────────────────────────────────────

export interface Quotation {
  id?: number | string;
  quotation_number?: string;
  status: QuotationStatus;
  customer_id?: number | string;
  deal_id?: string;

  // Dados do cliente para proposta
  treatment?: Treatment;
  language?: QuotationLanguage;
  customer_timezone?: string;

  // Conteúdo
  welcome_message?: string;
  proposal_description?: string;
  comparison_recommendation_text?: string;
  notes?: string;
  terms_conditions?: string;
  internal_notes?: string;
  voice_message_url?: string;
  video_url?: string;
  next_steps?: NextStep[];

  // Financeiro
  subtotal?: number;
  discount_percent?: number;
  discount_amount?: number;
  total_amount?: number;
  deposit_type?: DepositType;
  deposit_percent?: number;

  // Urgência
  urgency_discount_pct?: number;
  urgency_hours?: number;
  urgency_expires_at?: string;

  // Configurações
  valid_until?: string;
  theme?: QuotationTheme;
  phone_gate_enabled?: boolean;

  // Tracking
  public_token?: string;
  viewed_at?: string;
  view_count?: number;
  last_viewed_at?: string;
  unique_visitors?: number;
  avg_duration_seconds?: number;
  persuasion_score?: number;

  // Envio
  sent_at?: string;
  sent_to_email?: string;
  sent_to_phone?: string;
  notification_sent?: boolean;

  // Resposta do cliente
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  approval_signature?: string;

  // Integrações
  moloni_document_id?: string;
  pdf_file_url?: string;
  pdf_link?: string;
  template_id?: number;

  // Follow-ups
  follow_up_1_sent_at?: string;
  follow_up_2_sent_at?: string;
  follow_up_3_sent_at?: string;

  // Timestamps
  date_created?: string;
  date_updated?: string;

  // Relações
  items?: QuotationItem[];
  reviews?: QuotationReview[];
}

// ─── Persuasion Score ────────────────────────────────────────────────────────

export interface PersuasionSuggestion {
  text: string;
  points: number;
  field: string;
}

export interface PersuasionResult {
  score: number;
  suggestions: PersuasionSuggestion[];
}

// ─── Public Quotation (campos seguros para expor ao cliente) ─────────────────

export interface PublicQuotation {
  id: number | string;
  quotation_number?: string;
  status: QuotationStatus;
  treatment?: Treatment;
  language?: QuotationLanguage;
  welcome_message?: string;
  proposal_description?: string;
  comparison_recommendation_text?: string;
  voice_message_url?: string;
  video_url?: string;
  next_steps?: NextStep[];
  subtotal?: number;
  discount_percent?: number;
  discount_amount?: number;
  total_amount?: number;
  deposit_type?: DepositType;
  deposit_percent?: number;
  urgency_discount_pct?: number;
  urgency_hours?: number;
  urgency_expires_at?: string;
  valid_until?: string;
  theme?: QuotationTheme;
  phone_gate_enabled?: boolean;
  approved_at?: string;
  rejected_at?: string;
  items?: PublicQuotationItem[];
  reviews?: QuotationReview[];
  customer_name?: string;
  date_created?: string;
  customer_company?: string;
  pdf_file_url?: string;
  terms_conditions?: string;
  public_token?: string;
}

export interface PublicQuotationItem {
  id: number | string;
  item_type: QuotationItemType;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  line_total: number;
  image_url?: string;
  images?: string[];
  product_url?: string;
  datasheet_url?: string;
  datasheet_label?: string;
  ai_description?: string;
  notes?: string;
  sort_order?: number;
  // Comparação
  comparison_group?: string;
  is_recommended?: boolean;
  comparison_specs?: Array<{ label: string; value: string }>;
  // Meilisearch product fields
  short_description?: string;
  full_description?: string;
  faq?: string;
  brand?: string;
  on_sale?: boolean;
  regular_price?: number;
  sale_price?: number;
  stock_status?: string;
}
