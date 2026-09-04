/**
 * useCustomerDossier — cérebro único do "dossier contínuo" do cliente.
 *
 * Centraliza, num só hook, tudo o que várias superfícies (Telecof, HubChat, 360 shell)
 * precisam para mostrar e evoluir o dossiê de um Lead/Contacto sem mudar de écran:
 *
 *   • Read único e cacheado (interactions + deals + lead + contact + permissões)
 *   • addNote(text, opts)             → POST /interactions + invalida cache
 *   • scheduleFollowUp(opts)          → POST /follow_ups + invalida cache
 *   • convertLeadToContact(overrides) → cria contact + PATCH lead + interaction
 *   • createOpportunity(opts)         → POST /deals + invalida cache
 *
 * Cache: TTL 30s, react-query, queryKey ["customer-dossier", contactId, leadId].
 * Cada mutação invalida explicitamente o dossier do mesmo contacto + chaves coerentes
 * com o resto da app (customer360, contacts-directus, leads-page, follow-ups).
 *
 * Permissões:
 *   • isSupervisor    = employees.role ∈ {admin, gestor}
 *   • canEditNote(i)  = (i.payload?.agent_name === agentName)
 *                       OR isSupervisor
 *                       OR Date.now() - new Date(i.date_created) > 24h
 *
 * Não cria nova collection Directus — segue o event log em `interactions`.
 */

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuditedMutation } from "@/hooks/useAudit";
import { toast } from "@/hooks/use-toast";

import { createInteraction, type InteractionRow } from "@/integrations/directus/interactions";
import {
  createFollowUp,
  type FollowUpRow,
} from "@/integrations/directus/follow-ups";
import {
  createContact,
  patchContact,
  type ContactItem,
} from "@/integrations/directus/contacts";
import {
  createDeal,
  type DealRow,
  type DealStatus,
} from "@/integrations/directus/deals";
import { patchLead, type LeadItem } from "@/integrations/directus/leads";
import { directusRequest } from "@/integrations/directus/client";

// ────────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ────────────────────────────────────────────────────────────────────────────────

export interface CustomerDossierSnapshot {
  /** Contacto principal (null se ainda só existe como Lead). */
  contact: Pick<
    ContactItem,
    | "id"
    | "company_name"
    | "contact_name"
    | "phone"
    | "email"
    | "nif"
    | "city"
    | "notes"
    | "assigned_employee_id"
  > | null;
  /** Lead ativo (sem contact_id ainda). */
  lead: Pick<
    LeadItem,
    "id" | "display_name" | "phone" | "email" | "status" | "lead_data" | "contact_id" | "notes"
  > | null;
  /** Últimas N interações (default 5), ordenadas desc por occurred_at. */
  recentInteractions: InteractionRow[];
  /** Negócios abertos (status ∉ {ganho, perdido}). */
  openDeals: DealRow[];
  openDealsCount: number;
  /** Utilizador autenticado é admin/gestor (ou role desconhecida → false). */
  isSupervisor: boolean;
}

export interface UseCustomerDossierArgs {
  contactId?: string | number | null;
  leadId?: string | number | null;
  /** Limite da timeline compacta (default 5). */
  maxInteractions?: number;
}

export interface UseCustomerDossierResult extends CustomerDossierSnapshot {
  loading: boolean;
  error: string | null;
  /** true se o utilizador pode editar a interaction `i` (autor, supervisor ou >24h). */
  canEditNote: (i: InteractionRow) => boolean;
  /** true se o utilizador pode adicionar uma nova nota (sempre true enquanto autenticado). */
  canAddNote: boolean;
  addNote: (
    text: string,
    opts?: { tags?: string[]; source?: string; callId?: string; direction?: "in" | "out" },
  ) => Promise<InteractionRow | null>;
  scheduleFollowUp: (opts: {
    due_at: string;
    type?: "call" | "email" | "whatsapp" | "task" | string;
    notes?: string;
    title?: string;
  }) => Promise<FollowUpRow | null>;
  convertLeadToContact: (overrides?: {
    company_name?: string;
    nif?: string;
    email?: string;
    contact_name?: string;
  }) => Promise<{ contactId: string } | null>;
  createOpportunity: (opts: {
    title: string;
    value?: number;
    stage?: DealStatus;
  }) => Promise<DealRow | null>;
  refresh: () => Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ────────────────────────────────────────────────────────────────────────────────

const SUPERVISOR_ROLES = new Set(["admin", "gestor"]);
const MS_24H = 24 * 60 * 60 * 1000;

function normalizeId(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "id" in (value as Record<string, unknown>)) {
    return String((value as { id?: unknown }).id ?? "");
  }
  return String(value);
}

