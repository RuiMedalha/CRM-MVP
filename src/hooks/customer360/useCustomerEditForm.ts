/**
 * useCustomerEditForm — hook para edição da ficha de uma Organization.
 * Reutiliza patchContact existente. Não duplica lógica.
 */

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { patchContact } from "@/integrations/directus/contacts";
import { directusRequest } from "@/integrations/directus/client";
import type { Customer360Organization } from "@/types/customer360";

export interface CustomerFormFields {
  // Dados Gerais
  company_name: string;
  nome_comercial: string;
  razao_social: string;
  // Dados Fiscais
  nif: string;
  vat_intracomunitario: string;
  cae: string;
  share_capital: string;
  registo_comercial: string;
  // Contactos
  phone: string;
  mobile_phone: string;
  email: string;
  whatsapp_number: string;
  email_compras: string;
  email_financeiro: string;
  email_comercial: string;
  email_assistencia: string;
  // Web
  website: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  tiktok_url: string;
  youtube_url: string;
  // Moradas
  address: string;
  postal_code: string;
  city: string;
  district: string;
  country: string;
  // Marketing / Newsletter
  accept_newsletter: string;
  email_marketing_permitido: string;
  whatsapp_marketing: string;
  consentimento: string;
  newsletter_consent_source: string;
  newsletter_consent_at: string;
  idioma: string;
  segmento_marketing: string;
  interesses: string;
  newsletter_unsubscribed_at: string;
  // Comercial
  source: string;
  segment: string;
  business_type: string;
  assigned_to: string;
  campanha: string;
  score: string;
  potencial_anual: string;
  // Financeiro
  condicoes_pagamento: string;
  forma_pagamento: string;
  tabela_precos: string;
  desconto_geral: string;
  limite_credito: string;
  iban: string;
  // Fornecedor
  categoria_fornecedor: string;
  representante: string;
  email_encomendas: string;
  email_pos_venda: string;
  moq: string;
  prazo_entrega: string;
  incoterm: string;
  garantia: string;
  // Integrações
  moloni_client_id: string;
  mautic_contact_id: string;
  chatwoot_contact_id: string;
  woo_customer_id: string;
  whatsapp_id: string;
  email_imap: string;
  // Meta
  entity_type: string;
  entity_status: string;
  roles: string;
  // Notas
  notes: string;
  internal_notes: string;
  commercial_notes: string;
  logistics_notes: string;
  tags: string;
  sku_history: string;
  // Moradas JSON
  delivery_addresses: string;
}

const EMPTY_FORM: CustomerFormFields = {
  company_name: "",
  nome_comercial: "",
  razao_social: "",
  nif: "",
  vat_intracomunitario: "",
  cae: "",
  share_capital: "",
  registo_comercial: "",
  phone: "",
  mobile_phone: "",
  email: "",
  whatsapp_number: "",
  email_compras: "",
  email_financeiro: "",
  email_comercial: "",
  email_assistencia: "",
  website: "",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
  tiktok_url: "",
  youtube_url: "",
  address: "",
  postal_code: "",
  city: "",
  district: "",
  country: "",
  accept_newsletter: "",
  email_marketing_permitido: "",
  whatsapp_marketing: "",
  consentimento: "",
  newsletter_consent_source: "",
  newsletter_consent_at: "",
  idioma: "",
  segmento_marketing: "",
  interesses: "",
  newsletter_unsubscribed_at: "",
  source: "",
  segment: "",
  business_type: "",
  assigned_to: "",
  campanha: "",
  score: "",
  potencial_anual: "",
  condicoes_pagamento: "",
  forma_pagamento: "",
  tabela_precos: "",
  desconto_geral: "",
  limite_credito: "",
  iban: "",
  categoria_fornecedor: "",
  representante: "",
  email_encomendas: "",
  email_pos_venda: "",
  moq: "",
  prazo_entrega: "",
  incoterm: "",
  garantia: "",
  moloni_client_id: "",
  mautic_contact_id: "",
  chatwoot_contact_id: "",
  woo_customer_id: "",
  whatsapp_id: "",
  email_imap: "",
  entity_type: "empresa",
  entity_status: "active",
  roles: "[\"cliente\"]",
  notes: "",
  internal_notes: "",
  commercial_notes: "",
  logistics_notes: "",
  tags: "[]",
  sku_history: "[]",
  delivery_addresses: "",
};

