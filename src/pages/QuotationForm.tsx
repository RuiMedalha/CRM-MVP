import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProposalFormProvider, useProposalForm } from "@/contexts/ProposalFormContext";
import { ProposalStepper } from "@/components/proposals/ProposalStepper";
import { StepClient } from "@/components/proposals/steps/StepClient";
import { StepContent } from "@/components/proposals/steps/StepContent";
import { StepMedia } from "@/components/proposals/steps/StepMedia";
import { StepServices } from "@/components/proposals/steps/StepServices";
import { StepSettings } from "@/components/proposals/steps/StepSettings";
import { StepPersuasion } from "@/components/proposals/steps/StepPersuasion";
import { StepPreview } from "@/components/proposals/steps/StepPreview";
import { StepSend } from "@/components/proposals/steps/StepSend";
import { Button } from "@/components/ui/button";
import { Save, SendHorizontal, Loader2 } from "lucide-react";
import { getQuotationById, createQuotation, patchQuotation, createQuotationItems, generateQuotationNumber } from "@/integrations/directus/quotations";
import { toast } from "@/hooks/use-toast";
import type { ProposalFormState } from "@/contexts/ProposalFormContext";
import type { QuotationItem } from "@/types/quotation";

export interface QuotationFormPrefill {
  contactId?: string | number;
  contactName?: string;
  company?: string;
  email?: string;
  phone?: string;
  products?: Array<{ name: string; price?: number; quantity?: number }>;
  notes?: string;
}

