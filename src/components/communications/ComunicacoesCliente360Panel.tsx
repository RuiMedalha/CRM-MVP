/**
 * Painel 360 lateral no inbox — campos editáveis + operações da conversa.
 * Replica as funcionalidades do HubChat CustomerPanel.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  Save,
  X,
  Search,
  Link2,
  Building2,
  UserPlus,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { QuickDealAndQuotationCard } from "@/components/common/QuickDealAndQuotationCard";
import { CustomerTimeline } from "@/components/contacts/CustomerTimeline";
import { CompactTimeline } from "@/components/customer360/CompactTimeline";
import { AddNoteInline } from "@/components/customer360/AddNoteInline";
import { ConvertActions } from "@/components/customer360/ConvertActions";
import { Input } from "@/components/ui/input";
import { useCustomerDossier } from "@/hooks/useCustomerDossier";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { ContactItem } from "@/integrations/directus/contacts";
import {
  createContact,
  patchContact,
} from "@/integrations/directus/contacts";
import { directusRequest } from "@/integrations/directus/client";
import { createFollowUp } from "@/integrations/directus/follow-ups";
import { useConversationOperations } from "@/hooks/useConversationOperations";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/conversation";

/**
 * Extrai número de telefone de JIDs WA e outros formatos:
 * "244523637019@s.whatsapp.net" → "+244523637019"
 * "351918346615" → "+351918346615"
 * "+351918346615" → "+351918346615"
 * "João Silva" → ""
 */
function extractWaPhone(raw: string | undefined): string {
  if (!raw) return "";
  // Formato Meta Cloud API (913): "meta:913:351916542271"
  const metaMatch = raw.match(/^meta:[^:]+:(\d{7,15})$/);
  if (metaMatch) return `+${metaMatch[1]}`;
  const withoutJid = raw.replace(/@.*$/, "").trim();
  const digits = withoutJid.replace(/[^\d+]/g, "");
  if (digits.length < 7) return "";
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function isPhoneNumber(raw: string): boolean {
  return extractWaPhone(raw).length >= 8;
}

type Props = {
  contactId?: string;
  contact: ContactItem | null;
  contactLoading: boolean;
  contactError: string | null;
  conversationPhone?: string;
  conversationName?: string;
  conversationId?: string;
  conversation?: Conversation;
  isTyping?: boolean;
  onExpandToggle?: () => void;
  className?: string;
};

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-0.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
    </div>
  );
}

