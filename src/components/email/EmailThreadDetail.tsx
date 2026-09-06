import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { format } from "date-fns/format";
import { pt } from "date-fns/locale";
import { ArrowLeft, UserPlus, CheckCircle2, User, Copy, Bot, Reply, X, ExternalLink, ChevronDown, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEmailMessages } from "@/hooks/useEmailThreads";
import type { EmailThread, EmailMessage } from "@/hooks/useEmailThreads";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import DOMPurify from "dompurify";
import { getEmailSignature } from "@/lib/emailSignature";
import { EmailProductSuggestions } from "./EmailProductSuggestions";
import { LeadTimelineModal } from "@/components/contacts/LeadTimelineModal";
import { createInteraction } from "@/integrations/directus/interactions";
import { useMeilisearch } from "@/hooks/useMeilisearch";

/**
 * Renders email body intelligently:
 * 1. If body_html exists, render sanitized HTML (Outlook's full formatted email)
 * 2. If only body_text exists, render as plain text (fallback)
 * 3. Detects Outlook "quoted history" block (preceded by an <hr> or a
 *    <div id="divRplyFwdMsg">) and collapses it behind "Ver histórico"
 */

const QUOTE_SELECTORS = [
  // Modern Outlook desktop (Office 365 / 2019+)
  "#divRplyFwdMsg",
  // Outlook Web (OWA)
  ".moz-cite-prefix",
  // Outlook mobile
  "#mail-editor-reference-message-container",
  // Generic Gmail-style quote (often in replies)
  ".gmail_quote",
  // Generic quote class
  "blockquote[data-outlook-quote]",
];

function findQuoteStart(html: string): number {
  // Try specific selector IDs/classes first
  for (const sel of QUOTE_SELECTORS) {
    if (sel.startsWith("#")) {
      const id = sel.slice(1);
      // Outlook wraps the quoted block in <div id="divRplyFwdMsg" ...> ... </div>
      const idx = html.indexOf(`id="${id}"`);
      if (idx !== -1) return idx;
    } else {
      // class selector — find "<... class='... sel ...' ..."
      const m = html.match(new RegExp(`class=["'][^"']*\\b${sel.slice(1)}\\b`));
      if (m && m.index !== undefined) return m.index;
    }
  }
  // Outlook uses an <hr> before the "From: ... Sent: ..." quote block.
  // This is the most reliable fallback.
  const hrIdx = html.indexOf("<hr");
  if (hrIdx !== -1) {
    // Make sure the <hr> is followed by some "From:" / "Enviada:" / "De:" pattern
    const after = html.slice(hrIdx, hrIdx + 5000);
    if (/De:|From:|Enviada:|Sent:|Assunto:|Subject:/i.test(after)) return hrIdx;
  }
  return -1;
}

function findTextQuoteStart(plain: string): number {
  // Text-based detection: Outlook emails have a "From: ... Sent: ..." block
  // (in PT: "De: ... Enviada: ...") on its own line(s) before the quoted history.
  const re = /(^|\n)(\s*)(De:|From:|Enviada:|Sent:|Para:|To:|Assunto:|Subject:|Cc:|De:)\s+[A-ZÀ-Ú]/m;
  const m = plain.match(re);
  return m?.index ?? -1;
}

function stripTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function EmailBody({ message }: { message: EmailMessage }) {
  const [showQuote, setShowQuote] = useState(false);
  const rawHtml = message.body_html || "";
  const rawText = message.body_text || "";

  // ─── Case 1: has HTML — render sanitized + collapse quote ─────────
  if (rawHtml.trim().length > 0) {
    const quoteIdx = findQuoteStart(rawHtml);
    const safeHtml = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ["target"],
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    });

    if (quoteIdx > 0) {
      // Split: before-quote is HTML, quote is HTML.
      // Sanitize each half separately so DOMPurify doesn't get confused by partial tags.
      const before = DOMPurify.sanitize(safeHtml.slice(0, quoteIdx));
      const quote = DOMPurify.sanitize(safeHtml.slice(quoteIdx));
      return (
        <div className="email-content">
          <div dangerouslySetInnerHTML={{ __html: before }} />
          <button
            type="button"
            onClick={() => setShowQuote((s) => !s)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showQuote ? "rotate-180" : ""}`} />
            {showQuote ? "Ocultar histórico anterior" : "Ver histórico anterior"}
          </button>
          {showQuote && (
            <div className="mt-2 pt-2 border-t border-dashed border-border">
              <div dangerouslySetInnerHTML={{ __html: quote }} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="email-content">
        <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </div>
    );
  }

  // ─── Case 2: only plain text — try text-based quote detection ─────
  if (rawText.trim().length > 0) {
    const textQuoteIdx = findTextQuoteStart(rawText);
    if (textQuoteIdx > 0) {
      const before = rawText.slice(0, textQuoteIdx).trim();
      const quote = rawText.slice(textQuoteIdx).trim();
      return (
        <div>
          <p className="whitespace-pre-wrap">{before}</p>
          <button
            type="button"
            onClick={() => setShowQuote((s) => !s)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showQuote ? "rotate-180" : ""}`} />
            {showQuote ? "Ocultar histórico anterior" : "Ver histórico anterior"}
          </button>
          {showQuote && (
            <div className="mt-2 pt-2 border-t border-dashed border-border">
              <p className="whitespace-pre-wrap text-muted-foreground text-sm">{quote}</p>
            </div>
          )}
        </div>
      );
    }
    return <p className="whitespace-pre-wrap">{rawText}</p>;
  }

  // ─── Case 3: nothing ─────────────────────────────────────────────────
  return <p className="text-xs text-muted-foreground italic">Corpo não disponível</p>;
}


