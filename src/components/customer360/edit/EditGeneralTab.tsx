/**
 * EditGeneralTab — Ficha Mestre da Entidade (completa).
 * 14 secções visíveis. Campos existentes editáveis. Campos futuros como info.
 */

import { useMemo, useState, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerEditForm, type CustomerFormFields } from "@/hooks/customer360/useCustomerEditForm";
import { EntitySection } from "./EntitySection";
import { useEntityFormConfig } from "@/hooks/useEntityFormConfig";
import { EntityClassification, type EntityType, type EntityRole } from "./EntityClassification";
import { SaveBar } from "./SaveBar";
import { validateField } from "./FieldValidation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { patchContact } from "@/integrations/directus/contacts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Customer360Organization } from "@/types/customer360";

interface EditGeneralTabProps {
  organizationId: string | undefined;
  organization: Customer360Organization | null;

}

// ─── FormField with validation ────────────────────────────────────────────

function FormField({ fieldKey, label, value, onChange, type = "text", placeholder, colSpan }: {
  fieldKey: string; label: string; value: string;
  onChange: (v: string) => void; type?: string; placeholder?: string; colSpan?: boolean;
}) {
  const error = useMemo(() => validateField(fieldKey, value), [fieldKey, value]);
  // <input type="date"> requires "yyyy-MM-dd"; Directus returns full ISO timestamps
  const displayValue = type === "date" && value?.includes("T") ? value.slice(0, 10) : value;
  return (
    <div className={cn(colSpan && "md:col-span-2")}>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Input value={displayValue} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} className={cn("h-8 text-sm", error && "border-red-300")} />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}


/**
 * Dropdown real, ligado às opções editáveis em Definições → Ficha de Cliente
 * → Dropdowns (coleção field_options). Se não houver opções para este
 * fieldKey ainda, cai para uma caixa de texto simples (nunca bloqueia).
 */