function Section({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          {label}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * DossieContinuoHubChat — sub-componente inline do ComunicacoesCliente360Panel.
 * Mostra timeline compacta + addNote inline + datetime picker para follow-up
 * + ConvertActions (Lead → Contacto, Contacto → Oportunidade).
 * Usa useCustomerDossier hook (mesmo cérebro do Telecof + 360).
 */
function DossieContinuoHubChat({ contactId }: { contactId: string }) {
  const dossier = useCustomerDossier({ contactId });
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleScheduleFollowUp() {
    if (!followUpAt) {
      toast({ title: "Escolhe data e hora", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await dossier.scheduleFollowUp({
        due_at: new Date(followUpAt).toISOString(),
        type: "call",
        notes: followUpNote.trim() || undefined,
        title: dossier.contact?.company_name
          ? `Rechamar ${dossier.contact.company_name}`
          : undefined,
      });
      if (result?.id) {
        toast({ title: "Follow-up agendado", description: "Visível na Agenda." });
        setFollowUpAt("");
        setFollowUpNote("");
      } else {
        toast({ title: "Não foi possível agendar", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Erro a agendar follow-up",
        description: String(err instanceof Error ? err.message : err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <CompactTimeline
        interactions={dossier.recentInteractions}
        maxItems={5}
        variant="hubchat"
        emptyMessage="Sem interações. Adicione a primeira nota abaixo."
      />

      <AddNoteInline
        contactId={contactId}
        source="hubchat"
        variant="hubchat"
        placeholder="Nota sobre esta conversa..."
      />

      {/* Follow-up inline (sem modal) */}
      <div className="space-y-1.5 rounded-md border border-border bg-card p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Follow-up
        </p>
        <Input
          type="datetime-local"
          value={followUpAt}
          onChange={(e) => setFollowUpAt(e.target.value)}
          className="text-xs h-8"
        />
        <Input
          type="text"
          value={followUpNote}
          onChange={(e) => setFollowUpNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="text-xs h-8"
        />
        <Button
          type="button"
          onClick={handleScheduleFollowUp}
          disabled={!followUpAt || submitting}
          className="w-full h-8 text-xs"
        >
          {submitting ? "A agendar…" : "📅 Agendar"}
        </Button>
      </div>

      <ConvertActions
        contactId={contactId}
        contactName={dossier.contact?.company_name || dossier.contact?.contact_name}
        variant="hubchat"
      />
    </div>
  );
}

export function ComunicacoesCliente360Panel({
  contactId = "",
  contact,
  contactLoading,
  conversationPhone,
  conversationName,
  conversationId,
  conversation,
  onExpandToggle,
  className,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !contactId;
  const ops = useConversationOperations(conversation);

  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    whatsapp_number: "",
    nif: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [privateNote, setPrivateNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const [assignedAgent, setAssignedAgent] = useState("");

  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const [secDados, setSecDados] = useState(true);
  const [secOps, setSecOps] = useState(true);
  const [secNota, setSecNota] = useState(false);
  const [secFollowUp, setSecFollowUp] = useState(false);
  const [secAgente, setSecAgente] = useState(false);
  const [secHistorico, setSecHistorico] = useState(false);
  const [secDossieContinuo, setSecDossieContinuo] = useState(true);

  // Search existing contact to link
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [contactResults, setContactResults] = useState<Array<{
    id: string | number;
    company_name?: string;
    contact_name?: string;
    name?: string;
    phone?: string;
    email?: string;
    nif?: string;
    city?: string;
  }>>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search existing contacts debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setContactResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setSearchingContacts(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(q);
        const data = await directusRequest<{ data: any[] }>(
          `/items/contacts?search=${encoded}&limit=6&fields=id,company_name,contact_name,name,phone,email,nif,city`
        );
        setContactResults(data?.data || []);
        setShowSearchDropdown(true);
      } catch {
        setContactResults([]);
      } finally {
        setSearchingContacts(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  async function handleLinkExistingContact(c: any) {
    if (!conversationId) return;
    setSaving(true);
    try {
      const cId = String(c.id);
      const companyName = String(c.company_name || c.name || c.contact_name || "").trim();
      await directusRequest(`/items/conversations/${encodeURIComponent(conversationId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          contact_id: cId,
          customer_name: companyName || undefined,
        }),
      });

      toast({ title: "Contacto associado!", description: `Conversa vinculada a ${companyName || `#${cId}`}.` });
      setShowSearchDropdown(false);
      setSearchQuery("");
      qc.invalidateQueries({ queryKey: ["contact-360"] });
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      toast({ title: "Erro ao associar contacto", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }

  // Sincronizar form
  useEffect(() => {
    if (contact) {
      const phone = contact.phone ?? "";
      const wa = contact.whatsapp_number ?? "";
      const fallbackPhone = phone || extractWaPhone(conversationPhone);
      setForm({
        company_name: contact.company_name ?? "",
        contact_name: contact.contact_name ?? "",
        phone: fallbackPhone,
        email: contact.email ?? "",
        whatsapp_number: wa || fallbackPhone,
        nif: contact.nif ?? "",
        notes: contact.notes ?? "",
      });
      setAssignedAgent("");
      setHasChanges(false);
    } else if (isNew) {
      const phone = extractWaPhone(conversationPhone) || extractWaPhone(conversationName);
      const nameIsPhone = isPhoneNumber(conversationName ?? "");
      setForm({
        company_name: nameIsPhone ? "" : (conversationName ?? ""),
        contact_name: "",
        phone,
        email: "",
        whatsapp_number: phone,
        nif: "",
        notes: "",
      });
      setHasChanges(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id, contactId, conversationName, conversationPhone]);

  const { data: agents = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const d = await directusRequest<{ data: { id: string; full_name: string; email: string }[] }>(
        "/items/employees?filter[is_active][_eq]=true&fields=id,full_name,email&limit=50"
      );
      return (d.data ?? []) as { id: string; full_name: string; email: string }[];
    },
    staleTime: 5 * 60_000,
  });

  async function handleSave() {
    setSaving(true);
    try {
      if (isNew) {
        const payload: Record<string, unknown> = {
          company_name: form.company_name || form.contact_name || form.phone,
          contact_name: form.contact_name || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          whatsapp_number: form.whatsapp_number || undefined,
          nif: form.nif || undefined,
          notes: form.notes || undefined,
          source: "inbox",
        };
        const newContact = await createContact(payload);
        const newContactId = newContact?.id ?? (newContact as any)?.data?.id;
        // Phase 1.B2: associar contacto criado à conversation de origem
        if (newContactId && conversationId) {
          try {
            await directusRequest(`/items/conversations/${encodeURIComponent(conversationId)}`, {
              method: "PATCH",
              body: JSON.stringify({ contact_id: String(newContactId) }),
            });
          } catch (linkErr) {
            console.warn("[cliente360] falhou ao associar contacto à conversation", linkErr);
          }
        }
        toast({ title: "Contacto criado!" });
        qc.invalidateQueries({ queryKey: ["contacts-directus"] });
        qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      } else {
        await patchContact(contactId, {
          company_name: form.company_name || undefined,
          contact_name: form.contact_name || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          whatsapp_number: (form.whatsapp_number || undefined) as any,
          nif: form.nif || undefined,
          notes: form.notes || undefined,
        } as any);
        toast({ title: "Dados guardados" });
        qc.invalidateQueries({ queryKey: ["contact-360", contactId] });
      }
      setHasChanges(false);
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePrivateNote() {
    if (!privateNote.trim() || !conversationId) return;
    setSavingNote(true);
    try {
      await directusRequest(`/items/conversation_notes`, {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          content: privateNote,
          type: "private",
          created_by: "crm",
        }),
      });
      // Activity Ledger — dual-write (fire-and-forget)
      import("@/integrations/directus/activities").then(({ createActivity }) =>
        createActivity({
          type: "note",
          channel: "crm",
          summary: privateNote.slice(0, 200),
          contact_id: contactId ? Number(contactId) : null,
          conversation_id: conversationId,
          source_collection: "conversation_notes",
        }).catch(() => {})
      ).catch(() => {});
      setPrivateNote("");
      toast({ title: "Nota guardada" });
    } catch (err) {
      toast({ title: "Erro ao guardar nota", description: String(err instanceof Error ? err.message : ""), variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSaveFollowUp() {
    if (!followUpDate) return;
    setSavingFollowUp(true);
    try {
      await createFollowUp({
        contact_id: contactId || undefined,
        conversation_id: conversationId || undefined,
        due_at: followUpDate,
        notes: followUpNote,
        status: "open",
      } as any);
      setFollowUpDate("");
      setFollowUpNote("");
      toast({ title: "Follow-up agendado" });
    } catch (err) {
      toast({ title: "Erro ao agendar", description: String(err instanceof Error ? err.message : ""), variant: "destructive" });
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function handleAssignAgent(agentId: string) {
    setAssignedAgent(agentId);
    if (!contactId) return;
    try {
      await directusRequest(`/items/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_employee_id: agentId }),
      });
      toast({ title: "Agente atribuído" });
    } catch (err) {
      toast({ title: "Erro ao atribuir agente", description: String(err instanceof Error ? err.message : ""), variant: "destructive" });
    }
  }

  function onMouseEnter() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(true), 200);
  }

  function onMouseLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(false), 400);
  }

  const cardUrl = contactId
    ? `/customer360-shell/${encodeURIComponent(String(contactId))}`
    : null;

  const phone = form.phone || extractWaPhone(conversationPhone);
  const wa = form.whatsapp_number || phone;

  return (
    <aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "flex shrink-0 flex-col border-l border-border bg-card",
        "transition-all duration-300 ease-in-out",
        hovered && "!w-[420px]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground leading-none">
              {isNew ? "Novo contacto" : "Cliente 360"}
            </h2>
            {isNew && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Novo
              </span>
            )}
          </div>
          {!isNew && contact && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {contact.company_name || contact.contact_name || "—"}
            </p>
          )}
        </div>
        {cardUrl && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" asChild title="Abrir Card 360 completo">
            <Link to={cardUrl}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3 space-y-0.5">

          {/* Quick associate existing contact */}
          {isNew && (
            <div className="relative mb-3 pb-2 border-b border-border">
              <div className="flex items-center rounded-md border border-border bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-primary/30">
                <Search className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar cliente existente no CRM..."
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
                {searchingContacts && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0 ml-1" />}
              </div>

              {showSearchDropdown && contactResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Clientes Encontrados:</p>
                  {contactResults.map((c) => {
                    const cName = c.company_name || c.name || c.contact_name || `Contacto #${c.id}`
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={saving}
                        onClick={() => void handleLinkExistingContact(c)}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-accent transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{cName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.phone ? `Tel: ${c.phone}` : ""} {c.nif ? `· NIF: ${c.nif}` : ""} {c.city ? `· ${c.city}` : ""}
                          </p>
                        </div>
                        <span className="ml-2 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
                          <Link2 className="h-3 w-3" /> Associar
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {!isNew && contactLoading && (
            <div className="space-y-2 pt-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {/* Ponte Comercial — Oportunidade no Funil e Proposta Rápida */}
          <div className="pt-1">
            <QuickDealAndQuotationCard
              contactId={contactId || (contact?.id ? String(contact.id) : null)}
              customerName={form.company_name || form.contact_name || conversationName}
              phone={form.phone || conversationPhone}
              email={form.email}
              notes={form.notes}
            />
          </div>

          {/* OPERAÇÕES — botões de acção rápida */}
          {conversation && (
            <Section label="Operações" open={secOps} onToggle={() => setSecOps(v => !v)}>
              <div className="space-y-1.5">
                {ops.canClose && (
                  <button
                    type="button"
                    disabled={ops.busy}
                    onClick={ops.close}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Fechar conversa
                  </button>
                )}
                {ops.canReopen && (
                  <button
                    type="button"
                    disabled={ops.busy}
                    onClick={ops.reopen}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
                  >
                    Reabrir conversa
                  </button>
                )}
                {ops.canAssume && (
                  <button
                    type="button"
                    disabled={ops.busy}
                    onClick={ops.assume}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    Assumir conversa
                  </button>
                )}
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Ligar {phone}
                  </a>
                )}
                {wa && (
                  <a
                    href={`https://wa.me/${wa.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp externo
                  </a>
                )}
                {cardUrl && (
                  <Link
                    to={cardUrl}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir CRM completo
                  </Link>
                )}
                {contactId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/orcamentos?contactId=${encodeURIComponent(contactId)}`)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Criar orçamento
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* DADOS DO CONTACTO — editável */}
          <Section label="Dados do contacto" open={secDados} onToggle={() => setSecDados(v => !v)}>
            <Field label="Empresa" id="company_name" value={form.company_name} onChange={v => setField("company_name", v)} placeholder="Nome da empresa" />
            <Field label="Nome contacto" id="contact_name" value={form.contact_name} onChange={v => setField("contact_name", v)} placeholder="Nome da pessoa" />
            <Field label="NIF" id="nif" value={form.nif} onChange={v => setField("nif", v)} placeholder="123456789" />
            <Field label="Telefone" id="phone" value={form.phone} onChange={v => setField("phone", v)} placeholder="+351..." />
            <Field label="Email" id="email" type="email" value={form.email} onChange={v => setField("email", v)} placeholder="email@empresa.pt" />
            <Field label="WhatsApp" id="whatsapp_number" value={form.whatsapp_number} onChange={v => setField("whatsapp_number", v)} placeholder="+351..." />
            <Field label="Notas" id="notes" value={form.notes} onChange={v => setField("notes", v)} placeholder="Nota sobre o cliente..." />

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (!hasChanges && !isNew)}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition mt-1",
                hasChanges || isNew
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-default",
                saving && "opacity-70",
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isNew ? "Criar contacto" : hasChanges ? "Guardar alterações" : "Dados guardados"}
            </button>
          </Section>

          {/* AGENTE */}
          <Section label="Agente responsável" open={secAgente} onToggle={() => setSecAgente(v => !v)}>
            <select
              value={assignedAgent}
              onChange={(e) => handleAssignAgent(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Sem agente —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </Section>

          {/* NOTA PRIVADA */}
          {conversationId && (
            <Section label="Nota privada conversa" open={secNota} onToggle={() => setSecNota(v => !v)}>
              <textarea
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                placeholder="Nota interna sobre esta conversa..."
                rows={3}
                className="w-full resize-none rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30 dark:border-amber-800 dark:bg-amber-950/20"
              />
              <button
                type="button"
                onClick={handleSavePrivateNote}
                disabled={!privateNote.trim() || savingNote}
                className="w-full rounded-md bg-amber-600 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40"
              >
                {savingNote ? "A guardar…" : "Guardar nota privada"}
              </button>
            </Section>
          )}

          {/* FOLLOW-UP */}
          <Section label="Follow-up" open={secFollowUp} onToggle={() => setSecFollowUp(v => !v)}>
            <input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              placeholder="Nota (opcional)"
              className="w-full rounded-md border border-input bg-muted px-2.5 py-1.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={handleSaveFollowUp}
              disabled={!followUpDate || savingFollowUp}
              className="w-full rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            >
              {savingFollowUp ? "A agendar…" : "Agendar follow-up"}
            </button>
          </Section>

          {/* HISTÓRICO */}
          {!isNew && contact && (
            <Section label="Histórico" open={secHistorico} onToggle={() => setSecHistorico(v => !v)}>
              <CustomerTimeline contactId={String(contact.id)} />
            </Section>
          )}

          {/* DOSSIÊ CONTÍNUO — vista partilhada, integrada via useCustomerDossier hook.
              Mostra timeline compacta + addNote inline + follow-up + conversão. */}
          {!isNew && contactId && (
            <Section label="Dossiê contínuo" open={secDossieContinuo} onToggle={() => setSecDossieContinuo(v => !v)}>
              <DossieContinuoHubChat contactId={contactId} />
            </Section>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