const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  pedido_orcamento:         { label: "Orçamento",     color: "bg-blue-100 text-blue-800" },
  followup_cliente:         { label: "Follow-up",     color: "bg-purple-100 text-purple-800" },
  reclamacao:               { label: "Reclamação",    color: "bg-red-100 text-red-800" },
  compra_cliente:           { label: "Compra",        color: "bg-green-100 text-green-800" },
  fornecedor_sourcing:      { label: "Sourcing",      color: "bg-orange-100 text-orange-800" },
  tabela_precos_fornecedor: { label: "Tabela preços", color: "bg-yellow-100 text-yellow-800" },
  compra_fornecedor:        { label: "Compra forn.",  color: "bg-teal-100 text-teal-800" },
  fatura_administrativo:    { label: "Fatura/Admin",  color: "bg-gray-100 text-gray-700" },
  spam:                     { label: "Spam",          color: "bg-gray-100 text-gray-400" },
  outro:                    { label: "Outro",         color: "bg-gray-100 text-gray-600" },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low:      { label: "Baixa",   color: "bg-gray-100 text-gray-500",   dot: "⚪" },
  normal:   { label: "Normal",  color: "bg-blue-50 text-blue-600",    dot: "🔵" },
  high:     { label: "Alta",    color: "bg-amber-100 text-amber-700", dot: "🟡" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-700",     dot: "🔴" },
};

const STATUS_LABELS: Record<string, string> = {
  queued:   "Na fila",
  assigned: "Assumido",
  replied:  "Respondido",
  closed:   "Fechado",
  snoozed:  "Adiado",
};

interface Props {
  thread: EmailThread;
  currentEmployeeId: number | null;
  onBack: () => void;
  onAssign: () => void;
  onClose: () => void;
  onMarkNoise?: () => void;
}

