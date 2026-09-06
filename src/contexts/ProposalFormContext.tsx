/**
 * ProposalFormContext — estado centralizado para o formulário de 8 passos.
 * Auto-save em localStorage para não perder dados entre navegações.
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import type { Quotation, QuotationItem, QuotationReview, NextStep } from "@/types/quotation";

export interface FollowUp {
  days: number;
  message: string;
  channel: "whatsapp" | "email";
  active: boolean;
}

const STORAGE_KEY = "hotelequip_proposal_draft";

// ─── State ───────────────────────────────────────────────────────────────────

export interface ProposalFormState {
  currentStep: number;
  // Step 0 — Client
  customer_id?: number | string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_company?: string;
  sent_to_phone?: string;
  treatment?: "Sr." | "Sra." | "Empresa";
  language?: string;
  customer_timezone?: string;
  isExistingCustomer?: boolean;
  // Step 1 — Content
  proposal_description?: string;
  comparison_recommendation_text?: string;
  welcome_message?: string;
  items: QuotationItem[];
  additional_items: QuotationItem[]; // upsell
  reviews: QuotationReview[];
  voice_message_url?: string;
  video_url?: string;
  next_steps: NextStep[];
  attachments: string[]; // URLs dos ficheiros no R2
  // Step 4 — Settings
  valid_until?: string;
  phone_gate_enabled: boolean;
  deposit_type: "partial" | "full";
  deposit_percent: number;
  urgency_discount_pct?: number;
  urgency_hours?: number;
  theme: "light" | "dark" | "system";
  terms_conditions?: string;
  terms_url?: string;
  show_terms: boolean;
  newsletter_discount_enabled: boolean;
  newsletter_discount_percent: number;
  newsletter_discount_code: string;
  // Step 5 — Persuasion (calculated, not stored)
  // Step 6 — Preview (no state)
  // Step 7 — Send
  followups: FollowUp[];
  notes?: string;
  internal_notes?: string;
  // Meta
  editingId?: string; // se estiver a editar proposta existente
  isDirty: boolean;
}

function generateDiscountCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "HOTEL-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const initialState: ProposalFormState = {
  currentStep: 0,
  items: [],
  additional_items: [],
  reviews: [],
  next_steps: [],
  attachments: [],
  followups: [
    {
      days: 2,
      message: "Olá {nome_cliente}, enviámos uma proposta há alguns dias. Teve oportunidade de a analisar? Estamos disponíveis para esclarecer dúvidas.",
      channel: "whatsapp",
      active: true,
    },
    {
      days: 5,
      message: "Olá {nome_cliente}, a proposta que lhe enviámos tem validade limitada. Gostaríamos de saber se tem alguma questão ou se podemos ajustar algo.",
      channel: "email",
      active: true,
    },
    {
      days: 2,
      message: "Olá {nome_cliente}, a sua proposta expira em breve. Esta é a última oportunidade para garantir as condições apresentadas. Podemos ajudar a finalizar?",
      channel: "whatsapp",
      active: true,
    },
  ],
  phone_gate_enabled: true,
  deposit_type: "full",
  deposit_percent: 0,
  theme: "system",
  language: "pt",
  customer_timezone: "Europe/Lisbon",
  show_terms: false,
  newsletter_discount_enabled: false,
  newsletter_discount_percent: 5,
  newsletter_discount_code: generateDiscountCode(),
  isDirty: false,
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_STEP"; step: number }
  | { type: "UPDATE_FIELD"; field: string; value: unknown }
  | { type: "UPDATE_FIELDS"; fields: Partial<ProposalFormState> }
  | { type: "ADD_ITEM"; item: QuotationItem; category?: "main" | "additional" }
  | { type: "REMOVE_ITEM"; index: number; category?: "main" | "additional" }
  | { type: "UPDATE_ITEM"; index: number; item: QuotationItem; category?: "main" | "additional" }
  | { type: "ADD_REVIEW"; review: QuotationReview }
  | { type: "REMOVE_REVIEW"; index: number }
  | { type: "ADD_NEXT_STEP"; step: NextStep }
  | { type: "REMOVE_NEXT_STEP"; index: number }
  | { type: "ADD_ATTACHMENT"; url: string }
  | { type: "REMOVE_ATTACHMENT"; index: number }
  | { type: "LOAD_DRAFT"; state: ProposalFormState }
  | { type: "RESET" };

function reducer(state: ProposalFormState, action: Action): ProposalFormState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };

    case "UPDATE_FIELD":
      return { ...state, [action.field]: action.value, isDirty: true };

    case "UPDATE_FIELDS":
      return { ...state, ...action.fields, isDirty: true };

    case "ADD_ITEM": {
      const key = action.category === "additional" ? "additional_items" : "items";
      const itemWithIva = {
        ...action.item,
        iva_percent:
          action.item.iva_percent !== undefined && action.item.iva_percent !== null
            ? action.item.iva_percent
            : 23,
      };
      return { ...state, [key]: [...state[key], itemWithIva], isDirty: true };
    }

    case "REMOVE_ITEM": {
      const key = action.category === "additional" ? "additional_items" : "items";
      return { ...state, [key]: state[key].filter((_, i) => i !== action.index), isDirty: true };
    }

    case "UPDATE_ITEM": {
      const key = action.category === "additional" ? "additional_items" : "items";
      const updated = [...state[key]];
      updated[action.index] = action.item;
      return { ...state, [key]: updated, isDirty: true };
    }

    case "ADD_REVIEW":
      return { ...state, reviews: [...state.reviews, action.review], isDirty: true };

    case "REMOVE_REVIEW":
      return { ...state, reviews: state.reviews.filter((_, i) => i !== action.index), isDirty: true };

    case "ADD_NEXT_STEP":
      return { ...state, next_steps: [...state.next_steps, action.step], isDirty: true };

    case "REMOVE_NEXT_STEP":
      return { ...state, next_steps: state.next_steps.filter((_, i) => i !== action.index), isDirty: true };

    case "ADD_ATTACHMENT":
      return { ...state, attachments: [...state.attachments, action.url], isDirty: true };

    case "REMOVE_ATTACHMENT":
      return { ...state, attachments: state.attachments.filter((_, i) => i !== action.index), isDirty: true };

    case "LOAD_DRAFT":
      return { ...action.state, isDirty: false };

    case "RESET":
      return { ...initialState, newsletter_discount_code: generateDiscountCode() };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ProposalFormContextValue {
  state: ProposalFormState;
  dispatch: React.Dispatch<Action>;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateField: (field: string, value: unknown) => void;
  updateFields: (fields: Partial<ProposalFormState>) => void;
  reset: () => void;
  generateDiscountCode: () => string;
}

const ProposalFormContext = createContext<ProposalFormContextValue | null>(null);

export interface PrefillData {
  contactId?: string | number;
  contactName?: string;
  company?: string;
  email?: string;
  phone?: string;
  products?: Array<{ name: string; price?: number; quantity?: number }>;
  notes?: string;
}

export function ProposalFormProvider({ children, editingId, prefillData, existingData }: { children: React.ReactNode; editingId?: string; prefillData?: PrefillData; existingData?: Partial<ProposalFormState> }) {
  const init = (): ProposalFormState => {
    const base: ProposalFormState = {
      ...initialState,
      editingId,
      newsletter_discount_code: generateDiscountCode(),
    };
    if (prefillData) {
      if (prefillData.contactId) base.customer_id = prefillData.contactId;
      if (prefillData.contactName) base.customer_name = prefillData.contactName;
      if (prefillData.company) base.customer_company = prefillData.company;
      if (prefillData.email) base.customer_email = prefillData.email;
      if (prefillData.phone) {
        base.customer_phone = prefillData.phone;
        base.sent_to_phone = prefillData.phone;
      }
      if (prefillData.notes) base.notes = prefillData.notes;
      if (prefillData.contactId || prefillData.email || prefillData.phone) {
        base.isExistingCustomer = true;
      }
      if (prefillData.products && prefillData.products.length > 0) {
        base.items = prefillData.products.map((p) => ({
          item_type: "product",
          product_name: p.name,
          sku: (p as any).sku || "",
          quantity: p.quantity || 1,
          unit_price: p.price || 0,
          iva_percent: 23,
          line_total: (p.price || 0) * (p.quantity || 1),
        }));
      }
    }
    if (existingData) {
      Object.assign(base, existingData);
      if (prefillData) {
        if (!base.customer_id && prefillData.contactId) base.customer_id = prefillData.contactId;
        if (!base.customer_name && prefillData.contactName) base.customer_name = prefillData.contactName;
        if (!base.customer_company && prefillData.company) base.customer_company = prefillData.company;
        if (!base.customer_email && prefillData.email) base.customer_email = prefillData.email;
        if (!base.customer_phone && prefillData.phone) {
          base.customer_phone = prefillData.phone;
          base.sent_to_phone = prefillData.phone;
        }
      }
    }
    return base;
  };

  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Load existing data when editing a quotation
  useEffect(() => {
    if (existingData && editingId) {
      const merged = { ...initialState, ...existingData, editingId, isDirty: false };
      if (prefillData) {
        if (!merged.customer_id && prefillData.contactId) merged.customer_id = prefillData.contactId;
        if (!merged.customer_name && prefillData.contactName) merged.customer_name = prefillData.contactName;
        if (!merged.customer_company && prefillData.company) merged.customer_company = prefillData.company;
        if (!merged.customer_email && prefillData.email) merged.customer_email = prefillData.email;
        if (!merged.customer_phone && prefillData.phone) {
          merged.customer_phone = prefillData.phone;
          merged.sent_to_phone = prefillData.phone;
        }
        if (!merged.notes && prefillData.notes) merged.notes = prefillData.notes;
        if (prefillData.contactId || prefillData.email || prefillData.phone) {
          merged.isExistingCustomer = true;
        }
        if ((!merged.items || merged.items.length === 0) && prefillData.products && prefillData.products.length > 0) {
          merged.items = prefillData.products.map((p) => ({
            item_type: "product",
            product_name: p.name,
            sku: (p as any).sku || "",
            quantity: p.quantity || 1,
            unit_price: p.price || 0,
            iva_percent: 23,
            line_total: (p.price || 0) * (p.quantity || 1),
          }));
        }
      }
      dispatch({ type: "LOAD_DRAFT", state: merged });
    }
  }, [existingData, editingId, prefillData]);

  // Load draft from localStorage on mount — restore if exists, never auto-delete
  useEffect(() => {
    if (existingData) return; // editing mode uses existingData instead

    const contactKey = prefillData?.contactId ? `${STORAGE_KEY}_contact_${prefillData.contactId}` : null;
    const storageKey = editingId ? `${STORAGE_KEY}_${editingId}` : contactKey || STORAGE_KEY;
    const stored = localStorage.getItem(storageKey) || (!editingId && contactKey ? localStorage.getItem(STORAGE_KEY) : null);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          // If draft belongs to current contact or generic draft, restore it
          const draftContactId = parsed.customer_id;
          if (!prefillData?.contactId || !draftContactId || String(draftContactId) === String(prefillData.contactId)) {
            dispatch({
              type: "LOAD_DRAFT",
              state: {
                ...initialState,
                ...parsed,
                editingId,
                // Ensure prefill contact values are preserved/merged
                ...(prefillData?.contactId ? { customer_id: prefillData.contactId } : {}),
                ...(prefillData?.contactName ? { customer_name: prefillData.contactName } : {}),
                ...(prefillData?.company ? { customer_company: prefillData.company } : {}),
                ...(prefillData?.email ? { customer_email: prefillData.email } : {}),
                ...(prefillData?.phone ? { customer_phone: prefillData.phone, sent_to_phone: prefillData.phone } : {}),
                isExistingCustomer: true,
              },
            });
            return;
          }
        }
      } catch {
        // Dados corruptos — ignorar
      }
    }
  }, [editingId, existingData, prefillData]);

  // Apply prefill data (from email/contact page navigation) if state is fresh
  useEffect(() => {
    if (!prefillData) return;
    const fields: Partial<ProposalFormState> = {};
    if (prefillData.contactId) fields.customer_id = prefillData.contactId;
    if (prefillData.contactName) fields.customer_name = prefillData.contactName;
    if (prefillData.company) fields.customer_company = prefillData.company;
    if (prefillData.email) fields.customer_email = prefillData.email;
    if (prefillData.phone) {
      fields.customer_phone = prefillData.phone;
      fields.sent_to_phone = prefillData.phone;
    }
    if (prefillData.notes) fields.notes = prefillData.notes;
    if (prefillData.contactId || prefillData.email || prefillData.phone) {
      fields.isExistingCustomer = true;
    }
    if (Object.keys(fields).length > 0) {
      dispatch({ type: "UPDATE_FIELDS", fields });
    }
    if (prefillData.products && prefillData.products.length > 0) {
      prefillData.products.forEach((p) => {
        const item: QuotationItem = {
          item_type: "product",
          product_name: p.name,
          sku: (p as any).sku || "",
          quantity: p.quantity || 1,
          unit_price: p.price || 0,
          iva_percent: 23,
          line_total: (p.price || 0) * (p.quantity || 1),
        };
        dispatch({ type: "ADD_ITEM", item });
      });
    }
  }, [prefillData]);

  // Auto-save to localStorage on state change immediately
  useEffect(() => {
    if (!state.isDirty) return;
    const toSave = { ...state, isDirty: false };
    const serialized = JSON.stringify(toSave);

    if (editingId) {
      localStorage.setItem(`${STORAGE_KEY}_${editingId}`, serialized);
    } else {
      localStorage.setItem(STORAGE_KEY, serialized);
      if (state.customer_id) {
        localStorage.setItem(`${STORAGE_KEY}_contact_${state.customer_id}`, serialized);
      }
    }
  }, [state, editingId]);

  const goToStep = useCallback((step: number) => dispatch({ type: "SET_STEP", step }), []);
  const nextStep = useCallback(() => dispatch({ type: "SET_STEP", step: Math.min(state.currentStep + 1, 7) }), [state.currentStep]);
  const prevStep = useCallback(() => dispatch({ type: "SET_STEP", step: Math.max(state.currentStep - 1, 0) }), [state.currentStep]);
  const updateField = useCallback((field: string, value: unknown) => dispatch({ type: "UPDATE_FIELD", field, value }), []);
  const updateFields = useCallback((fields: Partial<ProposalFormState>) => dispatch({ type: "UPDATE_FIELDS", fields }), []);
  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    const storageKey = editingId ? `${STORAGE_KEY}_${editingId}` : STORAGE_KEY;
    localStorage.removeItem(storageKey);
  }, [editingId]);

  return (
    <ProposalFormContext.Provider value={{ state, dispatch, goToStep, nextStep, prevStep, updateField, updateFields, reset, generateDiscountCode }}>
      {children}
    </ProposalFormContext.Provider>
  );
}

export function useProposalForm() {
  const ctx = useContext(ProposalFormContext);
  if (!ctx) throw new Error("useProposalForm deve ser usado dentro de ProposalFormProvider");
  return ctx;
}
