/**
 * CreateContactForm — formulário de criação rápida de contacto/lead.
 * Após criar, navega para /customer360-shell/:id.
 * Suporta prefill via URL params.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import { createContact } from "@/integrations/directus/contacts";
import { patchLead, createLead } from "@/integrations/directus/leads";
import { realtimeClient } from "@/services/realtime/client";
import { SectionCard } from "../ui/SectionCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, CheckCircle2, UserRoundPlus } from "lucide-react";

export interface CreateContactPrefill {
  name?: string;
  company_name?: string;
  contact_person?: string;
  phone?: string;
  mobile_phone?: string;
  email?: string;
  source?: string;
  nif?: string;
  leadId?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  website?: string;
}

export interface CreateContactFormProps {
  prefill?: CreateContactPrefill;
  onSuccess?: (created: { id: string | number; type: "contact" | "lead" }) => void;
  onCancel?: () => void;
  defaultMode?: "contact" | "lead" | "both";
  isDialog?: boolean;
}

export function CreateContactForm({
  prefill,
  onSuccess,
  onCancel,
  defaultMode = "both",
  isDialog = false,
}: CreateContactFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch lead context when leadId is present
  const { data: leadContext } = useQuery({
    queryKey: ["lead-context-form", prefill?.leadId],
    queryFn: async () => {
      const res = await directusRequest<{
        data: {
          contact_name?: string;
          display_name?: string;
          address?: string;
          mobile_phone?: string;
          website?: string;
          lead_data?: Record<string, unknown> | null;
        };
      }>(
        `/items/leads/${prefill!.leadId}?fields=contact_name,display_name,address,mobile_phone,website,lead_data`
      );
      return res?.data ?? null;
    },
    enabled: !!prefill?.leadId,
    staleTime: 5 * 60_000,
  });

  const [form, setForm] = useState({
    company_name: prefill?.company_name || prefill?.name || "",
    contact_person: prefill?.contact_person || "",
    phone: prefill?.phone || "",
    mobile_phone: prefill?.mobile_phone || "",
    email: prefill?.email || "",
    source: prefill?.source || (defaultMode === "lead" ? "manual" : ""),
    nif: prefill?.nif || "",
    website: prefill?.website || "",
    address: prefill?.address || "",
    postal_code: prefill?.postal_code || "",
    city: prefill?.city || "",
    district: "",
    segment: "",
    business_type: "",
    assigned_to: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const canSubmitContact = form.company_name.trim().length > 0 && (form.phone.trim().length > 0 || form.mobile_phone.trim().length > 0 || form.email.trim().length > 0);
  const canSubmitLead = form.company_name.trim().length > 0;

  const handleCreate = async () => {
    if (!form.company_name.trim()) {
      setError("Nome / empresa é obrigatório.");
      return;
    }
    if (!form.phone.trim() && !form.mobile_phone.trim() && !form.email.trim()) {
      setError("Preenche pelo menos telefone, telemóvel ou email.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(form)) {
        const trimmed = value.trim();
        if (trimmed) payload[key] = trimmed;
      }

      const created = await createContact(payload);
      if (!created?.id) {
        setError("Contacto criado mas sem ID retornado.");
        return;
      }

      // Link lead if prefilled from a lead
      if (prefill?.leadId) {
        patchLead(prefill.leadId, { contact_id: String(created.id), status: "processed" }).catch(() => {});
      }

      setSuccess(true);
      realtimeClient.broadcast("contacts", "create", created);
      queryClient.invalidateQueries({ queryKey: ["customer360"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-directus"] });

      if (onSuccess) {
        setTimeout(() => {
          onSuccess({ id: created.id, type: "contact" });
        }, 400);
      } else {
        // Navigate to the created contact in edit mode
        setTimeout(() => {
          navigate(`/customer360-shell/${created.id}`, { replace: true });
        }, 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar contacto.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsLead = async () => {
    if (!form.company_name.trim()) {
      setError("Nome / empresa é obrigatório.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createLead({
        display_name: form.company_name.trim(),
        contact_name: form.contact_person.trim() || form.company_name.trim(),
        contact_phone: form.phone.trim() || form.mobile_phone.trim() || undefined,
        phone: form.phone.trim() || undefined,
        mobile_phone: form.mobile_phone.trim() || undefined,
        email: form.email.trim() || undefined,
        source: form.source.trim() || "manual",
        nif: form.nif.trim() || undefined,
        city: form.city.trim() || undefined,
        postal_code: form.postal_code.trim() || undefined,
        website: form.website.trim() || undefined,
        status: "incoming",
      });
      setSuccess(true);
      realtimeClient.broadcast("leads", "create", created);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-page"] });
      queryClient.invalidateQueries({ queryKey: ["leads-pending-count"] });

      if (onSuccess) {
        setTimeout(() => {
          onSuccess({ id: created?.id || "new", type: "lead" });
        }, 400);
      } else {
        setTimeout(() => navigate("/leads", { replace: true }), 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar lead.");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[220px] p-4">
        <div className="text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <p className="text-sm font-medium text-foreground">
            {defaultMode === "lead" ? "Lead registada com sucesso!" : "Registo criado com sucesso!"}
          </p>
          <p className="text-xs text-muted-foreground">A atualizar dados...</p>
        </div>
      </div>
    );
  }

  const formContent = (
    <div className="space-y-3">
      {/* Painel de contexto da lead — read-only */}
      {leadContext?.lead_data && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contexto da lead
          </p>

          {/* Pessoa vs Empresa */}
          {(leadContext.lead_data.contact_name || leadContext.display_name || leadContext.lead_data.company_name) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {leadContext.lead_data.contact_name && (
                <span><strong>Pessoa:</strong> {String(leadContext.lead_data.contact_name)}</span>
              )}
              {(leadContext.display_name || leadContext.lead_data.company_name) && (
                <span><strong>Empresa:</strong> {String(leadContext.display_name || leadContext.lead_data.company_name)}</span>
              )}
            </div>
          )}

          {/* Produtos pedidos */}
          {leadContext.lead_data.requested_items && (
            <div className="text-xs">
              <span className="font-medium text-foreground">Produtos pedidos:</span>{" "}
              <span className="text-muted-foreground">{String(leadContext.lead_data.requested_items)}</span>
            </div>
          )}

          {/* Tipo + papel */}
          {(leadContext.lead_data.request_type || leadContext.lead_data.contact_role) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {leadContext.lead_data.request_type && (
                <span>Tipo: <strong className="text-foreground">{String(leadContext.lead_data.request_type)}</strong></span>
              )}
              {leadContext.lead_data.contact_role && (
                <span>Papel: <strong className="text-foreground">
                  {leadContext.lead_data.contact_role === "cliente" ? "Cliente" :
                   leadContext.lead_data.contact_role === "fornecedor" ? "Fornecedor" : "Parceiro"}
                </strong></span>
              )}
            </div>
          )}

          {/* Morada + telemóvel + website */}
          {(leadContext.address || leadContext.mobile_phone || leadContext.website) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {leadContext.address && <span>📍 {leadContext.address}</span>}
              {leadContext.mobile_phone && <span>📱 {leadContext.mobile_phone}</span>}
              {leadContext.website && <span>🌐 {leadContext.website}</span>}
            </div>
          )}
        </div>
      )}

      {/* Required fields */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Nome / Empresa *</Label>
          <Input
            value={form.company_name}
            onChange={(e) => handleChange("company_name", e.target.value)}
            placeholder="Nome da empresa ou pessoa"
            className="h-10 text-sm md:h-8"
            autoFocus
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Pessoa de contacto</Label>
          <Input
            value={form.contact_person}
            onChange={(e) => handleChange("contact_person", e.target.value)}
            placeholder="Nome da pessoa"
            className="h-10 text-sm md:h-8"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Telefone {defaultMode === "contact" ? "*" : ""}</Label>
          <Input
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="Fixo"
            className="h-10 text-sm md:h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Telemóvel</Label>
          <Input
            value={form.mobile_phone}
            onChange={(e) => handleChange("mobile_phone", e.target.value)}
            placeholder="9xx..."
            className="h-10 text-sm md:h-8"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Email {defaultMode === "contact" ? "*" : ""}</Label>
        <Input
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="email@empresa.pt"
          type="email"
          className="h-10 text-sm md:h-8"
        />
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        {defaultMode === "lead"
          ? "* Obrigatório: Nome / Empresa"
          : "* Obrigatório: nome + (telefone, telemóvel ou email)"}
      </p>

      {/* Optional fields */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Origem</Label>
          <Input
            value={form.source}
            onChange={(e) => handleChange("source", e.target.value)}
            placeholder="Ex: chamada, feira, site, manual"
            className="h-10 text-sm md:h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">NIF</Label>
          <Input
            value={form.nif}
            onChange={(e) => handleChange("nif", e.target.value)}
            placeholder="123456789"
            className="h-10 text-sm md:h-8"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Website</Label>
          <Input
            value={form.website}
            onChange={(e) => handleChange("website", e.target.value)}
            placeholder="www.empresa.pt"
            className="h-10 text-sm md:h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Responsável</Label>
          <Input
            value={form.assigned_to}
            onChange={(e) => handleChange("assigned_to", e.target.value)}
            placeholder="Nome do comercial"
            className="h-10 text-sm md:h-8"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label className="text-xs text-muted-foreground">Cidade</Label>
          <Input
            value={form.city}
            onChange={(e) => handleChange("city", e.target.value)}
            className="h-10 text-sm md:h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Distrito</Label>
          <Input
            value={form.district}
            onChange={(e) => handleChange("district", e.target.value)}
            className="h-10 text-sm md:h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Cód. Postal</Label>
          <Input
            value={form.postal_code}
            onChange={(e) => handleChange("postal_code", e.target.value)}
            placeholder="0000-000"
            className="h-10 text-sm md:h-8"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Segmento</Label>
          <Input
            value={form.segment}
            onChange={(e) => handleChange("segment", e.target.value)}
            placeholder="Ex: Hotelaria"
            className="h-10 text-sm md:h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Tipo de negócio</Label>
          <Input
            value={form.business_type}
            onChange={(e) => handleChange("business_type", e.target.value)}
            placeholder="Ex: Hotel, Restaurante"
            className="h-10 text-sm md:h-8"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        {defaultMode === "lead" ? (
          <>
            <Button
              onClick={handleSaveAsLead}
              disabled={saving || !canSubmitLead}
              className="flex-1 h-9 gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
              {saving ? "A criar Lead..." : "Criar Lead"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCreate}
              disabled={saving || !canSubmitContact}
              className="h-9 gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Criar como Contacto
            </Button>
            {onCancel && (
              <Button
                variant="ghost"
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="h-9"
              >
                Cancelar
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={handleCreate}
              disabled={saving || !canSubmitContact}
              className="flex-1 h-9 gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {saving ? "A criar..." : "Criar contacto"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAsLead}
              disabled={saving || !canSubmitLead}
              className="h-9 gap-2"
            >
              <UserRoundPlus className="h-4 w-4" />
              Guardar como Lead
            </Button>
            {onCancel && (
              <Button
                variant="ghost"
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="h-9"
              >
                Cancelar
              </Button>
            )}
          </>
        )}
      </div>

      {defaultMode !== "lead" && !canSubmitContact && form.company_name.trim() && (
        <p className="text-xs text-amber-600 text-center">
          Preenche telefone ou email para activar o botão "Criar contacto".
        </p>
      )}
    </div>
  );

  if (isDialog) {
    return <div className="w-full">{formContent}</div>;
  }

  return (
    <div
      className="flex items-stretch justify-center p-2 sm:p-4"
      style={{ maxHeight: "calc(100dvh - var(--topbar-h, 0px))" }}
    >
      <div className="w-full max-w-lg overflow-y-auto">
        <SectionCard title="Criar novo contacto">
          {formContent}
        </SectionCard>
      </div>
    </div>
  );
}