/** Secção 3: Contexto do cliente no Email (negócios abertos, propostas, interações recentes) */
function EmailClientContext({ contactId }: { contactId: number | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["email-client-context", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const [deals, quotations, interactions] = await Promise.all([
        directusRequest<{ data: any[] }>(
          `/items/deals?filter[customer_id][_eq]=${contactId}&filter[status][_nin]=perdido&sort=-date_created&limit=5&fields=id,title,status,total_amount`
        ).catch(() => ({ data: [] })),
        directusRequest<{ data: any[] }>(
          `/items/quotations?filter[customer_id][_eq]=${contactId}&filter[status][_in]=draft,sent,viewed&sort=-date_created&limit=5&fields=id,quotation_number,total_amount,status`
        ).catch(() => ({ data: [] })),
        directusRequest<{ data: any[] }>(
          `/items/interactions?filter[contact_id][_eq]=${contactId}&sort=-date_created&limit=5&fields=id,type,summary,date_created`
        ).catch(() => ({ data: [] })),
      ]);
      return {
        deals: deals.data ?? [],
        quotations: quotations.data ?? [],
        interactions: interactions.data ?? [],
      };
    },
    enabled: !!contactId,
    staleTime: 2 * 60_000,
  });

  if (!contactId || isLoading || !data) return null;
  const { deals, quotations, interactions } = data;
  if (deals.length === 0 && quotations.length === 0 && interactions.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 mb-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contexto do cliente</p>
      {deals.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Negócios abertos ({deals.length})</p>
          {deals.slice(0, 3).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between text-xs">
              <span className="text-foreground truncate">{d.title || `Negócio #${d.id}`}</span>
              <span className="text-muted-foreground">{Number(d.total_amount || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
            </div>
          ))}
        </div>
      )}
      {quotations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Propostas pendentes ({quotations.length})</p>
          {quotations.slice(0, 3).map((q: any) => (
            <div key={q.id} className="flex items-center justify-between text-xs">
              <span className="text-foreground">#{q.quotation_number || q.id}</span>
              <span className="text-muted-foreground">{q.status} · {Number(q.total_amount || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
            </div>
          ))}
        </div>
      )}
      {interactions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Últimas interações</p>
          {interactions.slice(0, 3).map((i: any) => (
            <div key={i.id} className="text-xs text-muted-foreground truncate">
              {i.type || "interação"} — {i.summary?.slice(0, 60) || new Date(i.date_created).toLocaleDateString("pt-PT")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmailThreadDetail({ thread, currentEmployeeId, onBack, onAssign, onClose, onMarkNoise }: Props) {
  const { data: messages, isLoading: messagesLoading } = useEmailMessages(thread.id);
  const { toast } = useToast();
  const { search: searchProducts } = useMeilisearch();
  const queryClient = useQueryClient();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState(thread.ai_draft || "");
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [aiBusy, setAiBusy] = useState("");
  const replyEditorRef = useRef<HTMLDivElement>(null);

  // Agent assignment
  const [agents, setAgents] = useState<Array<{ id: number; name: string }>>([]);
  const [assignedTo, setAssignedTo] = useState<number | null>(thread.assigned_to);
  const [assigning, setAssigning] = useState(false);

  // Contact lookup
  const [contact, setContact] = useState<{ id: string; company_name?: string; contact_name?: string; email?: string; phone?: string } | null>(null);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactNotFound, setContactNotFound] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [createdLeadName, setCreatedLeadName] = useState<string>("");
  const [showLeadTimeline, setShowLeadTimeline] = useState(false);
  // Fallback quando a thread não tem lead_id gravado mas o n8n já criou a lead
  // (bug conhecido: thread.lead_id continua null mesmo após o pipeline criar a lead).
  // Ver docs/gap-thread-lead-link.md
  const [existingLead, setExistingLead] = useState<{ id: string | number; display_name?: string; email?: string; lead_data?: Record<string, unknown> | null } | null>(null);
  type ExtractedContactInfo = {
    name?: string | null; company_name?: string | null; phone?: string | null;
    address?: string | null; city?: string | null; postal_code?: string | null;
    website?: string | null; request_type?: string | null; requested_items?: string | null;
    contact_role?: string | null; fullBodyText?: string;
  };
  const [preview, setPreview] = useState<ExtractedContactInfo | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const extractionRanForThread = useRef<string | null>(null);

  // Load agents from employees collection (consistent with useCurrentEmployee)
  useEffect(() => {
    directusRequest<{ data: Array<{ id: number; full_name: string; email: string }> }>(
      '/items/employees?fields=id,full_name,email&limit=50&sort=full_name'
    ).then((res) => {
      setAgents((res?.data ?? []).map((e) => ({ id: e.id, name: e.full_name || e.email })));
    }).catch(() => {});
  }, []);

  // Look up contact by from_address
  useEffect(() => {
    if (!thread.from_address) { setContactLoading(false); return; }
    const email = encodeURIComponent(thread.from_address);
    directusRequest<{ data: Array<{ id: string; company_name?: string; contact_name?: string; email?: string; phone?: string }> }>(
      `/items/contacts?filter[email][_eq]=${email}&limit=1&fields=id,company_name,contact_name,email,phone`
    ).then((res) => {
      if (res?.data?.length) { setContact(res.data[0]); setContactNotFound(false); }
      else setContactNotFound(true);
    }).catch(() => setContactNotFound(true))
      .finally(() => setContactLoading(false));
  }, [thread.from_address]);

  // Fallback: se contacto não encontrado, procura lead existente (bug #gap-thread-lead-link)
  // Prioridade 1: thread.lead_id (escrito pelo n8n em emails novos, sem ambiguidade)
  // Prioridade 2 (fallback para threads antigas sem lead_id): busca por email + sort=-date_created
  useEffect(() => {
    if (!contactNotFound || contactLoading || thread.from_address === undefined) return;

    const setLeadFromResult = (lead: { id: string | number; display_name?: string; email?: string; lead_data?: Record<string, unknown> | null } | null) => {
      if (lead) setExistingLead(lead);
    };

    // Prioridade 1: lead_id gravado na thread (sem ambiguidade)
    if (thread.lead_id) {
      directusRequest<{ data: { id: string | number; display_name?: string; email?: string; lead_data?: Record<string, unknown> | null } }>(
        `/items/leads/${thread.lead_id}?fields=id,display_name,email,lead_data`
      ).then((res) => {
        setLeadFromResult(res?.data ?? null);
      }).catch(() => { /* silently fall through to email search */ });
      return;
    }

    // Prioridade 2: busca por email (ambígua quando há várias leads com o mesmo email de teste;
    // sort=-date_created apanha a mais recente em vez de uma ao acaso)
    const email = encodeURIComponent(thread.from_address);
    directusRequest<{ data: Array<{ id: string | number; display_name?: string; email?: string; lead_data?: Record<string, unknown> | null }> }>(
      `/items/leads?filter[email][_eq]=${email}&filter[status][_neq]=discarded&sort=-date_created&limit=1&fields=id,display_name,email,lead_data`
    ).then((res) => {
      setLeadFromResult(res?.data?.[0] ?? null);
    }).catch(() => { /* silently fail — fallback apenas */ });
  }, [contactNotFound, contactLoading, thread.from_address, thread.lead_id]);

  const handleAssignAgent = async (employeeId: number | null) => {
    setAssigning(true);
    try {
      await directusRequest(`/items/email_threads/${thread.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          assigned_to: employeeId,
          assigned_at: employeeId ? new Date().toISOString() : null,
          status: employeeId ? 'assigned' : 'queued',
        }),
      });
      setAssignedTo(employeeId);
      queryClient.invalidateQueries({ queryKey: ["email-threads"] });
      queryClient.invalidateQueries({ queryKey: ["email-threads-unassigned-count"] });
      toast({ title: employeeId ? 'Agente atribuído' : 'Atribuição removida' });
    } catch {
      toast({ title: 'Erro ao atribuir', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  const extractContactInfo = async (): Promise<ExtractedContactInfo> => {
    let extracted: ExtractedContactInfo = {};
    let fullBodyText = "";
    try {
      fullBodyText = (messages ?? []).filter((m) => m.direction === "inbound").pop()?.body_text || "";
      const text = fullBodyText.slice(0, 2000);
      if (text) {
        const { generateWithAI } = await import("@/integrations/ai/anthropicClient");
        const raw = await generateWithAI(
          `Deste email, extrai (1) os dados de contacto de QUEM O ENVIOU (nunca da Hotelequip, que é quem recebe), (2) o que a pessoa pretende, e (3) que tipo de relação tem esta pessoa com a Hotelequip. Devolve APENAS um objeto JSON válido, sem explicação nem markdown, com estas chaves (usa null se não encontrares): name (nome COMPLETO da pessoa — a linha inteira do nome próprio, sem cortar palavras), company_name (nome da empresa/entidade — a linha seguinte, o nome comercial; NUNCA misturar palavras da linha do nome com a linha da empresa nem vice-versa), phone (telefone), address (morada completa), city (localidade), postal_code (código postal), website, request_type (um de: "orcamento", "encomenda", "proposta", "reclamacao", "assistencia_tecnica", "informacao", "outro"), requested_items (lista curta e objetiva, separada por vírgulas, dos equipamentos/produtos/serviços mencionados — texto livre, não JSON aninhado), contact_role (um de: "cliente" — está a pedir/comprar algo à Hotelequip; "fornecedor" — está a vender/oferecer algo à Hotelequip, ex: envia fatura, catálogo, proposta de fornecimento; "parceiro"; ou null se não for claro).

Regra crítica para name/company_name: se a assinatura tem uma linha com o nome da pessoa e outra linha com o nome da empresa, cada campo recebe a sua linha COMPLETA. Exemplo: "João Teste Sprint\nRestaurante Teste Lda" → name="João Teste Sprint", company_name="Restaurante Teste Lda". NUNCA partir palavras entre os dois campos.

Email:
"""${text}"""`
        );
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
      }
    } catch { /* IA indisponível — segue com o fallback no momento da criação */ }
    return { ...extracted, fullBodyText };
  };

  // Corre a extração automaticamente assim que se confirma que o remetente
  // não tem contacto associado — mostra logo uma pré-visualização em vez de
  // exigir um clique "às cegas". Só corre uma vez por thread.
  // ⚠️ Não faz extract se já existe uma lead (fallback funcionou).
  useEffect(() => {
    if (!contactNotFound || contactLoading || existingLead) return;
    if (extractionRanForThread.current === thread.id) return;
    extractionRanForThread.current = thread.id;
    setPreviewLoading(true);
    extractContactInfo()
      .then((result) => setPreview(result))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactNotFound, contactLoading, existingLead, thread.id]);

  const createContactFromExtraction = async (extracted: ExtractedContactInfo) => {
    setCreating(true);
    try {
      const fullBodyText = extracted.fullBodyText || "";
      const fallbackNome = thread.from_address.split('@')[0].replace(/[._-]/g, ' ');
      const companyName = extracted.company_name || extracted.name || fallbackNome;
      const contactName = extracted.name && extracted.name !== companyName ? extracted.name : undefined;

      // Regra uniforme: primeiro contacto → cria LEAD (não contacto directo)
      // Promover a contacto é acção explícita posterior (página /leads)
      const leadPayload: Record<string, unknown> = {
        display_name: companyName,
        email: thread.from_address,
        phone: extracted.phone || undefined,
        source: 'email',
        status: 'incoming',
        // Campos de topo — é daqui que Leads.tsx e LeadPopup360 leem directamente
        // (confirmado no schema: city/postal_code/website existem como colunas
        // reais em "leads"; "address" não existe a esse nível, só em lead_data).
        city: extracted.city || undefined,
        postal_code: extracted.postal_code || undefined,
        website: extracted.website || undefined,
        notes: (() => {
          const parts: string[] = [];
          if (extracted.request_type) parts.push(`Tipo: ${extracted.request_type}`);
          if (extracted.requested_items) parts.push(`Itens: ${extracted.requested_items}`);
          if (extracted.contact_role) parts.push(`Papel: ${extracted.contact_role}`);
          return parts.length > 0 ? parts.join(' | ') : undefined;
        })(),
        lead_data: {
          company_name: extracted.company_name || companyName || undefined,
          contact_name: contactName || undefined,
          phone: extracted.phone || undefined,
          address: extracted.address || undefined,
          city: extracted.city || undefined,
          postal_code: extracted.postal_code || undefined,
          website: extracted.website || undefined,
          contact_role: extracted.contact_role || undefined,
          request_type: extracted.request_type || undefined,
          requested_items: extracted.requested_items || undefined,
          email_thread_id: thread.id,
          subject: thread.subject || undefined,
        },
      };

      const res = await directusRequest<{ data: { id: string; display_name?: string; email?: string } }>('/items/leads', {
        method: 'POST',
        body: JSON.stringify(leadPayload),
      });
      const created = res?.data;
      if (created) {
        // Marcar como lead criado (não contacto) — UI mostra badge diferente
        setCreatedLeadId(String(created.id));
        setCreatedLeadName(companyName || thread.from_address);
        setContactNotFound(false);
        toast({ title: 'Lead criado', description: 'Promover a contacto na página de Leads quando confirmado.' });
      }
    } catch {
      toast({ title: 'Erro ao criar lead', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Botão manual (fallback): usa a pré-visualização já calculada se existir,
  // ou extrai na hora se por algum motivo ainda não tiver corrido.
  const handleCreateContact = async () => {
    const extracted = preview ?? await extractContactInfo();
    await createContactFromExtraction(extracted);
  };

  const urgency = URGENCY_CONFIG[thread.urgency] ?? URGENCY_CONFIG.normal;
  const category = CATEGORY_CONFIG[thread.category];

  const slaExceeded = thread.sla_due_at &&
    thread.status !== "replied" && thread.status !== "closed" &&
    new Date(thread.sla_due_at).getTime() < Date.now();

  const timeAgo = thread.date_created
    ? formatDistanceToNow(new Date(thread.date_created), { locale: pt, addSuffix: true })
    : "";

  const canAssign =
    !thread.assigned_to ||
    thread.assigned_to !== currentEmployeeId;
  const timelineLeadId = existingLead?.id ? Number(existingLead.id) : createdLeadId ? Number(createdLeadId) : null;
  const timelineLeadName = existingLead?.display_name || existingLead?.email || createdLeadName || "Lead";

  const copyDraft = async () => {
    if (!thread.ai_draft) return;
    try {
      await navigator.clipboard.writeText(thread.ai_draft);
      toast({ title: "Copiado", description: "Rascunho copiado para a área de transferência" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="border-b pb-4 mb-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 h-7 px-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
          <span className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium", urgency.color)}>
            {urgency.dot} {urgency.label}
          </span>
          {/* Category badge — click to recategorize */}
          <select
            value={thread.category || ""}
            onChange={async (e) => {
              try {
                await directusRequest(`/items/email_threads/${thread.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ category: e.target.value }),
                });
                toast({ title: "Categoria atualizada" });
              } catch { toast({ title: "Erro", variant: "destructive" }); }
            }}
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium border-0 cursor-pointer appearance-none pr-4",
              category?.color || "bg-gray-100 text-gray-600"
            )}
          >
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <span className={cn(
            "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
            thread.status === "queued" ? "bg-amber-100 text-amber-700" :
            thread.status === "assigned" ? "bg-blue-100 text-blue-700" :
            thread.status === "replied" ? "bg-green-100 text-green-700" :
            "bg-gray-100 text-gray-600"
          )}>
            {STATUS_LABELS[thread.status] ?? thread.status}
          </span>
          {thread.status !== "closed" && onMarkNoise && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 px-2 ml-auto"
              onClick={onMarkNoise}
              title="Marcar como Ruído/Spam e arquivar"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Ruído
            </Button>
          )}
        </div>

        {/* Agent assignment + Contact */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Agent selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Atribuído a:</span>
            <select
              value={assignedTo ?? ''}
              onChange={(e) => handleAssignAgent(e.target.value ? Number(e.target.value) : null)}
              disabled={assigning}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Sem atribuição</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {assignedTo && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {agents.find((a) => a.id === assignedTo)?.name?.charAt(0) || '?'}
              </span>
            )}
          </div>

          <span className="text-border">·</span>

          {/* Contact */}
          {contactLoading ? (
            <span className="text-muted-foreground">A verificar contacto…</span>
          ) : createdLeadId ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">Lead registado</span>
              <span className="font-medium text-foreground">{createdLeadName}</span>
              <button
                type="button"
                onClick={() => setShowLeadTimeline(true)}
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                Ver <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : contact ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">Contacto existente</span>
              <span className="font-medium text-foreground">{contact.company_name || contact.contact_name || contact.email}</span>
              <a href={`/customer360-shell/${contact.id}`} className="inline-flex items-center gap-0.5 text-primary hover:underline">
                Ver <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : existingLead ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">Lead já criada</span>
              <span className="font-medium text-foreground">{existingLead.display_name || existingLead.email}</span>
              <button
                type="button"
                onClick={() => setShowLeadTimeline(true)}
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                Ver <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : contactNotFound ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">Contacto desconhecido</span>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1" onClick={handleCreateContact} disabled={creating}>
                {creating ? 'A extrair e criar…' : (<>✨ Criar contacto</>)}
              </Button>
            </div>
          ) : null}
        </div>

        <h2 className="text-lg font-semibold">{thread.subject || "(sem assunto)"}</h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>De: <strong className="text-foreground">{thread.from_address}</strong></span>
          <span>→ {thread.to_address}</span>
          <span>Entrou {timeAgo}</span>
          {thread.sla_due_at && (
            <span className={cn(slaExceeded && "text-red-600 font-semibold")}>
              SLA: {format(new Date(thread.sla_due_at), "HH:mm", { locale: pt })}
              {slaExceeded && " ⚠️ excedido"}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable middle region: tudo o que cresce a conteúdo entre o header
          e a action bar deve viver dentro deste wrapper, senao empurra a barra
          de accoes para fora da janela (sintoma: rect.top ~4168px num
          window.innerHeight ~993px). */}
      <div className="flex-1 min-h-0 overflow-auto space-y-3 mb-4">

      {/* Pré-visualização automática de dados de contacto (email sem contacto associado) */}
      {contactNotFound && !contact && !previewDismissed && (previewLoading || preview) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 mb-4">
          <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-amber-800">
            ✨ {previewLoading ? "A analisar email…" : "Detectámos"}
          </div>
          {previewLoading ? (
            <p className="text-sm text-amber-900/70">A extrair dados de contacto e pedido do email…</p>
          ) : preview ? (
            <div className="space-y-1 text-sm text-amber-900/90 mb-3">
              {(preview.name || preview.company_name) && (
                <p><strong>{preview.name || preview.company_name}</strong>{preview.name && preview.company_name && preview.name !== preview.company_name ? ` · ${preview.company_name}` : ""}</p>
              )}
              <p className="flex flex-wrap gap-x-3 text-xs text-amber-800/80">
                {preview.phone && <span>📞 {preview.phone}</span>}
                {preview.address && <span>🏠 {preview.address}</span>}
                {preview.city && <span>📍 {preview.city}{preview.postal_code ? ` ${preview.postal_code}` : ""}</span>}
                {preview.contact_role && <span>🏷️ {preview.contact_role === 'cliente' ? 'Cliente' : preview.contact_role === 'fornecedor' ? 'Fornecedor' : 'Parceiro'}</span>}
              </p>
              {preview.requested_items && (
                <p className="text-xs text-amber-800/80">🛒 {preview.requested_items}</p>
              )}
            </div>
          ) : null}
          {!previewLoading && (
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 h-7 text-xs" disabled={creating} onClick={() => preview && createContactFromExtraction(preview)}>
                {creating ? 'A criar…' : 'Aceitar e criar contacto'}
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs" onClick={() => setPreviewDismissed(true)}>
                Ignorar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* AI Draft */}
      {thread.ai_draft && !showReply && (
        <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 mb-4">
          <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-teal-800">
            <Bot className="h-4 w-4" />
            Rascunho sugerido pela IA
          </div>
          <pre className="whitespace-pre-wrap text-sm font-mono text-teal-900/80 mb-3">
            {thread.ai_draft}
          </pre>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => { setReplyText(thread.ai_draft || ""); setShowReply(true); }}>
              Usar como resposta
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs" onClick={copyDraft}>
              <Copy className="h-3 w-3" /> Copiar
            </Button>
          </div>
        </div>
      )}

      {/* Product suggestions for quotation requests */}
      {(thread as Record<string, unknown>).category === "pedido_orcamento" && (
        <EmailProductSuggestions
          subject={thread.subject}
          bodyText={(messages ?? []).filter(m => m.direction === "inbound").pop()?.body_text || ""}
          contactId={thread.contact_id}
          contactName={contact?.contact_name || (existingLead?.lead_data?.contact_name as string | undefined)}
          contactCompany={contact?.company_name || (existingLead?.lead_data?.company_name as string | undefined) || existingLead?.display_name || undefined}
          contactEmail={contact?.email || thread.from_address || undefined}
          contactPhone={contact?.phone || (existingLead?.lead_data?.phone as string | undefined)}
          threadId={thread.id}
          requestedItems={existingLead?.lead_data?.requested_items as string | undefined}
        />
      )}

      {/* Secção 3: Contexto do cliente — negócios, propostas, interações */}
      {thread.contact_id && <EmailClientContext contactId={thread.contact_id} />}

      {/* Messages */}
      {messagesLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">A carregar mensagens…</p>
      ) : (messages ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sem mensagens</p>
      ) : (
        (messages ?? []).map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}

      </div>

      {/* Reply panel — full-featured with AI + attachments */}
      {showReply && (
        <div className="border-t bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Responder a {thread.from_address}</span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowReply(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* AI action bar */}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!!aiBusy}
              onClick={async () => {
                setAiBusy("suggest");
                try {
                  const { aiSuggestReply } = await import("@/integrations/ai/emailAssistant");
                  const { getEmailSignature } = await import("@/lib/emailSignature");
                  const result = await aiSuggestReply({
                    incoming: (messages ?? []).filter(m => m.direction === "inbound").pop()?.body_text || "",
                    subject: thread.subject,
                    customerName: thread.from_address,
                    category: (thread as Record<string, unknown>).category as string,
                  });
                  const html = result.replace(/\n/g, "<br>") + "<br><br>" + getEmailSignature();
                  setReplyText(html);
                  if (replyEditorRef.current) replyEditorRef.current.innerHTML = html;
                } catch { toast({ title: "IA indisponível", variant: "destructive" }); }
                setAiBusy("");
              }}>
              {aiBusy === "suggest" ? "..." : "✨"} Sugerir resposta
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!!aiBusy || !replyText.trim()}
              onClick={async () => {
                setAiBusy("improve");
                try {
                  const { aiImprove } = await import("@/integrations/ai/emailAssistant");
                  // Only improve the text BEFORE the signature
                  const { getEmailSignature } = await import("@/lib/emailSignature");
                  const sig = getEmailSignature();
                  const textWithoutSig = replyText.replace(sig, "").trim();
                  const result = await aiImprove({ draft: textWithoutSig, subject: thread.subject });
                  const html = result.replace(/\n/g, "<br>") + "<br><br>" + sig;
                  setReplyText(html);
                  if (replyEditorRef.current) replyEditorRef.current.innerHTML = html;
                } catch { toast({ title: "IA indisponível", variant: "destructive" }); }
                setAiBusy("");
              }}>
              {aiBusy === "improve" ? "..." : "✨"} Melhorar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!!aiBusy || !replyText.trim()}
              onClick={async () => {
                setAiBusy("translate");
                try {
                  const { aiTranslate } = await import("@/integrations/ai/emailAssistant");
                  const { getEmailSignature } = await import("@/lib/emailSignature");
                  const sig = getEmailSignature();
                  const textWithoutSig = replyText.replace(sig, "").trim();
                  const result = await aiTranslate({ draft: textWithoutSig, subject: thread.subject }, "inglês");
                  const html = result.replace(/\n/g, "<br>") + "<br><br>" + sig;
                  setReplyText(html);
                  if (replyEditorRef.current) replyEditorRef.current.innerHTML = html;
                } catch { toast({ title: "IA indisponível", variant: "destructive" }); }
                setAiBusy("");
              }}>
              {aiBusy === "translate" ? "..." : "🌐"} Traduzir EN
            </Button>
          </div>

          {/* Rich text editor toolbar */}
          <div className="flex gap-1 border rounded-t-md bg-muted/30 px-2 py-1">
            <button type="button" onClick={() => { document.execCommand("bold"); replyEditorRef.current?.focus(); }} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs font-bold" title="Negrito">B</button>
            <button type="button" onClick={() => { document.execCommand("italic"); replyEditorRef.current?.focus(); }} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs italic" title="Itálico">I</button>
            <button type="button" onClick={() => { document.execCommand("underline"); replyEditorRef.current?.focus(); }} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs underline" title="Sublinhado">U</button>
            <span className="w-px h-4 bg-border mx-1 self-center" />
            <button type="button" onClick={() => { document.execCommand("insertUnorderedList"); replyEditorRef.current?.focus(); }} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs" title="Lista">•</button>
            <button type="button" onClick={() => { const url = prompt("URL:"); if (url) document.execCommand("createLink", false, url); replyEditorRef.current?.focus(); }} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs text-blue-600" title="Link">🔗</button>
          </div>
          <div
            ref={replyEditorRef}
            contentEditable
            onInput={() => setReplyText(replyEditorRef.current?.innerHTML || "")}
            className="min-h-[120px] w-full rounded-b-md border border-t-0 border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            dangerouslySetInnerHTML={{ __html: replyText }}
          />

          {/* Attachments */}
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" multiple className="hidden" id="reply-attach" onChange={(e) => {
              if (e.target.files) setReplyAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
            }} />
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => document.getElementById("reply-attach")?.click()}>
              📎 Anexar
            </Button>
            {replyAttachments.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5">
                {f.name}
                <button type="button" onClick={() => setReplyAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground">×</button>
              </span>
            ))}
          </div>

          {/* Send */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const { directusRequest: dr } = await import("@/integrations/directus/client");
                  const { DIRECTUS_URL } = await import("@/integrations/directus/client");
                  // Upload attachments
                  const uploaded: { file: string; filename: string }[] = [];
                  for (const file of replyAttachments) {
                    const fd = new FormData(); fd.append("file", file, file.name);
                    const r = await fetch(`${DIRECTUS_URL}/files`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("directus_access_token") || ""}` }, body: fd });
                    if (r.ok) { const d = await r.json(); if (d?.data?.id) uploaded.push({ file: d.data.id, filename: file.name }); }
                  }
                  // replyText is already HTML from contentEditable
                  const bodyHtml = replyText;
                  // Fix #1: passar inReplyToMessageId para manter a thread no Outlook
                  const lastInbound = (messages ?? []).filter(m => m.direction === "inbound").pop();
                  const inReplyToMessageId = (lastInbound as any)?.external_message_id || undefined;
                  await dr("/email-send", {
                    method: "POST",
                    body: JSON.stringify({
                      mailbox: thread.mailbox || "geral",
                      to: thread.from_address,
                      subject: `RE: ${thread.subject || ""}`,
                      bodyHtml,
                      threadIdExt: thread.id,
                      inReplyToMessageId,
                      ...(uploaded.length > 0 ? { attachments: uploaded } : {}),
                    }),
                  });
                  toast({ title: "Resposta enviada", description: `Para ${thread.from_address}` });
                  setReplyText("");
                  setReplyAttachments([]);
                  setShowReply(false);
                } catch (err) {
                  toast({ title: "Erro ao enviar", description: String((err as Error)?.message || ""), variant: "destructive" });
                }
              }}
              disabled={!replyText.trim()}
              className="gap-1.5"
            >
              <Reply className="h-3.5 w-3.5" />
              Enviar resposta
            </Button>
            <span className="text-xs text-muted-foreground">Envio real via Microsoft Graph</span>
          </div>
        </div>
      )}

      {/* Action buttons — sempre visíveis no fundo do painel */}
      <div className="border-t pt-3 flex items-center gap-2 flex-wrap bg-card z-10 pb-3 shrink-0">
        {thread.status !== "closed" && (
          <Button size="sm" className="gap-1.5" onClick={() => { { const html = (thread.ai_draft || "").replace(/\n/g, "<br>") + "<br><br>" + getEmailSignature(); setReplyText(html); setShowReply(true); setTimeout(() => { if (replyEditorRef.current) replyEditorRef.current.innerHTML = html; }, 50); } }}>
            <Reply className="h-3.5 w-3.5" />
            Responder
          </Button>
        )}
        {currentEmployeeId && canAssign && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onAssign}>
            <UserPlus className="h-3.5 w-3.5" />
            Assumir
          </Button>
        )}
        {thread.status !== "closed" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onClose}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Marcar resolvido
          </Button>
        )}
        {thread.status !== "closed" && onMarkNoise && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            onClick={onMarkNoise}
            title="Marcar como Ruído/Spam e arquivar"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Marcar Ruído
          </Button>
        )}
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            const params = new URLSearchParams();
            if (thread.contact_id) params.set("customer_id", String(thread.contact_id));
            params.set("notes", `Email: ${thread.subject || ""} (de ${thread.from_address})`);
            window.open(`/propostas/nova?${params.toString()}`, "_blank", "noopener");
          }}
        >
          📄 Criar Proposta
        </Button>
        {thread.contact_id && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 ml-auto"
            onClick={() => window.location.href = `/customer360-shell/${thread.contact_id}`}
          >
            <User className="h-3.5 w-3.5" />
            Ver contacto
          </Button>
        )}
      </div>

      {timelineLeadId && (
        <LeadTimelineModal
          open={showLeadTimeline}
          onClose={() => setShowLeadTimeline(false)}
          leadId={timelineLeadId}
          leadName={timelineLeadName}
          leadData={existingLead?.lead_data ?? null}
        />
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: EmailMessage }) {
  const isInbound = message.direction === "inbound";
  const isDraft = message.is_draft;
  const timestamp = message.received_at || message.sent_at;

  return (
    <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg p-3 text-sm",
          isDraft
            ? "bg-yellow-50 border border-yellow-200"
            : isInbound
              ? "bg-muted"
              : "bg-teal-50 border border-teal-100"
        )}
      >
        {isDraft && (
          <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 mb-1">
            Rascunho
          </span>
        )}
        {!isDraft && (
          <span className={cn(
            "inline-flex rounded px-1.5 py-0.5 text-xs font-medium mb-1",
            isInbound ? "bg-muted text-foreground" : "bg-teal-100 text-teal-800"
          )}>
            {isInbound ? "Recebido" : "Enviado"}
          </span>
        )}
        <p className="text-xs text-muted-foreground mb-1">{message.from_address}</p>
        {/* Attachments — above body for visibility */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
            {message.attachments.map((att, i) => (
              <button
                key={i}
                type="button"
                onClick={async () => {
                  if (!att.file) return;
                  try {
                    const url = `${import.meta.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt"}/assets/${att.file}`;
                    const token = localStorage.getItem("directus_access_token") || "";
                    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = att.filename || "anexo";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                  } catch {
                    window.open(`${import.meta.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt"}/assets/${att.file}`, "_blank");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-card dark:bg-blue-950/40 px-3 py-1.5 text-xs font-medium text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer shadow-sm"
              >
                <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>{att.filename || "Anexo"}</span>
                {att.size ? <span className="text-blue-500 dark:text-blue-400">({Math.round(att.size / 1024)}KB)</span> : null}
              </button>
            ))}
          </div>
        )}
        <EmailBody message={message} />
        {timestamp && (
          <p className="text-xs text-muted-foreground mt-2">
            {format(new Date(timestamp), "dd/MM/yyyy HH:mm", { locale: pt })}
          </p>
        )}
      </div>
    </div>
  );
}