function agentNameFromPayload(i: InteractionRow | undefined | null): string | null {
  if (!i) return null;
  const payload = i.payload;
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const v = parsed?.agent_name;
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  }
  if (typeof payload === "object") {
    const v = (payload as Record<string, unknown>).agent_name;
    return typeof v === "string" ? v : null;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────────

export function useCustomerDossier({
  contactId,
  leadId,
  maxInteractions = 5,
}: UseCustomerDossierArgs = {}): UseCustomerDossierResult {
  const cId = contactId ? String(contactId) : "";
  const lId = leadId ? String(leadId) : "";
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: employees = [] } = useEmployees();

  const agentName = user?.first_name ?? user?.email ?? "Agente";
  const agentId = user?.id ?? "";

  // Mapa de employees para descobrir role do agente atual.
  const currentEmployee = useMemo(() => {
    const byEmail = employees.find((e) => e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase());
    const byId = employees.find((e) => String(e.id) === String(agentId));
    return byEmail || byId || null;
  }, [employees, user?.email, agentId]);

  const isSupervisor = useMemo(() => {
    const role = String(currentEmployee?.role || "").toLowerCase();
    return SUPERVISOR_ROLES.has(role);
  }, [currentEmployee?.role]);

  // ── Query: snapshot agregado ───────────────────────────────────────────────
  const dossierKey = ["customer-dossier", cId, lId] as const;

  const query = useQuery({
    queryKey: dossierKey,
    enabled: Boolean(cId || lId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<CustomerDossierSnapshot> => {
      const result: CustomerDossierSnapshot = {
        contact: null,
        lead: null,
        recentInteractions: [],
        openDeals: [],
        openDealsCount: 0,
        isSupervisor,
      };

      const tasks: Array<Promise<void>> = [];

      // 1) Contacto + interações + deals (em paralelo)
      if (cId) {
        tasks.push(
          (async () => {
            const [contactRes, interactionsRes, dealsRes] = await Promise.all([
              directusRequest<{ data: ContactItem }>(`/items/contacts/${encodeURIComponent(cId)}`).catch(() => null),
              directusRequest<{ data: InteractionRow[] }>(
                `/items/interactions?filter[contact_id][_eq]=${encodeURIComponent(cId)}&sort=-occurred_at,-date_created&limit=${maxInteractions}&fields=id,type,direction,status,source,external_id,occurred_at,summary,display_name,phone,email,payload,contact_id.id,lead_id.id,date_created,date_updated`,
              ).catch(() => ({ data: [] })),
              directusRequest<{ data: DealRow[] }>(
                `/items/deals?filter[customer_id][_eq]=${encodeURIComponent(cId)}&filter[status][_nin]=ganho,perdido&limit=20&fields=id,title,status,total_amount,date_created,customer_id.id`,
              ).catch(() => ({ data: [] })),
            ]);

            if (contactRes?.data) {
              const c = contactRes.data;
              result.contact = {
                id: c.id,
                company_name: c.company_name ?? null,
                contact_name: c.contact_name ?? null,
                phone: c.phone ?? null,
                email: c.email ?? null,
                nif: c.nif ?? null,
                city: c.city ?? null,
                notes: c.notes ?? null,
                assigned_employee_id: (c as Record<string, unknown>).assigned_employee_id ?? null,
              };
            }
            result.recentInteractions = interactionsRes?.data ?? [];
            result.openDeals = dealsRes?.data ?? [];
            result.openDealsCount = result.openDeals.length;
          })(),
        );
      }

      // 1b) Interações também filtradas por lead_id (quando estamos no fluxo
      //     lead-only, antes de converter a contacto). Usa-se o segundo
      //     filter do Directus para juntar contact_id+lead_id em paralelo.
      if (!cId && lId) {
        tasks.push(
          (async () => {
            const interactionsRes = await directusRequest<{ data: InteractionRow[] }>(
              `/items/interactions?filter[lead_id][_eq]=${encodeURIComponent(lId)}&sort=-occurred_at,-date_created&limit=${maxInteractions}&fields=id,type,direction,status,source,external_id,occurred_at,summary,display_name,phone,email,payload,contact_id.id,lead_id.id,date_created,date_updated`,
            ).catch(() => ({ data: [] }));
            result.recentInteractions = interactionsRes?.data ?? [];
          })(),
        );
      }

      // 2) Lead (se passado e ainda sem contact_id)
      if (lId) {
        tasks.push(
          (async () => {
            const res = await directusRequest<{ data: LeadItem }>(
              `/items/leads/${encodeURIComponent(lId)}?fields=id,display_name,phone,email,status,lead_data,contact_id,notes`,
            ).catch(() => null);
            if (res?.data) {
              result.lead = {
                id: res.data.id,
                display_name: res.data.display_name ?? null,
                phone: res.data.phone ?? null,
                email: res.data.email ?? null,
                status: res.data.status ?? null,
                lead_data: res.data.lead_data ?? null,
                contact_id: res.data.contact_id ?? null,
                notes: res.data.notes ?? null,
              };
            }
          })(),
        );
      }

      await Promise.all(tasks);
      return result;
    },
  });

  const snapshot = query.data ?? {
    contact: null,
    lead: null,
    recentInteractions: [],
    openDeals: [],
    openDealsCount: 0,
    isSupervisor,
  };

  // ── Permissões por interaction ─────────────────────────────────────────────
  const canEditNote = useCallback(
    (i: InteractionRow): boolean => {
      if (!i) return false;
      const author = agentNameFromPayload(i);
      const isAuthor = !!author && author === agentName;
      if (isAuthor) return true;
      if (isSupervisor) return true;
      const created = i.date_created || i.occurred_at;
      if (!created) return true; // sem timestamp → conservador-permissivo
      const ageMs = Date.now() - new Date(created).getTime();
      return ageMs > MS_24H;
    },
    [agentName, isSupervisor],
  );

  // ── Mutação: addNote ───────────────────────────────────────────────────────
  const addNoteMutation = useMutation({
    mutationFn: async (args: {
      text: string;
      tags?: string[];
      source?: string;
      callId?: string;
      direction?: "in" | "out";
    }): Promise<InteractionRow | null> => {
      const text = args.text.trim();
      if (!text) throw new Error("Texto da nota vazio");
      if (!cId && !lId) throw new Error("Sem contactId nem leadId — não há alvo para a nota");

      const payload: Record<string, unknown> = {
        type: "note",
        direction: args.direction || "out",
        status: "done",
        source: args.source || "crm",
        summary: text.slice(0, 200),
        payload: {
          text,
          tags: args.tags,
          call_id: args.callId,
          agent_name: agentName,
        },
      };
      if (cId) payload.contact_id = cId;
      if (lId) payload.lead_id = lId;
      if (!cId && !lId) {
        payload.phone = snapshot.contact?.phone || snapshot.lead?.phone || undefined;
      }

      const created = await createInteraction(payload as Partial<InteractionRow>);
      return created ?? null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-dossier", cId, lId] });
      qc.invalidateQueries({ queryKey: ["customer-dossier"] });
      qc.invalidateQueries({ queryKey: ["interactions"] });
      qc.invalidateQueries({ queryKey: ["customer360", cId] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  // ── Mutação: scheduleFollowUp ──────────────────────────────────────────────
  const followUpMutation = useAuditedMutation({
    collection: "follow_ups",
    action: "create",
    invalidateKeys: [["follow-ups"]],
    mutationFn: async (opts: {
      due_at: string;
      type?: string;
      notes?: string;
      title?: string;
    }): Promise<FollowUpRow | null> => {
      const fallbackName =
        snapshot.contact?.company_name ||
        snapshot.contact?.contact_name ||
        snapshot.lead?.display_name ||
        "cliente";

      const created = await createFollowUp({
        contact_id: cId || undefined,
        lead_id: lId || undefined,
        type: (opts.type as FollowUpRow["type"]) || "call",
        status: "open",
        due_at: opts.due_at,
        title: opts.title || `Rechamar ${fallbackName}`,
        notes: opts.notes || undefined,
      } as Partial<FollowUpRow>);
      return (created as FollowUpRow) ?? null;
    },
  });

  // Após sucesso, invalidar dossier coerentemente
  const scheduleFollowUp = useCallback(
    async (
      opts: Parameters<typeof followUpMutation.mutateAsync>[0],
    ): Promise<FollowUpRow | null> => {
      try {
        const result = await followUpMutation.mutateAsync(opts);
        qc.invalidateQueries({ queryKey: ["customer-dossier", cId, lId] });
        qc.invalidateQueries({ queryKey: ["customer-dossier"] });
        if (cId) qc.invalidateQueries({ queryKey: ["customer360", cId] });
        return result;
      } catch (err) {
        toast({
          title: "Erro a agendar follow-up",
          description: String((err as Error)?.message || err),
          variant: "destructive",
        });
        return null;
      }
    },
    [followUpMutation, qc, cId, lId],
  );

  // ── Mutação: convertLeadToContact ──────────────────────────────────────────
  const convertMutation = useMutation({
    mutationFn: async (overrides?: {
      company_name?: string;
      nif?: string;
      email?: string;
      contact_name?: string;
    }): Promise<{ contactId: string } | null> => {
      if (!lId) throw new Error("Sem leadId — não há lead para converter");

      let contactIdFinal = normalizeId(snapshot.lead?.contact_id);
      const fallbackName =
        overrides?.company_name ||
        snapshot.lead?.display_name ||
        overrides?.contact_name ||
        "Lead Telecof";

      if (!contactIdFinal) {
        // 1) Criar Contacto novo
        const created = await createContact({
          company_name: fallbackName,
          contact_name: overrides?.contact_name || fallbackName,
          phone: snapshot.lead?.phone || undefined,
          email: overrides?.email || snapshot.lead?.email || undefined,
          nif: overrides?.nif || undefined,
          source: "telecof",
          notes: snapshot.lead?.notes || "Lead promovido a Contacto via Telecof",
        } as Partial<ContactItem>);
        contactIdFinal = String(created?.id ?? (created as { data?: { id?: string } })?.data?.id ?? "");
        if (!contactIdFinal) throw new Error("Falha a criar contacto");
      }

      // 2) Fechar lead
      await patchLead(lId, {
        status: "processed",
        contact_id: contactIdFinal,
      } as Partial<LeadItem>);

      // 3) Marcar contacto com origem (best-effort — campo pode não existir)
      try {
        await patchContact(contactIdFinal, {
          // @ts-expect-error: source_lead_id é opcional e tolerado pelo schema
          source_lead_id: lId,
        });
      } catch {
        /* silencioso — campo pode não existir */
      }

      // 4) Registo em interactions (event log)
      try {
        await createInteraction({
          contact_id: contactIdFinal,
          lead_id: lId,
          type: "conversion",
          direction: "out",
          status: "done",
          source: "telecof",
          summary: "Lead promovido a Contacto",
          payload: {
            from: "lead",
            to: "contact",
            agent_name: agentName,
            lead_id: lId,
          },
        } as Partial<InteractionRow>);
      } catch {
        /* non-blocking */
      }

      return { contactId: contactIdFinal };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-dossier"] });
      qc.invalidateQueries({ queryKey: ["leads-page"] });
      qc.invalidateQueries({ queryKey: ["contacts-directus"] });
      qc.invalidateQueries({ queryKey: ["customer360"] });
      qc.invalidateQueries({ queryKey: ["interactions"] });
    },
  });

  // ── Mutação: createOpportunity ─────────────────────────────────────────────
  const opportunityMutation = useAuditedMutation({
    collection: "deals",
    action: "create",
    invalidateKeys: [["deals"]],
    mutationFn: async (opts: {
      title: string;
      value?: number;
      stage?: DealStatus;
    }): Promise<DealRow | null> => {
      if (!cId) throw new Error("Sem contactId — não é possível criar oportunidade sem cliente");

      const created = await createDeal({
        title: opts.title,
        status: opts.stage || "lead",
        total_amount: typeof opts.value === "number" ? opts.value : 0,
        customer_id: cId,
      } as Partial<DealRow>);

      // Registo em interactions (event log)
      try {
        await createInteraction({
          contact_id: cId,
          type: "opportunity",
          direction: "out",
          status: "open",
          source: "crm",
          summary: `Oportunidade criada: ${opts.title}`,
          payload: {
            deal_id: (created as { id?: string })?.id,
            value: opts.value,
            stage: opts.stage || "lead",
            agent_name: agentName,
          },
        } as Partial<InteractionRow>);
      } catch {
        /* non-blocking */
      }

      return (created as DealRow) ?? null;
    },
  });

  const createOpportunity = useCallback(
    async (
      opts: Parameters<typeof opportunityMutation.mutateAsync>[0],
    ): Promise<DealRow | null> => {
      try {
        const result = await opportunityMutation.mutateAsync(opts);
        qc.invalidateQueries({ queryKey: ["customer-dossier", cId, lId] });
        qc.invalidateQueries({ queryKey: ["customer-dossier"] });
        if (cId) qc.invalidateQueries({ queryKey: ["customer360", cId] });
        return result;
      } catch (err) {
        toast({
          title: "Erro a criar oportunidade",
          description: String((err as Error)?.message || err),
          variant: "destructive",
        });
        return null;
      }
    },
    [opportunityMutation, qc, cId, lId],
  );

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: dossierKey });
    await qc.refetchQueries({ queryKey: dossierKey });
  }, [qc, dossierKey]);

  return {
    ...snapshot,
    loading: query.isLoading || query.isFetching,
    error: query.error ? String((query.error as Error)?.message || query.error) : null,
    canEditNote,
    canAddNote: Boolean(cId || lId),
    addNote: async (text, opts) => {
      try {
        return await addNoteMutation.mutateAsync({ text, ...(opts || {}) });
      } catch (err) {
        toast({
          title: "Erro a guardar nota",
          description: String((err as Error)?.message || err),
          variant: "destructive",
        });
        return null;
      }
    },
    scheduleFollowUp,
    convertLeadToContact: async (overrides) => {
      try {
        return await convertMutation.mutateAsync(overrides);
      } catch (err) {
        toast({
          title: "Erro a converter lead",
          description: String((err as Error)?.message || err),
          variant: "destructive",
        });
        return null;
      }
    },
    createOpportunity,
    refresh,
  };
}