function FormSelect({
  fieldKey, label, value, onChange, options, placeholder, colSpan,
}: {
  fieldKey: string; label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; colSpan?: boolean;
}) {
  if (options.length === 0) {
    // Fallback seguro: sem opções configuradas, comporta-se como campo de texto.
    return (
      <FormField fieldKey={fieldKey} label={label} value={value} onChange={onChange} placeholder={placeholder} colSpan={colSpan} />
    );
  }
  return (
    <div className={cn(colSpan && "md:col-span-2")}>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={placeholder || "Escolher…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionNote({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground/50 mt-2 italic">{text}</p>;
}

/** Wrapper: só renderiza o bloco se estiver visível na configuração para este tipo de cliente. */
function ConfigSection({ title, children, formConfig }: {
  title: string;
  children: ReactNode;
  formConfig: ReturnType<typeof useEntityFormConfig>;
}) {
  if (!formConfig.isBlockVisible(title)) return null;
  const required = formConfig.isBlockRequired(title);
  return <EntitySection title={required ? `${title} *` : title}>{children}</EntitySection>;
}

// ─── Main ─────────────────────────────────────────────────────────────────

export function EditGeneralTab({ organizationId, organization }: EditGeneralTabProps) {
  const { form, isDirty, isSaving, lastError, lastSuccess, handleChange, save, reset } =
    useCustomerEditForm(organizationId, organization);

  // Employees for assignment
  const { data: employees } = useEmployees();
  const { user } = useAuth();
  const activeEmployees = (employees || []).filter((e) => e.is_active);

  // Classification from persisted fields
  const entityType = (form.entity_type || "empresa") as EntityType;
  const roles: EntityRole[] = (() => {
    try { return JSON.parse(form.roles || "[\"cliente\"]"); } catch { return ["cliente"]; }
  })();
  const setEntityType = (t: EntityType) => handleChange("entity_type", t);
  const setRoles = (r: EntityRole[]) => handleChange("roles", JSON.stringify(r));

  const isEmpresa = entityType !== "particular";
  const isFornecedor = roles.includes("fornecedor");

  // Configuração da Ficha (guiada por dados). Sem config => mostra tudo (fallback seguro).
  const formConfig = useEntityFormConfig(entityType, roles);

  // Morada de Entrega (delivery_addresses JSON)
  interface DeliveryAddress {
    same_as_billing: boolean;
    address: string;
    postal_code: string;
    city: string;
    district: string;
    contact_name: string;
    phone: string;
    notes: string;
  }
  const initDelivery = useCallback((): DeliveryAddress => {
    try {
      const raw = (organization as unknown as Record<string, unknown> | null)?.delivery_addresses;
      if (Array.isArray(raw) && raw[0]) return { same_as_billing: false, address: "", postal_code: "", city: "", district: "", contact_name: "", phone: "", notes: "", ...raw[0] };
      if (raw && typeof raw === "object") return { same_as_billing: false, address: "", postal_code: "", city: "", district: "", contact_name: "", phone: "", notes: "", ...(raw as object) };
    } catch { /* fallback */ }
    return { same_as_billing: true, address: "", postal_code: "", city: "", district: "", contact_name: "", phone: "", notes: "" };
  }, [organization]);
  const [deliveryAddr, setDeliveryAddr] = useState<DeliveryAddress>(initDelivery);
  const deliverySameAsBilling = deliveryAddr.same_as_billing;

  const handleDeliverySameToggle = useCallback((checked: boolean) => {
    setDeliveryAddr((prev) => ({ ...prev, same_as_billing: checked }));
    // Persist immediately via delivery_addresses JSON
    const payload = checked
      ? JSON.stringify({ same_as_billing: true })
      : JSON.stringify({ same_as_billing: false, address: deliveryAddr.address, postal_code: deliveryAddr.postal_code, city: deliveryAddr.city, district: deliveryAddr.district, contact_name: deliveryAddr.contact_name, phone: deliveryAddr.phone, notes: deliveryAddr.notes });
    handleChange("delivery_addresses" as keyof CustomerFormFields, payload);
  }, [deliveryAddr, handleChange]);

  const handleDeliveryChange = useCallback((field: string, value: string) => {
    setDeliveryAddr((prev) => {
      const next = { ...prev, [field]: value };
      // Sync to form so it gets saved with the main form
      handleChange("delivery_addresses" as keyof CustomerFormFields, JSON.stringify(next));
      return next;
    });
  }, [handleChange]);

  const navigate = useNavigate();
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = useCallback(async () => {
    if (!organizationId) return;
    setIsArchiving(true);
    try {
      await patchContact(organizationId, { entity_status: "archived" });
      navigate("/contactos");
    } catch (err) {
      setIsArchiving(false);
    }
  }, [organizationId, navigate]);

  if (!organizationId) {
    return <EntitySection title="Ficha Mestre"><div className="py-8 text-center text-sm text-muted-foreground">Selecciona uma organização.</div></EntitySection>;
  }

  return (
    <div className="space-y-3">
      {/* Save bar + Archive */}
      <div className="flex items-center justify-between">
        <SaveBar isDirty={isDirty} isSaving={isSaving} lastError={lastError} lastSuccess={lastSuccess} onSave={save} onCancel={reset} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs">
              Arquivar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Arquivar contacto?</AlertDialogTitle>
              <AlertDialogDescription>
                O contacto será marcado como arquivado e deixará de aparecer na listagem principal. Pode ser reactivado a qualquer momento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchive} disabled={isArchiving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isArchiving ? "A arquivar..." : "Sim, arquivar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* 1. Classificação */}
      <EntityClassification entityType={entityType} roles={roles} onTypeChange={setEntityType} onRolesChange={setRoles} />

      {/* 2. Dados Gerais */}
      <ConfigSection formConfig={formConfig} title="Dados Gerais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {formConfig.orderedFields("Dados Gerais", ["company_name", "website", "source"]).map((key) => {
            if (key === "company_name") return <FormField key={key} fieldKey="company_name" label={isEmpresa ? "Nome da Empresa" : "Nome Completo"} value={form.company_name} onChange={(v) => handleChange("company_name", v)} placeholder="Nome" colSpan />;
            if (key === "website") return <FormField key={key} fieldKey="website" label="Website" value={form.website} onChange={(v) => handleChange("website", v)} placeholder="www.empresa.pt" />;
            if (key === "source") return <FormField key={key} fieldKey="source" label="Origem" value={form.source} onChange={(v) => handleChange("source", v)} placeholder="Ex: feira, indicação" />;
            return null;
          })}
          <FormField fieldKey="nome_comercial" label="Nome Comercial" value={form.nome_comercial} onChange={(v) => handleChange("nome_comercial", v)} placeholder="Nome comercial" />
          <FormField fieldKey="razao_social" label="Razão Social" value={form.razao_social} onChange={(v) => handleChange("razao_social", v)} placeholder="Razão social" />
        </div>
      </ConfigSection>

      {/* 3. Dados Fiscais */}
      <ConfigSection formConfig={formConfig} title="Dados Fiscais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {formConfig.orderedFields("Dados Fiscais", ["nif"]).map((key) =>
            key === "nif" ? <FormField key={key} fieldKey="nif" label="NIF" value={form.nif} onChange={(v) => handleChange("nif", v)} placeholder="123456789" /> : null
          )}
          {isEmpresa && <>
            <FormField fieldKey="vat_intracomunitario" label="NIF Intracomunitário" value={form.vat_intracomunitario} onChange={(v) => handleChange("vat_intracomunitario", v)} placeholder="PTxxxxxxxxx" />
            <FormField fieldKey="cae" label="CAE" value={form.cae} onChange={(v) => handleChange("cae", v)} placeholder="Ex: 55111" />
            <FormField fieldKey="share_capital" label="Capital Social" value={form.share_capital} onChange={(v) => handleChange("share_capital", v)} placeholder="Ex: 50000" />
            <FormField fieldKey="registo_comercial" label="Registo Comercial" value={form.registo_comercial} onChange={(v) => handleChange("registo_comercial", v)} placeholder="Nº registo" />
          </>}
        </div>
      </ConfigSection>

      {/* 4. Contactos da Entidade */}
      <ConfigSection formConfig={formConfig} title="Contactos da Entidade">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {formConfig.orderedFields("Contactos da Entidade", ["phone", "email"]).map((key) => {
            if (key === "phone") return <FormField key={key} fieldKey="phone" label="Telefone" value={form.phone} onChange={(v) => handleChange("phone", v)} placeholder="+351..." />;
            if (key === "email") return <FormField key={key} fieldKey="email" label="Email Geral" value={form.email} onChange={(v) => handleChange("email", v)} type="email" placeholder="email@empresa.pt" />;
            return null;
          })}
          <FormField fieldKey="mobile_phone" label="Telemóvel" value={form.mobile_phone} onChange={(v) => handleChange("mobile_phone", v)} placeholder="+351 9xx xxx xxx" />
          <div>
            <FormField fieldKey="whatsapp_number" label="WhatsApp" value={form.whatsapp_number} onChange={(v) => handleChange("whatsapp_number", v)} placeholder="+351 9xx xxx xxx" />
            {form.mobile_phone && form.mobile_phone !== form.whatsapp_number && (
              <button type="button" onClick={() => handleChange("whatsapp_number", form.mobile_phone)} className="mt-1 text-xs text-primary hover:underline">
                Usar mesmo nº do telemóvel
              </button>
            )}
          </div>
          <FormField fieldKey="email_compras" label="Email Compras" value={form.email_compras} onChange={(v) => handleChange("email_compras", v)} type="email" placeholder="compras@empresa.pt" />
          <FormField fieldKey="email_financeiro" label="Email Financeiro" value={form.email_financeiro} onChange={(v) => handleChange("email_financeiro", v)} type="email" placeholder="financeiro@empresa.pt" />
          <FormField fieldKey="email_comercial" label="Email Comercial" value={form.email_comercial} onChange={(v) => handleChange("email_comercial", v)} type="email" placeholder="comercial@empresa.pt" />
          <FormField fieldKey="email_assistencia" label="Email Assistência" value={form.email_assistencia} onChange={(v) => handleChange("email_assistencia", v)} type="email" placeholder="assistencia@empresa.pt" />
        </div>
      </ConfigSection>

      {/* 5. Moradas */}
      <ConfigSection formConfig={formConfig} title="Moradas">
        <p className="text-xs font-medium text-muted-foreground mb-2">Morada de Facturação</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {formConfig.orderedFields("Moradas", ["address", "postal_code", "city", "district"]).map((key) => {
            if (key === "address") return <FormField key={key} fieldKey="address" label="Morada" value={form.address} onChange={(v) => handleChange("address", v)} placeholder="Rua, nº..." colSpan />;
            if (key === "postal_code") return <FormField key={key} fieldKey="postal_code" label="Código Postal" value={form.postal_code} onChange={(v) => handleChange("postal_code", v)} placeholder="0000-000" />;
            if (key === "city") return <FormField key={key} fieldKey="city" label="Cidade" value={form.city} onChange={(v) => handleChange("city", v)} />;
            if (key === "district") return (
              <FormSelect key={key} fieldKey="district" label="Distrito" value={form.district} onChange={(v) => handleChange("district", v)}
                options={formConfig.options("district").map((o) => ({ value: o.value, label: o.label }))} placeholder="Selecionar distrito" />
            );
            return null;
          })}
          <FormSelect fieldKey="country" label="País" value={form.country} onChange={(v) => handleChange("country", v)}
            options={formConfig.options("country").map((o) => ({ value: o.value, label: o.label }))} placeholder="Selecionar país" />
        </div>

        <div className="mt-4 border-t border-border/50 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Morada de Entrega</p>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={deliverySameAsBilling} onChange={(e) => handleDeliverySameToggle(e.target.checked)} className="rounded border-border" />
              <span className="text-xs text-muted-foreground">Mesma que a facturação</span>
            </label>
          </div>
          {!deliverySameAsBilling && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField fieldKey="delivery_address" label="Morada" value={deliveryAddr.address} onChange={(v) => handleDeliveryChange("address", v)} placeholder="Rua, nº..." colSpan />
              <FormField fieldKey="delivery_postal_code" label="Código Postal" value={deliveryAddr.postal_code} onChange={(v) => handleDeliveryChange("postal_code", v)} placeholder="0000-000" />
              <FormField fieldKey="delivery_city" label="Cidade" value={deliveryAddr.city} onChange={(v) => handleDeliveryChange("city", v)} />
              <FormSelect fieldKey="delivery_district" label="Distrito" value={deliveryAddr.district} onChange={(v) => handleDeliveryChange("district", v)}
                options={formConfig.options("district").map((o) => ({ value: o.value, label: o.label }))} placeholder="Selecionar distrito" />
              <FormField fieldKey="delivery_contact_name" label="Responsável Entrega" value={deliveryAddr.contact_name} onChange={(v) => handleDeliveryChange("contact_name", v)} placeholder="Nome do responsável" />
              <FormField fieldKey="delivery_phone" label="Telefone Entrega" value={deliveryAddr.phone} onChange={(v) => handleDeliveryChange("phone", v)} placeholder="+351..." />
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Notas de entrega</Label>
                <textarea rows={2} value={deliveryAddr.notes} onChange={(e) => handleDeliveryChange("notes", e.target.value)} placeholder="Instruções especiais de entrega..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          )}
        </div>
      </ConfigSection>

      {/* 6. Redes Sociais */}
      <ConfigSection formConfig={formConfig} title="Redes Sociais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField fieldKey="website" label="Website" value={form.website} onChange={(v) => handleChange("website", v)} placeholder="www.empresa.pt" />
          <FormField fieldKey="facebook_url" label="Facebook" value={form.facebook_url} onChange={(v) => handleChange("facebook_url", v)} placeholder="https://facebook.com/..." />
          <FormField fieldKey="instagram_url" label="Instagram" value={form.instagram_url} onChange={(v) => handleChange("instagram_url", v)} placeholder="https://instagram.com/..." />
          <FormField fieldKey="linkedin_url" label="LinkedIn" value={form.linkedin_url} onChange={(v) => handleChange("linkedin_url", v)} placeholder="https://linkedin.com/company/..." />
          <FormField fieldKey="tiktok_url" label="TikTok" value={form.tiktok_url} onChange={(v) => handleChange("tiktok_url", v)} placeholder="https://tiktok.com/@..." />
          <FormField fieldKey="youtube_url" label="YouTube" value={form.youtube_url} onChange={(v) => handleChange("youtube_url", v)} placeholder="https://youtube.com/c/..." />
        </div>
      </ConfigSection>

      {/* 7. Marketing / Newsletter */}
      <ConfigSection formConfig={formConfig} title="Marketing / Newsletter">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormSelect fieldKey="accept_newsletter" label="Aceita Newsletter" value={form.accept_newsletter} onChange={(v) => handleChange("accept_newsletter", v)} options={[{value: "true", label: "Sim"}, {value: "false", label: "Não"}]} placeholder="Selecionar" />
          <FormSelect fieldKey="email_marketing_permitido" label="Email Marketing" value={form.email_marketing_permitido} onChange={(v) => handleChange("email_marketing_permitido", v)} options={[{value: "true", label: "Sim"}, {value: "false", label: "Não"}]} placeholder="Selecionar" />
          <FormSelect fieldKey="whatsapp_marketing" label="WhatsApp Marketing" value={form.whatsapp_marketing} onChange={(v) => handleChange("whatsapp_marketing", v)} options={[{value: "true", label: "Sim"}, {value: "false", label: "Não"}]} placeholder="Selecionar" />
          <FormSelect fieldKey="consentimento" label="Consentimento" value={form.consentimento} onChange={(v) => handleChange("consentimento", v)} options={[{value: "true", label: "Sim"}, {value: "false", label: "Não"}]} placeholder="Selecionar" />
          <FormField fieldKey="newsletter_consent_source" label="Origem Consentimento" value={form.newsletter_consent_source} onChange={(v) => handleChange("newsletter_consent_source", v)} placeholder="Ex: Formulário web" />
          <FormField fieldKey="newsletter_consent_at" label="Data Consentimento" value={form.newsletter_consent_at} onChange={(v) => handleChange("newsletter_consent_at", v)} type="date" />
          <FormField fieldKey="idioma" label="Idioma" value={form.idioma} onChange={(v) => handleChange("idioma", v)} placeholder="pt-PT" />
          <FormField fieldKey="segmento_marketing" label="Segmento Marketing" value={form.segmento_marketing} onChange={(v) => handleChange("segmento_marketing", v)} placeholder="Ex: Premium" />
          <FormField fieldKey="interesses" label="Interesses" value={form.interesses} onChange={(v) => handleChange("interesses", v)} placeholder="Tags separadas por vírgula" />
          <FormSelect fieldKey="newsletter_unsubscribed_at" label="Unsubscribed" value={form.newsletter_unsubscribed_at} onChange={(v) => handleChange("newsletter_unsubscribed_at", v)} options={[{value: "false", label: "Não"}, {value: "true", label: "Sim"}]} placeholder="Selecionar" />
        </div>
      </ConfigSection>

      {/* 8. Comercial */}
      <ConfigSection formConfig={formConfig} title="Comercial">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {formConfig.orderedFields("Comercial", ["assigned_to", "segment", "business_type", "source"]).map((key) => {
            if (key === "assigned_to") return (
              <div key={key}>
                <FormSelect fieldKey="assigned_to" label="Responsável Comercial" value={form.assigned_to} onChange={(v) => handleChange("assigned_to", v)}
                  options={activeEmployees.map((e) => ({ value: e.full_name || e.email || e.id, label: e.full_name || e.email || "Sem nome" }))} placeholder="Selecionar" />
                {user?.email && form.assigned_to !== (activeEmployees.find((e) => e.email === user.email)?.full_name || user.email) && (
                  <button type="button" onClick={() => { const me = activeEmployees.find((e) => e.email === user.email); handleChange("assigned_to", me?.full_name || user.email || ""); }} className="mt-1 text-xs text-primary hover:underline">Atribuir a mim</button>
                )}
              </div>
            );
            if (key === "segment") return (
              <FormSelect key={key} fieldKey="segment" label="Segmento" value={form.segment} onChange={(v) => handleChange("segment", v)}
                options={formConfig.options("segment").map((o) => ({ value: o.value, label: o.label }))} placeholder="Ex: Hotelaria 4★" />
            );
            if (key === "business_type") return (
              <FormSelect key={key} fieldKey="business_type" label="Tipo de Negócio" value={form.business_type} onChange={(v) => handleChange("business_type", v)}
                options={formConfig.options("business_type").map((o) => ({ value: o.value, label: o.label }))} placeholder="Ex: Hotel, Restaurante" />
            );
            if (key === "source") return <FormField key={key} fieldKey="source" label="Origem" value={form.source} onChange={(v) => handleChange("source", v)} placeholder="Campanha, indicação..." />;
            return null;
          })}
          <FormField fieldKey="campanha" label="Campanha" value={form.campanha} onChange={(v) => handleChange("campanha", v)} placeholder="Nome da campanha" />
          <FormField fieldKey="score" label="Score" value={form.score} onChange={(v) => handleChange("score", v)} type="number" placeholder="0-100" />
          <FormField fieldKey="potencial_anual" label="Potencial Anual (€)" value={form.potencial_anual} onChange={(v) => handleChange("potencial_anual", v)} type="number" placeholder="Ex: 50000" />
        </div>
      </ConfigSection>

      {/* 8b. Tags */}
      <EntitySection title="Tags">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {((form as Record<string, unknown>).tags as string[] || []).map?.((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {tag}
                <button type="button" onClick={() => {
                  const current = Array.isArray((form as Record<string, unknown>).tags) ? [...(form as Record<string, unknown>).tags as string[]] : [];
                  current.splice(i, 1);
                  handleChange("tags" as keyof typeof form, JSON.stringify(current));
                }} className="ml-0.5 text-primary/60 hover:text-primary">×</button>
              </span>
            )) || null}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar tag..."
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const input = e.currentTarget;
                  const val = input.value.trim();
                  if (!val) return;
                  const current = Array.isArray((form as Record<string, unknown>).tags) ? [...(form as Record<string, unknown>).tags as string[]] : [];
                  if (!current.includes(val)) {
                    current.push(val);
                    handleChange("tags" as keyof typeof form, JSON.stringify(current));
                  }
                  input.value = "";
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Prime Enter para adicionar</p>
        </div>
      </EntitySection>

      {/* 9. Financeiro */}
      <ConfigSection formConfig={formConfig} title="Financeiro">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField fieldKey="condicoes_pagamento" label="Condições Pagamento" value={form.condicoes_pagamento} onChange={(v) => handleChange("condicoes_pagamento", v)} placeholder="Ex: 30 dias" />
          <FormField fieldKey="forma_pagamento" label="Forma Pagamento" value={form.forma_pagamento} onChange={(v) => handleChange("forma_pagamento", v)} placeholder="Ex: Transferência" />
          <FormField fieldKey="tabela_precos" label="Tabela Preços" value={form.tabela_precos} onChange={(v) => handleChange("tabela_precos", v)} placeholder="Ex: Tabela A" />
          <FormField fieldKey="desconto_geral" label="Desconto Geral (%)" value={form.desconto_geral} onChange={(v) => handleChange("desconto_geral", v)} type="number" placeholder="0" />
          <FormField fieldKey="limite_credito" label="Limite Crédito (€)" value={form.limite_credito} onChange={(v) => handleChange("limite_credito", v)} type="number" placeholder="Ex: 10000" />
          <FormField fieldKey="iban" label="IBAN" value={form.iban} onChange={(v) => handleChange("iban", v)} placeholder="PT50..." />
        </div>
      </ConfigSection>

      {/* 10. Fornecedor (condicional) */}
      {isFornecedor && (
        <ConfigSection formConfig={formConfig} title="Fornecedor">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField fieldKey="categoria_fornecedor" label="Categoria" value={form.categoria_fornecedor} onChange={(v) => handleChange("categoria_fornecedor", v)} placeholder="Ex: Equipamento cozinha" />
            <FormField fieldKey="representante" label="Representante" value={form.representante} onChange={(v) => handleChange("representante", v)} placeholder="Nome do representante" />
            <FormField fieldKey="email_encomendas" label="Email Encomendas" value={form.email_encomendas} onChange={(v) => handleChange("email_encomendas", v)} type="email" placeholder="encomendas@fornecedor.pt" />
            <FormField fieldKey="email_pos_venda" label="Email Pós-venda" value={form.email_pos_venda} onChange={(v) => handleChange("email_pos_venda", v)} type="email" placeholder="posvenda@fornecedor.pt" />
            <FormField fieldKey="moq" label="MOQ" value={form.moq} onChange={(v) => handleChange("moq", v)} type="number" placeholder="Quantidade mínima" />
            <FormField fieldKey="prazo_entrega" label="Prazo Entrega" value={form.prazo_entrega} onChange={(v) => handleChange("prazo_entrega", v)} placeholder="Ex: 5-7 dias" />
            <FormField fieldKey="incoterm" label="Incoterm" value={form.incoterm} onChange={(v) => handleChange("incoterm", v)} placeholder="Ex: FOB, CIF, EXW" />
            <FormField fieldKey="garantia" label="Garantia" value={form.garantia} onChange={(v) => handleChange("garantia", v)} placeholder="Ex: 2 anos" />
          </div>
        </ConfigSection>
      )}

      {/* 10b. Produtos / SKU History */}
      <EntitySection title="Produtos (SKU)">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const skuRaw = (form as Record<string, unknown>).sku_history;
              const list: string[] = Array.isArray(skuRaw) ? skuRaw.map(String) : (typeof skuRaw === "string" ? (function() { try { return JSON.parse(skuRaw); } catch { return []; } })() : []);
              return list.length === 0
                ? <p className="text-xs text-muted-foreground">Sem SKUs guardados.</p>
                : list.map((sku, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-mono">
                      {sku}
                      <button type="button" onClick={() => {
                        const next = list.filter((_, idx) => idx !== i);
                        handleChange("sku_history" as keyof typeof form, JSON.stringify(next));
                      }} className="text-muted-foreground hover:text-foreground">×</button>
                    </span>
                  ));
            })()}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="SKU manual (ex: HE-1234)"
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = e.currentTarget.value.trim();
                  if (!val) return;
                  const skuRaw = (form as Record<string, unknown>).sku_history;
                  const list: string[] = Array.isArray(skuRaw) ? [...skuRaw.map(String)] : (typeof skuRaw === "string" ? (function() { try { return JSON.parse(skuRaw); } catch { return []; } })() : []);
                  if (!list.includes(val)) { list.unshift(val); handleChange("sku_history" as keyof typeof form, JSON.stringify(list)); }
                  e.currentTarget.value = "";
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Prime Enter para adicionar. Pesquisa Meilisearch disponível no orçamento.</p>
        </div>
      </EntitySection>

      {/* 11. Pessoas associadas */}
      <ConfigSection formConfig={formConfig} title="Pessoas Associadas">
        <div className="rounded-md bg-muted/20 border border-dashed border-border/50 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">Gestão de contactos associados será disponibilizada quando a collection entity_contacts for criada.</p>
        </div>
      </ConfigSection>

      {/* 12. Observações */}
      <ConfigSection formConfig={formConfig} title="Observações">
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Notas rápidas</Label>
            <textarea rows={3} value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} placeholder="Notas visíveis para toda a equipa…" className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Notas internas</Label>
            <textarea rows={3} value={form.internal_notes} onChange={(e) => handleChange("internal_notes", e.target.value)} placeholder="Notas internas (equipa) — opcional." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Notas comerciais</Label>
            <textarea rows={3} value={(form as Record<string, string>).commercial_notes || ""} onChange={(e) => handleChange("commercial_notes" as keyof typeof form, e.target.value)} placeholder="Notas comerciais (negócios, condições...)" className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Notas logística</Label>
            <textarea rows={3} value={(form as Record<string, string>).logistics_notes || ""} onChange={(e) => handleChange("logistics_notes" as keyof typeof form, e.target.value)} placeholder="Notas de logística (entregas, moradas...)" className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
      </ConfigSection>

      {/* 13. Integrações */}
      <EntitySection title="Integrações">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField fieldKey="moloni_client_id" label="Moloni ID" value={form.moloni_client_id} onChange={(v) => handleChange("moloni_client_id", v)} placeholder="ID no Moloni" />
          <FormField fieldKey="mautic_contact_id" label="Mautic ID" value={form.mautic_contact_id} onChange={(v) => handleChange("mautic_contact_id", v)} placeholder="ID no Mautic" />
          <FormField fieldKey="chatwoot_contact_id" label="Chatwoot ID" value={form.chatwoot_contact_id} onChange={(v) => handleChange("chatwoot_contact_id", v)} placeholder="ID no Chatwoot" />
          <FormField fieldKey="woo_customer_id" label="WooCommerce ID" value={form.woo_customer_id} onChange={(v) => handleChange("woo_customer_id", v)} placeholder="ID no WooCommerce" />
          <FormField fieldKey="whatsapp_id" label="WhatsApp ID" value={form.whatsapp_id} onChange={(v) => handleChange("whatsapp_id", v)} placeholder="ID WhatsApp" />
          <FormField fieldKey="email_imap" label="Email IMAP" value={form.email_imap} onChange={(v) => handleChange("email_imap", v)} placeholder="email@empresa.pt" />
        </div>
      </EntitySection>

      {/* 14. Histórico */}
      <EntitySection title="Histórico">
        <div className="rounded-md bg-muted/20 border border-dashed border-border/50 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">Histórico de alterações será implementado com a collection entity_history.</p>
        </div>
      </EntitySection>
    </div>
  );
}