interface UseCustomerEditFormResult {
  form: CustomerFormFields;
  isDirty: boolean;
  isSaving: boolean;
  lastError: string | null;
  lastSuccess: boolean;
  handleChange: (field: keyof CustomerFormFields, value: string) => void;
  save: () => Promise<void>;
  reset: () => void;
}

export function useCustomerEditForm(
  organizationId: string | undefined,
  initialData?: Customer360Organization | null,
): UseCustomerEditFormResult {
  const queryClient = useQueryClient();

  // Map Customer360Organization to form fields
  const mapOrgToForm = useCallback((org: Customer360Organization | null | undefined): CustomerFormFields => {
    if (!org) return EMPTY_FORM;
    const raw = org as unknown as Record<string, unknown>;
    const str = (key: string) => String(raw[key] || "") || "";
    return {
      company_name: org.name || "",
      nome_comercial: str("nome_comercial"),
      razao_social: str("razao_social"),
      nif: org.vatNumber || "",
      vat_intracomunitario: org.vat_intracomunitario || "",
      cae: org.cae || "",
      share_capital: org.share_capital || "",
      registo_comercial: str("registo_comercial"),
      phone: org.phone || "",
      mobile_phone: org.mobile_phone || "",
      email: org.email || "",
      whatsapp_number: org.whatsapp_number || "",
      email_compras: org.email_compras || "",
      email_financeiro: org.email_financeiro || "",
      email_comercial: org.email_comercial || "",
      email_assistencia: org.email_assistencia || "",
      website: org.website || "",
      facebook_url: org.facebook_url || "",
      instagram_url: org.instagram_url || "",
      linkedin_url: org.linkedin_url || "",
      tiktok_url: org.tiktok_url || "",
      youtube_url: org.youtube_url || "",
      address: org.address || "",
      postal_code: org.postalCode || "",
      city: org.city || "",
      district: org.district || "",
      country: org.country || "",
      accept_newsletter: str("accept_newsletter"),
      email_marketing_permitido: str("email_marketing_permitido"),
      whatsapp_marketing: str("whatsapp_marketing"),
      consentimento: str("consentimento"),
      newsletter_consent_source: str("newsletter_consent_source"),
      newsletter_consent_at: str("newsletter_consent_at"),
      idioma: str("idioma"),
      segmento_marketing: str("segmento_marketing"),
      interesses: str("interesses"),
      newsletter_unsubscribed_at: str("newsletter_unsubscribed_at"),
      source: org.origin || "",
      segment: org.segment || "",
      business_type: org.businessType || "",
      assigned_to: org.assignedTo || "",
      campanha: org.campanha || "",
      score: String(org.score || ""),
      potencial_anual: String(org.potencial_anual || ""),
      condicoes_pagamento: org.condicoes_pagamento || "",
      forma_pagamento: org.forma_pagamento || "",
      tabela_precos: org.tabela_precos || "",
      desconto_geral: String(org.desconto_geral || ""),
      limite_credito: String(org.limite_credito || ""),
      iban: org.iban || "",
      categoria_fornecedor: org.categoria_fornecedor || "",
      representante: org.representante || "",
      email_encomendas: org.email_encomendas || "",
      email_pos_venda: org.email_pos_venda || "",
      moq: String(org.moq || ""),
      prazo_entrega: org.prazo_entrega || "",
      incoterm: org.incoterm || "",
      garantia: org.garantia || "",
      moloni_client_id: String(org.moloni_client_id || ""),
      mautic_contact_id: String(org.mautic_contact_id || ""),
      chatwoot_contact_id: String(org.chatwoot_contact_id || ""),
      woo_customer_id: str("woo_customer_id") || str("woocommerce_coupon_id"),
      whatsapp_id: org.whatsapp_id || "",
      email_imap: org.email_imap || "",
      entity_type: org.entityType || "empresa",
      entity_status: org.entityStatus || org.status || "active",
      roles: JSON.stringify(org.roles || ["cliente"]),
      notes: org.notes || "",
      internal_notes: org.internal_notes || "",
      commercial_notes: str("commercial_notes"),
      logistics_notes: str("logistics_notes"),
      tags: JSON.stringify(raw.tags || []),
      sku_history: JSON.stringify(raw.sku_history || []),
      delivery_addresses: str("delivery_addresses"),
    };
  }, []);

  const [form, setForm] = useState<CustomerFormFields>(() => mapOrgToForm(initialData));
  const [initialForm, setInitialForm] = useState<CustomerFormFields>(() => mapOrgToForm(initialData));
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState(false);

  // Sync when initialData changes (e.g. after refetch)
  // IMPORTANT: only overwrite form if user has NO unsaved changes (isDirty = false).
  // This prevents a background refetch from wiping edits the user is typing.
  const isDirtyRef = { current: JSON.stringify(form) !== JSON.stringify(initialForm) };
  useEffect(() => {
    if (initialData) {
      const mapped = mapOrgToForm(initialData);
      setInitialForm(mapped);
      if (!isDirtyRef.current) {
        setForm(mapped);
        setLastSuccess(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, mapOrgToForm]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const handleChange = useCallback((field: keyof CustomerFormFields, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setLastSuccess(false);
    setLastError(null);
  }, []);

  const save = useCallback(async () => {
    if (!organizationId) {
      setLastError("ID da organização não definido.");
      return;
    }
    if (!form.company_name.trim()) {
      setLastError("Nome da empresa é obrigatório.");
      return;
    }

    // Build patch (only changed fields)
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(form) as Array<keyof CustomerFormFields>) {
      if (form[key] !== initialForm[key]) {
        // JSON fields: parse string back to array/object for Directus
        if (key === "roles" || key === "tags" || key === "sku_history") {
          try { patch[key] = JSON.parse(form[key]); } catch { patch[key] = key === "roles" ? ["cliente"] : []; }
        } else if (key === "delivery_addresses") {
          try { patch[key] = form[key] ? JSON.parse(form[key]) : null; } catch { patch[key] = null; }
        } else {
          patch[key] = form[key] || null;
        }
      }
    }

    // If assigned_to changed, also set assigned_employee_id (FK) and timestamp
    if (patch.assigned_to && typeof patch.assigned_to === "string") {
      // Try to find the employee UUID by name match (the select stores the name)
      // The actual assigned_employee_id link will be done by the backend if
      // the name matches an employee. For now, record the assignment timestamp.
      patch.assigned_at = new Date().toISOString();
    }

    if (!Object.keys(patch).length) {
      setLastError("Sem alterações para guardar.");
      return;
    }

    setIsSaving(true);
    setLastError(null);
    setLastSuccess(false);

    try {
      await patchContact(organizationId, patch);
      setInitialForm({ ...form });
      setLastSuccess(true);
      // Track the edit as an interaction (non-blocking)
      const changedFields = Object.keys(patch).join(", ");
      directusRequest("/items/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "note",
          direction: "out",
          status: "done",
          contact_id: Number(organizationId),
          summary: `Ficha atualizada (${changedFields})`,
        }),
      }).catch(() => {});
      // Force refetch to update all panels immediately
      await queryClient.refetchQueries({ queryKey: ["customer360", organizationId] });
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Erro ao guardar.");
    } finally {
      setIsSaving(false);
    }
  }, [organizationId, form, initialForm, queryClient]);

  const reset = useCallback(() => {
    setForm(initialForm);
    setLastError(null);
    setLastSuccess(false);
  }, [initialForm]);

  return { form, isDirty, isSaving, lastError, lastSuccess, handleChange, save, reset };
}