function FormContent() {
  const { state, goToStep, nextStep, prevStep, updateField } = useProposalForm();
  const { currentStep } = state;
  const navigate = useNavigate();
  const [draftSaving, setDraftSaving] = useState(false);
  const didCreateDraft = useRef(false);

  // Point 1: create draft ID immediately for new proposals
  useEffect(() => {
    if (state.editingId || didCreateDraft.current) return;
    didCreateDraft.current = true;
    createQuotation({
      status: "draft",
      document_type: "proposal",
      quotation_number: generateQuotationNumber("proposal"),
    } as any).then((created) => {
      if (created?.id) {
        updateField("editingId", created.id);
        navigate(`/propostas/${created.id}`, { replace: true });
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Coerce empty/whitespace/"null" strings to null — Directus rejects "" on constrained text fields. */
  const s = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
      return trimmed;
    }
    return String(v);
  };

  /** Sanitize payload values before sending to Directus. */
  const cleanPayload = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === 'null' || value === 'undefined' || value === '') {
        result[key] = null;
      } else if (typeof value === 'number' && isNaN(value)) {
        result[key] = null;
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  // Build payload from current state
  const buildDraftPayload = useCallback(() => {
    const total = state.items.reduce((sum, i) => sum + (i.line_total || 0), 0);
    return cleanPayload({
      document_type: "proposal",
      status: "draft",
      customer_id: state.customer_id || undefined,
      customer_name: s(state.customer_name),
      customer_company: s(state.customer_company),
      treatment: s(state.treatment),
      language: s(state.language),
      customer_timezone: s(state.customer_timezone),
      welcome_message: s(state.welcome_message),
      proposal_description: s(state.proposal_description),
      comparison_recommendation_text: s(state.comparison_recommendation_text),
      voice_message_url: s(state.voice_message_url),
      video_url: s(state.video_url),
      next_steps: state.next_steps.length > 0 ? state.next_steps : null,
      subtotal: total,
      total_amount: total,
      deposit_type: state.deposit_type,
      deposit_percent: state.deposit_percent || 0,
      urgency_discount_pct: state.urgency_discount_pct || null,
      urgency_hours: state.urgency_hours || null,
      valid_until: s(state.valid_until),
      theme: s(state.theme),
      phone_gate_enabled: state.phone_gate_enabled,
      notes: s(state.notes),
      terms_conditions: s(state.terms_conditions),
      internal_notes: s(state.internal_notes),
      sent_to_email: s(state.customer_email),
      sent_to_phone: s(state.sent_to_phone) || s(state.customer_phone),
      newsletter_discount_enabled: state.newsletter_discount_enabled || false,
      newsletter_discount_percent: state.newsletter_discount_enabled ? state.newsletter_discount_percent : null,
      newsletter_discount_code: state.newsletter_discount_enabled ? s(state.newsletter_discount_code) : null,
      show_terms: state.show_terms ?? false,
    });
  }, [state]);

  // Save draft (manual button only) — creates new or patches existing
  const handleSaveDraft = async () => {
    setDraftSaving(true);
    try {
      if (state.editingId) {
        await patchQuotation(state.editingId, buildDraftPayload() as any);
        toast({ title: "Rascunho guardado ✓" });
      } else {
        // Create new quotation as draft
        const created = await createQuotation(buildDraftPayload() as any);
        if (!created?.id) throw new Error("Falha ao criar rascunho");
        // Save items
        const allItems = [...state.items, ...state.additional_items].map((item, idx) => ({
          quotation_id: created.id,
          item_type: item.item_type || "product",
          product_id: item.product_id || null,
          product_name: item.product_name,
          sku: item.sku || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          line_total: item.line_total,
          image_url: item.image_url || null,
          ai_description: item.ai_description || null,
          sort_order: idx,
        }));
        if (allItems.length > 0) {
          await createQuotationItems(allItems);
        }
        // Update context with new ID
        updateField("editingId", created.id);
        // Navigate to edit URL without reload
        navigate(`/propostas/${created.id}`, { replace: true });
        toast({ title: "Rascunho guardado ✓", description: `Ref: ${created.quotation_number}` });
      }
    } catch (err) {
      toast({ title: "Erro ao guardar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setDraftSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepClient />;
      case 1:
        return <StepContent />;
      case 2:
        return <StepMedia />;
      case 3:
        return <StepServices />;
      case 4:
        return <StepSettings />;
      case 5:
        return <StepPersuasion />;
      case 6:
        return <StepPreview />;
      case 7:
        return <StepSend />;
      default:
        return <StepClient />;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto w-full">
      {/* Header with actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-semibold">
            {state.editingId ? "Editar Proposta" : "Nova Proposta"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={draftSaving}>
            {draftSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Guardar rascunho
          </Button>
          <Button size="sm" onClick={async () => { await handleSaveDraft(); goToStep(7); }} disabled={draftSaving}>
            <SendHorizontal className="h-4 w-4 mr-1.5" />
            Guardar e enviar
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <ProposalStepper currentStep={currentStep} onStepClick={goToStep} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {renderStep()}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 0}
        >
          Voltar
        </Button>
        {currentStep < 7 && (
          <Button onClick={nextStep}>
            Próximo
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Convert Directus quotation data to ProposalFormState prefill.
 */
function mapQuotationToFormState(quotation: any, items: any[]): Partial<ProposalFormState> {
  const mainItems: QuotationItem[] = [];
  const additionalItems: QuotationItem[] = [];

  for (const item of items) {
    const mapped: QuotationItem = {
      item_type: item.item_type || (item.product_name?.toLowerCase().includes("serviço") ? "service" : "product"),
      product_id: item.product_id || undefined,
      product_name: item.product_name || "",
      sku: item.sku || undefined,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unit_price) || 0,
      discount_percent: Number(item.discount_percent) || 0,
      line_total: Number(item.line_total) || 0,
      image_url: item.image_url || undefined,
      images: item.images || undefined,
      product_url: item.product_url || item.ficha_tecnica_url || undefined,
      datasheet_url: item.datasheet_url || item.ficha_tecnica_url || undefined,
      datasheet_label: item.datasheet_label || undefined,
      ai_description: item.ai_description || undefined,
      comparison_group: item.comparison_group || undefined,
      is_recommended: item.is_recommended || false,
      comparison_specs: item.comparison_specs || undefined,
      notes: item.notes || undefined,
      sort_order: item.sort_order,
    };
    if (mapped.item_type === "additional" || mapped.item_type === "service") {
      additionalItems.push(mapped);
    } else {
      mainItems.push(mapped);
    }
  }

  // Resolve customer from nested or flat fields
  const customer = quotation.customer_id;
  const customerName = typeof customer === "object" && customer
    ? customer.contact_person || customer.contact_name || customer.company_name || ""
    : quotation.customer_name || "";
  const customerCompany = typeof customer === "object" && customer
    ? customer.company_name || ""
    : quotation.customer_company || "";
  const customerEmail = typeof customer === "object" && customer
    ? customer.email || ""
    : quotation.sent_to_email || "";
  const customerPhone = typeof customer === "object" && customer
    ? customer.phone || ""
    : quotation.sent_to_phone || "";

  return {
    customer_id: typeof customer === "object" && customer ? customer.id : quotation.customer_id,
    customer_name: customerName,
    customer_company: customerCompany,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    sent_to_phone: quotation.sent_to_phone || customerPhone,
    treatment: quotation.treatment || undefined,
    language: quotation.language || "pt",
    customer_timezone: quotation.customer_timezone || "Europe/Lisbon",
    isExistingCustomer: !!quotation.customer_id,
    // Content
    proposal_description: quotation.proposal_description || "",
    comparison_recommendation_text: quotation.comparison_recommendation_text || "",
    welcome_message: quotation.welcome_message || "",
    voice_message_url: quotation.voice_message_url || "",
    video_url: quotation.video_url || "",
    next_steps: quotation.next_steps || [],
    attachments: quotation.attachments || [],
    reviews: quotation.reviews || [],
    // Items
    items: mainItems,
    additional_items: additionalItems,
    // Settings
    valid_until: quotation.valid_until || "",
    phone_gate_enabled: quotation.phone_gate_enabled ?? true,
    deposit_type: quotation.deposit_type || "partial",
    deposit_percent: Number(quotation.deposit_percent) || 50,
    urgency_discount_pct: Number(quotation.urgency_discount_pct) || undefined,
    urgency_hours: Number(quotation.urgency_hours) || undefined,
    theme: quotation.theme || "system",
    terms_conditions: quotation.terms_conditions || "",
    show_terms: !!quotation.terms_conditions,
    newsletter_discount_enabled: !!quotation.newsletter_discount_enabled,
    newsletter_discount_percent: Number(quotation.newsletter_discount_percent) || 5,
    newsletter_discount_code: quotation.newsletter_discount_code || "",
    // Send
    notes: quotation.notes || "",
    internal_notes: quotation.internal_notes || "",
  };
}

export default function QuotationForm() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const statePrefill = (location.state as { prefill?: QuotationFormPrefill } | null)?.prefill;
  const queryPrefill: QuotationFormPrefill | undefined =
    searchParams.has("customer_id") ||
    searchParams.has("contactId") ||
    searchParams.has("name") ||
    searchParams.has("contactName") ||
    searchParams.has("phone") ||
    searchParams.has("email")
      ? {
          contactId: searchParams.get("customer_id") || searchParams.get("contactId") || undefined,
          contactName: searchParams.get("name") || searchParams.get("contactName") || undefined,
          company: searchParams.get("company") || searchParams.get("company_name") || undefined,
          email: searchParams.get("email") || undefined,
          phone: searchParams.get("phone") || undefined,
          notes: searchParams.get("notes") || undefined,
        }
      : undefined;

  const prefillData = statePrefill || queryPrefill;
  const isNewProposal = location.pathname.includes("/nova");
  const isEditing = !!id && !isNewProposal;

  // Load existing quotation when editing
  const { data: existingData, isLoading } = useQuery({
    queryKey: ["quotation-edit", id],
    queryFn: async () => {
      if (!id) return null;
      const result = await getQuotationById(id);
      if (!result.quotation) return null;
      return mapQuotationToFormState(result.quotation, result.items);
    },
    enabled: isEditing,
  });

  if (isEditing && isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ProposalFormProvider
        editingId={isEditing ? id : undefined}
        prefillData={prefillData}
        existingData={isEditing ? existingData || undefined : undefined}
      >
        <FormContent />
      </ProposalFormProvider>
    </AppLayout>
  );
}
