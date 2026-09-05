/**
 * Customer 360 Command Center — centro operacional do Hotelequip OS.
 * Rota: /customer360-shell/:id (dados reais) ou /customer360-shell (mock)
 *
 * Tabs:
 * - Geral: Command Center (prioridades, eventos, comunicações)
 * - Editar ficha: Formulário mestre com 55 campos
 * - Comunicações: Timeline completa
 * - Propostas: Lista de propostas com IVA discriminado
 * - Pedidos & Encomendas: Encomendas Woo, métricas e conversão
 * - Oportunidades: Pipeline
 * - Follow-ups: Agendamentos e tarefas
 * - Histórico: Timeline completa
 * - Tracking: Encomendas e expedição
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Customer360Layout } from "@/components/customer360/Customer360Layout";
import { OrganizationHeader } from "@/components/customer360/OrganizationHeader";
import { OrganizationSummary } from "@/components/customer360/OrganizationSummary";
import { ContactListPanel } from "@/components/customer360/ContactListPanel";
import { OpportunityPanel } from "@/components/customer360/OpportunityPanel";
import { ProposalPanel } from "@/components/customer360/ProposalPanel";
import { Customer360Actions } from "@/components/customer360/Customer360Actions";
import { KpiPanel } from "@/components/customer360/KpiPanel";
import { HealthScore } from "@/components/customer360/HealthScore";
import { NextAction } from "@/components/customer360/NextAction";
import { PriorityPanel } from "@/components/customer360/PriorityPanel";
import { CommandCenter, type CommandCenterEvent } from "@/components/customer360/CommandCenter";
import { PipelineKanban } from "@/components/customer360/PipelineKanban";
import { AISuggestions } from "@/components/customer360/AISuggestions";
import { CommunicationsPanel, type CommunicationEntry } from "@/components/customer360/CommunicationsPanel";
import { TimelinePanel } from "@/components/customer360/TimelinePanel";
import { EditGeneralTab } from "@/components/customer360/edit/EditGeneralTab";
import { CreateContactForm } from "@/components/customer360/edit/CreateContactForm";
import { Customer360Hub, addRecentContact } from "@/components/customer360/Customer360Hub";
import { FollowUpsPanel } from "@/components/customer360/FollowUpsPanel";
import { NewsletterBanner } from "@/components/customer360/NewsletterBanner";
import { CustomerOrdersTab } from "@/components/customer360/CustomerOrdersTab";
import { MobileTabDrawer, type TabDescriptor } from "@/components/customer360/MobileTabDrawer";
import { Breadcrumb } from "@/components/customer360/Breadcrumb";
import { AddNoteInline } from "@/components/customer360/AddNoteInline";
import { SectionCard } from "@/components/customer360/ui/SectionCard";
import { useCustomer360 } from "@/hooks/useCustomer360";
import { calculateHealthScore } from "@/services/customer360/CustomerHealthService";
import { determineNextAction } from "@/services/customer360/CustomerNextActionService";
import { calculatePriorities } from "@/services/customer360/CustomerPriorityService";
import { generateRecommendations } from "@/services/customer360/CustomerRecommendationService";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { patchContact } from "@/integrations/directus/contacts";
import { useQueryClient } from "@tanstack/react-query";
import type { Customer360Data } from "@/types/customer360";

// ─── Tab definition ────────────────────────────────────────────────────────

type TabId = "geral" | "editar" | "comunicacoes" | "propostas" | "pedidos" | "oportunidades" | "followups" | "historico" | "tracking";

const TABS: TabDescriptor[] = [
  { id: "geral", label: "Geral", icon: "🏠" },
  { id: "editar", label: "Editar ficha", icon: "✏️" },
  { id: "comunicacoes", label: "Comunicações", icon: "💬" },
  { id: "propostas", label: "Propostas", icon: "📄" },
  { id: "pedidos", label: "Pedidos & Encomendas", icon: "📦" },
  { id: "oportunidades", label: "Oportunidades", icon: "🎯" },
  { id: "followups", label: "Follow-ups", icon: "📅" },
  { id: "historico", label: "Histórico", icon: "🕒" },
  { id: "tracking", label: "Tracking", icon: "🚚" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildCommandCenterEvents(data: Customer360Data): CommandCenterEvent[] {
  const events: CommandCenterEvent[] = [];
  for (const ev of data.timeline.slice(0, 10)) {
    events.push({ id: ev.id, type: ev.type === "call_event" ? "phone" : ev.type, title: ev.title, subtitle: ev.description, occurredAt: ev.occurredAt, actor: ev.actor });
  }
  for (const p of data.proposals.slice(0, 3)) {
    if (p.status === "sent" || p.status === "viewed" || p.status === "approved") {
      events.push({ id: `prop-${p.id}`, type: p.status === "approved" ? "proposal_approved" : p.status === "viewed" ? "proposal_viewed" : "proposal_sent", title: `Proposta ${p.number} — ${p.status === "approved" ? "aprovada" : p.status === "viewed" ? "visualizada" : "enviada"}`, subtitle: p.totalAmount ? `€${p.totalAmount.toLocaleString("pt-PT")}` : undefined, occurredAt: p.sentAt || data.organization.createdAt });
    }
  }
  return events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 6);
}

function buildCommunications(data: Customer360Data): CommunicationEntry[] {
  return data.timeline.slice(0, 8).map((ev) => ({ id: ev.id, channel: (ev.type === "whatsapp" || ev.type === "email" || ev.type === "phone") ? ev.type : "phone", title: ev.title, date: formatShortDate(ev.occurredAt) }));
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "hoje";
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Customer360Shell() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useCustomer360(id === "novo" ? undefined : id);
  const [activeTab, setActiveTab] = useState<TabId>("geral");

  const isCreateMode = id === "novo" || (!id && (searchParams.has("phone") || searchParams.has("email") || searchParams.has("name") || searchParams.has("leadId")));
  const isHubMode = !id && !isCreateMode;

  const c360 = data;

  const healthScore = useMemo(() => c360 ? calculateHealthScore(c360) : null, [c360]);
  const nextAction = useMemo(() => c360 ? determineNextAction(c360) : null, [c360]);
  const priorities = useMemo(() => c360 ? calculatePriorities(c360) : [], [c360]);
  const recommendations = useMemo(() => c360 ? generateRecommendations(c360) : [], [c360]);
  const commandCenterEvents = useMemo(() => c360 ? buildCommandCenterEvents(c360) : [], [c360]);
  const communications = useMemo(() => c360 ? buildCommunications(c360) : [], [c360]);

  const queryClient = useQueryClient();
  const [inlineInternalNotes, setInlineInternalNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);

  useEffect(() => {
    if (c360) {
      setInlineInternalNotes(c360.organization.internal_notes || "");
    }
  }, [c360?.organization?.internal_notes]);

  const saveInternalNotes = useCallback(async () => {
    if (!id || notesSaving) return;
    setNotesSaving(true);
    setNotesSuccess(false);
    try {
      await patchContact(id, { internal_notes: inlineInternalNotes || null });
      setNotesSuccess(true);
      queryClient.refetchQueries({ queryKey: ["customer360", id] });
      setTimeout(() => setNotesSuccess(false), 3000);
    } catch { /* silent */ }
    setNotesSaving(false);
  }, [id, inlineInternalNotes, notesSaving, queryClient]);

  useEffect(() => {
    if (id && id !== "novo" && c360?.organization?.name) {
      addRecentContact({ id, name: c360.organization.name, detail: [c360.organization.phone, c360.organization.email].filter(Boolean).join(" · ") });
    }
  }, [id, c360?.organization?.name, c360?.organization?.phone, c360?.organization?.email]);

  if (isHubMode) return <AppLayout><Customer360Hub /></AppLayout>;

  if (isCreateMode) {
    const prefill = {
      name: searchParams.get("name") || undefined,
      company_name: searchParams.get("company_name") || undefined,
      phone: searchParams.get("phone") || undefined,
      email: searchParams.get("email") || undefined,
    };
    return <AppLayout><CreateContactForm prefill={prefill} /></AppLayout>;
  }

  if (id && isLoading) return <AppLayout><div className="flex items-center justify-center min-h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (id && error) return <AppLayout><div className="flex flex-col items-center justify-center min-h-[500px] gap-3"><AlertCircle className="h-10 w-10 text-destructive/60" /><p className="text-sm text-destructive">{error}</p></div></AppLayout>;
  if (!c360) return <AppLayout><div className="flex items-center justify-center min-h-[500px]"><p className="text-sm text-muted-foreground">Organização não encontrada.</p></div></AppLayout>;

  const org = c360.organization;
  const bestStage = c360.opportunities.find((o) => !o.stage.startsWith("closed"))?.stage || "lead";

  function renderTabContent() {
    switch (activeTab) {
      case "geral":
        return (
          <Customer360Layout
            header={<></>}
            toolbar={<></>}
            left={
              <>
                <OrganizationSummary
                  vatNumber={org.vatNumber}
                  website={org.website}
                  phone={org.phone}
                  email={org.email}
                  address={org.address}
                  postalCode={org.postalCode}
                  city={org.city}
                  onEditField={() => setActiveTab("editar")}
                />
                <ContactListPanel contacts={c360.contacts} organizationName={org.name} />
                <KpiPanel annualValue={org.annualValue} potential={org.potential} totalProposals={c360.proposals.length} successRate={c360.proposals.length > 0 ? Math.round(c360.proposals.filter((p) => p.status === "approved").length / c360.proposals.length * 100) : undefined} />
                <SectionCard
                  title="Notas"
                  action={
                    <button type="button" onClick={saveInternalNotes} disabled={notesSaving} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">
                      <Save className="h-3 w-3" /> {notesSaving ? "A guardar..." : "Internas"}
                    </button>
                  }
                >
                  <div className="space-y-3">
                    <AddNoteInline
                      contactId={id!}
                      source="c360"
                      variant="threec-sixty"
                      noteQuickTags={["Urgente", "Acompanhamento", "Follow-up", "Reclamação"]}
                      placeholder="Notas visíveis no dossier — escreva à vontade (auto-grow)."
                    />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Notas internas (privadas)</p>
                      <textarea rows={3} value={inlineInternalNotes} onChange={(e) => setInlineInternalNotes(e.target.value)} className="flex w-full rounded-md border border-input bg-amber-50/40 px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                </SectionCard>
              </>
            }
            center={<><PriorityPanel items={priorities} /><CommandCenter events={commandCenterEvents} /><CommunicationsPanel items={communications} /></>}
            right={<><OpportunityPanel opportunities={c360.opportunities} /><ProposalPanel proposals={c360.proposals} contactId={id} contactName={org.name} /><AISuggestions suggestions={recommendations} /></>}
          />
        );
      case "editar":
        return <div className="p-4 max-w-3xl mx-auto"><EditGeneralTab organizationId={id} organization={c360.organization} /></div>;
      case "comunicacoes":
      case "historico":
        return <div className="p-4 max-w-4xl mx-auto"><TimelinePanel events={c360.timeline} /></div>;
      case "propostas":
        return <div className="p-4 max-w-3xl mx-auto"><ProposalPanel proposals={c360.proposals} contactId={id} contactName={org.name} /></div>;
      case "pedidos":
      case "tracking":
        return <CustomerOrdersTab contactId={id} contactName={org.name} contactEmail={org.email} contactPhone={org.phone || org.mobile_phone} />;
      case "oportunidades":
        return <div className="p-4 max-w-3xl mx-auto"><OpportunityPanel opportunities={c360.opportunities} /></div>;
      case "followups":
        return <div className="p-4 max-w-3xl mx-auto"><FollowUpsPanel contactId={id} /></div>;
      default:
        return null;
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-[#f8f9fb]">
        <div className="bg-card border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <OrganizationHeader name={org.name} status={org.status} roles={org.roles} assignedTo={org.assignedTo} lastActivity={org.lastActivityAt ? formatShortDate(org.lastActivityAt) : undefined} phone={org.phone} email={org.email} website={org.website} vatNumber={org.vatNumber} annualValue={org.annualValue} />
            </div>
            <div className="hidden xl:flex items-center gap-4 shrink-0">{healthScore && <HealthScore score={healthScore.score} size="lg" />}<div className="w-px h-10 bg-border" /><NextAction action={nextAction} compact /></div>
          </div>
          <div className="mt-3"><PipelineKanban currentStage={bestStage} /></div>
        </div>
        <div className="border-b border-border bg-card px-5 py-2">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Customer360Actions contactId={id} contactName={org.name} contactPhone={org.phone || org.mobile_phone} contactEmail={org.email} />
          </div>
        </div>
        <div className="px-5 py-1.5 border-b border-border bg-card/40"><Breadcrumb items={[{ label: "HotelEquip", href: "/" }, { label: "Clientes", href: "/clientes" }, { label: org.name }]} /></div>
        <MobileTabDrawer tabs={TABS} activeId={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
        <div className="flex-1 min-h-0 overflow-auto">{renderTabContent()}</div>
      </div>
    </AppLayout>
  );
}
