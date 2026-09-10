import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { format } from "date-fns/format";
import { pt } from "date-fns/locale";
import { ArrowLeft, UserPlus, CheckCircle2, User, Copy, Bot, Reply, X, ExternalLink, ChevronDown, ShieldAlert, Image as ImageIcon, Link as LinkIcon, Edit3, Phone, Building2, Mail, MapPin, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { extractContactHeuristics } from "@/lib/emailContactExtraction";
import { buildContactCreationUrl } from "@/lib/buildContactCreationUrl";
import { RefreshCw } from "lucide-react";

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

function resolveEmailHtmlImages(
  rawHtml: string,
  attachments?: { file: string; filename: string; mimetype?: string; size?: number }[] | null
): string {
  if (!rawHtml) return "";
  const directusUrl = import.meta.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt";

  // Filtrar anexos que correspondam a ficheiros de imagem
  const imageAttachments = (attachments || []).filter((att) => {
    if (!att.file) return false;
    const fn = (att.filename || "").toLowerCase();
    const mt = (att.mimetype || "").toLowerCase();
    return (
      mt.startsWith("image/") ||
      fn.endsWith(".png") ||
      fn.endsWith(".jpg") ||
      fn.endsWith(".jpeg") ||
      fn.endsWith(".gif") ||
      fn.endsWith(".webp") ||
      fn.endsWith(".bmp")
    );
  });

  let processedHtml = rawHtml;

  // 1. Mapeamento por nome de ficheiro exato ou parcial na referência cid:
  imageAttachments.forEach((att) => {
    const fileUrl = `${directusUrl}/assets/${att.file}`;
    const cleanFn = (att.filename || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (cleanFn) {
      const regex = new RegExp(`src=["']cid:[^"']*?${cleanFn}[^"']*?["']`, "gi");
      processedHtml = processedHtml.replace(regex, `src="${fileUrl}"`);
    }
  });

  // 2. Mapeamento sequencial para CIDs residuais (ex: Outlook gera UUIDs aleatórios no CID)
  let imgIdx = 0;
  processedHtml = processedHtml.replace(/src=["']cid:([^"']+)["']/gi, (match) => {
    if (imgIdx < imageAttachments.length) {
      const fileUrl = `${directusUrl}/assets/${imageAttachments[imgIdx].file}`;
      imgIdx++;
      return `src="${fileUrl}"`;
    }
    return match;
  });

  return processedHtml;
}

function EmailBody({ message }: { message: EmailMessage }) {
  const [showQuote, setShowQuote] = useState(false);
  const rawHtml = message.body_html || "";
  const rawText = message.body_text || "";

  // ─── Case 1: has HTML — render sanitized + collapse quote ─────────
  if (rawHtml.trim().length > 0) {
    const resolvedHtml = resolveEmailHtmlImages(rawHtml, message.attachments);
    const quoteIdx = findQuoteStart(resolvedHtml);
    const domPurifyOptions = {
      ADD_TAGS: ["img"],
      ADD_ATTR: ["src", "alt", "title", "width", "height", "style", "target", "loading", "class"],
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    };
    const safeHtml = DOMPurify.sanitize(resolvedHtml, domPurifyOptions);

    if (quoteIdx > 0) {
      const before = DOMPurify.sanitize(safeHtml.slice(0, quoteIdx), domPurifyOptions);
      const quote = DOMPurify.sanitize(safeHtml.slice(quoteIdx), domPurifyOptions);
      return (
        <div className="email-content [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_img]:shadow-sm">
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
      <div className="email-content [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_img]:shadow-sm">
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
    nif?: string | null; razao_social?: string | null; iban?: string | null;
    address?: string | null; city?: string | null; postal_code?: string | null;
    website?: string | null; request_type?: string | null; requested_items?: string | null;
    contact_role?: string | null; fullBodyText?: string;
  };
  const [preview, setPreview] = useState<ExtractedContactInfo | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const extractionRanForThread = useRef<string | null>(null);

  // Modal de edição manual de dados antes de criar Lead
  const [isEditContactOpen, setIsEditContactOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    company_name: string;
    phone: string;
    city: string;
    nif: string;
    requested_items: string;
  }>({ name: "", company_name: "", phone: "", city: "", nif: "", requested_items: "" });

  // Modal de associar a cliente existente
  const [isLinkContactOpen, setIsLinkContactOpen] = useState(false);
  const [searchContactQuery, setSearchContactQuery] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<Array<{ id: string | number; company_name?: string; contact_name?: string; email?: string; phone?: string }>>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [linkingContact, setLinkingContact] = useState(false);

  // Limpeza e reset imediato de todos os estados locais ao mudar de thread/email
  // Impede que dados de um remetente anterior (nome, preview, rascunhos) vazem para o novo email
  useEffect(() => {
    setContact(null);
    setContactLoading(true);
    setContactNotFound(false);
    setExistingLead(null);
    setCreatedLeadId(null);
    setCreatedLeadName("");
    setPreview(null);
    setPreviewLoading(false);
    setPreviewDismissed(false);
    setShowReply(false);
    setReplyText(thread.ai_draft || "");
    setAssignedTo(thread.assigned_to);
    setIsEditContactOpen(false);
    setIsLinkContactOpen(false);
    extractionRanForThread.current = null;
  }, [thread.id]);

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

    const setLeadFromResult = (lead: any | null) => {
      if (lead) {
        setExistingLead(lead);
        const ld = (lead.lead_data || {}) as Record<string, unknown>;
        const personName = (ld.contact_name as string) || lead.contact_name || lead.display_name || null;
        const phone = (ld.phone as string) || lead.contact_phone || lead.phone || null;
        const mobilePhone = (ld.mobile_phone as string) || lead.mobile_phone || null;
        const city = (ld.city as string) || lead.city || null;
        const postalCode = (ld.postal_code as string) || lead.postal_code || null;
        const address = (ld.address as string) || lead.address || null;
        const nif = (ld.nif as string) || lead.nif || null;
        const companyName = (ld.company_name as string) || (personName && lead.display_name && lead.display_name !== personName ? lead.display_name : null);

        // Se a lead existente na base de dados tiver lacunas (ex: sem morada, sem cidade ou sem nome de pessoa),
        // analisa a assinatura do email atual para preencher o que falta
        const inboundMsgs = (messages ?? []).filter((m) => m.direction === "inbound");
        const msgText = inboundMsgs.length > 0 ? inboundMsgs[inboundMsgs.length - 1]?.body_text || "" : "";
        const fromSign = msgText ? extractContactHeuristics(msgText, thread.from_address, thread.subject || "") : {};

        const finalName = (personName && personName !== lead.display_name) ? personName : (fromSign.name || personName);
        const finalCompany = companyName || fromSign.company_name || lead.display_name || null;
        const finalPhone = phone || fromSign.phone || null;
        const finalAddress = address || fromSign.address || null;
        const finalCity = city || fromSign.city || null;
        const finalPostalCode = postalCode || fromSign.postal_code || null;
        const finalNif = nif || fromSign.nif || null;

        // Preenche o preview imediatamente com os dados enriquecidos
        setPreview({
          name: finalName,
          company_name: finalCompany,
          razao_social: (ld.razao_social as string) || fromSign.razao_social || null,
          nif: finalNif,
          phone: mobilePhone ? `${finalPhone || ''} / ${mobilePhone}`.trim().replace(/^\/|\/$/g, '') : finalPhone,
          address: finalAddress,
          city: finalCity,
          postal_code: finalPostalCode,
          requested_items: (ld.requested_items as string) || fromSign.requested_items || lead.notes || null,
          contact_role: (ld.contact_role as string) || fromSign.contact_role || null,
          request_type: (ld.request_type as string) || fromSign.request_type || null,
        });

        // Se encontrámos dados adicionais que não estavam na Lead, atualiza a Lead em background
        if (lead.id && (!lead.contact_name || !lead.city || !lead.address) && (fromSign.name || fromSign.city || fromSign.address || fromSign.phone)) {
          const patchPayload: Record<string, unknown> = {};
          if (!lead.contact_name && fromSign.name) patchPayload.contact_name = fromSign.name;
          if (!lead.city && fromSign.city) patchPayload.city = fromSign.city;
          if (!lead.postal_code && fromSign.postal_code) patchPayload.postal_code = fromSign.postal_code;
          if (!lead.address && fromSign.address) patchPayload.address = fromSign.address;
          if (!lead.contact_phone && fromSign.phone) patchPayload.contact_phone = fromSign.phone;
          if (Object.keys(patchPayload).length > 0) {
            directusRequest(`/items/leads/${lead.id}`, {
              method: 'PATCH',
              body: JSON.stringify(patchPayload),
            }).catch(() => {});
          }
        }
      }
    };

    const LEAD_FIELDS = 'id,display_name,email,contact_name,contact_phone,mobile_phone,city,postal_code,address,nif,notes,lead_data';

    // Prioridade 1: lead_id gravado na thread (sem ambiguidade)
    if (thread.lead_id) {
      directusRequest<{ data: any }>(
        `/items/leads/${thread.lead_id}?fields=${LEAD_FIELDS}`
      ).then((res) => {
        setLeadFromResult(res?.data ?? null);
      }).catch(() => { /* silently fall through to email search */ });
      return;
    }

    // Prioridade 2: busca por email (com todos os campos preenchidos)
    const email = encodeURIComponent(thread.from_address);
    directusRequest<{ data: Array<any> }>(
      `/items/leads?filter[email][_eq]=${email}&filter[status][_neq]=discarded&sort=-date_created&limit=1&fields=${LEAD_FIELDS}`
    ).then((res) => {
      if (res?.data?.[0]) {
        setLeadFromResult(res.data[0]);
      } else {
        // Prioridade 3: Correlação por domínio corporativo (ex: everton.henn@zenithcaffe.pt encontra lead compras@zenithcaffe.pt)
        const domain = thread.from_address.split("@")[1]?.toLowerCase();
        const genericDomains = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "sapo.pt", "live.com", "icloud.com"];
        if (domain && !genericDomains.includes(domain)) {
          directusRequest<{ data: Array<any> }>(
            `/items/leads?filter[email][_ends_with]=@${encodeURIComponent(domain)}&filter[status][_neq]=discarded&sort=-date_created&limit=1&fields=${LEAD_FIELDS}`
          ).then((domainRes) => {
            if (domainRes?.data?.[0]) {
              setLeadFromResult(domainRes.data[0]);
            }
          }).catch(() => {});
        }
      }
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

  const extractContactInfo = async (forceRefresh = false): Promise<ExtractedContactInfo> => {
    // 1. Se a lead já existe na base de dados, usa os dados existentes e NUNCA chama a IA novamente
    if (existingLead && !forceRefresh) {
      const ld = (existingLead.lead_data || {}) as Record<string, unknown>;
      return {
        name: (ld.contact_name as string) || (existingLead as any).contact_name || existingLead.display_name || null,
        company_name: (ld.company_name as string) || null,
        phone: (ld.phone as string) || (existingLead as any).contact_phone || null,
        city: (ld.city as string) || (existingLead as any).city || null,
        postal_code: (ld.postal_code as string) || (existingLead as any).postal_code || null,
        address: (ld.address as string) || (existingLead as any).address || null,
        nif: (ld.nif as string) || (existingLead as any).nif || null,
        requested_items: (ld.requested_items as string) || (existingLead as any).notes || null,
        request_type: (ld.request_type as string) || null,
      };
    }

    // 2. Cache local por thread: se este email já foi analisado antes, devolve da cache (0ms, 0 chamadas à IA)
    const cacheKey = `crm_email_extracted_${thread.id}`;
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch { /* ignorar */ }
    }

    let fullBodyText = "";
    // 3. Obter o texto do email recebido (inbound) ou primeiro email da thread
    const inboundMsgs = (messages ?? []).filter((m) => m.direction === "inbound");
    const targetMsg = inboundMsgs.length > 0 ? inboundMsgs[inboundMsgs.length - 1] : (messages ?? [])[0];

    fullBodyText = targetMsg?.body_text || "";
    // Se body_text estiver vazio, converte o body_html para texto simples
    if (!fullBodyText.trim() && targetMsg?.body_html) {
      fullBodyText = targetMsg.body_html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    // 4. Executar extração heurística instantânea (0ms, infalível para telefones, moradas, CP e assinaturas)
    const heuristic = extractContactHeuristics(fullBodyText, thread.from_address, thread.subject || "");
    let extracted: ExtractedContactInfo = { ...heuristic, fullBodyText };

    // 5. Tentar enriquecer com IA se o texto existir
    try {
      let text = fullBodyText;
      if (fullBodyText.length > 5000) {
        text = fullBodyText.slice(0, 2500) + "\n\n[...assinado no rodapé...]\n\n" + fullBodyText.slice(-2500);
      }
      if (text.trim().length > 20) {
        const { generateWithAI } = await import("@/integrations/ai/anthropicClient");
        const raw = await generateWithAI(
          `Deste email, analisa com extrema atenção a mensagem E ESPECIALMENTE A ASSINATURA / RODAPÉ do remetente (onde costumam vir os dados fiscais e de faturação da empresa).

Extrai as seguintes informações de QUEM ENVIOU (nunca da Hotelequip):
1. Dados de Identificação:
   - name: Nome COMPLETO da pessoa (linha do nome próprio, sem cortar palavras)
   - company_name: Nome comercial da empresa ou entidade
   - razao_social: Razão social / Denominação jurídica completa se mencionada
   - phone: Telefone ou telemóvel (ex: +351 9XX XXX XXX)

2. Dados de Faturação / Fiscais (procurar na assinatura e rodapés):
   - nif: NIF, NIPC ou VAT de Portugal/UE (9 dígitos)
   - address: Morada da sede ou entrega (rua, número, andar)
   - city: Localidade ou concelho
   - postal_code: Código postal (ex: "1000-017", "2460-837")
   - iban: IBAN (se presente)
   - website: Website profissional

3. Contexto Comercial:
   - request_type: "orcamento" | "encomenda" | "proposta" | "reclamacao" | "assistencia_tecnica" | "informacao" | "outro"
   - requested_items: Lista clara e objetiva de produtos/equipamentos pretendidos (texto livre separado por vírgulas)
   - contact_role: "cliente" | "fornecedor" | "parceiro"

Devolve APENAS um objeto JSON válido, sem texto adicional nem markdown, com as chaves: name, company_name, razao_social, nif, phone, address, city, postal_code, iban, website, request_type, requested_items, contact_role. Usa null se não encontrares um campo.

Email:
"""${text}"""`
        );
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiData = JSON.parse(jsonMatch[0]);
          // Fazer merge: a IA complementa e substitui campos válidos
          extracted = {
            ...extracted,
            name: aiData.name || extracted.name,
            company_name: aiData.company_name || extracted.company_name,
            razao_social: aiData.razao_social || extracted.razao_social,
            phone: aiData.phone || extracted.phone,
            nif: aiData.nif || extracted.nif,
            address: aiData.address || extracted.address,
            city: aiData.city || extracted.city,
            postal_code: aiData.postal_code || extracted.postal_code,
            iban: aiData.iban || extracted.iban,
            website: aiData.website || extracted.website,
            request_type: aiData.request_type || extracted.request_type,
            requested_items: aiData.requested_items || extracted.requested_items,
            contact_role: aiData.contact_role || extracted.contact_role,
          };
        }
      }
    } catch { /* IA indisponível ou lenta — mantém os dados heurísticos que já foram extraídos */ }

    // Guardar na cache da sessão para este email nunca mais chamar a IA
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(extracted));
    } catch { /* ignorar */ }

    return extracted;
  };

  // Corre a extração automaticamente assim que as mensagens e o contacto estiverem prontos
  useEffect(() => {
    // Aguardar que a pesquisa de contacto termine E que as mensagens do email estejam carregadas!
    if (!contactNotFound || contactLoading || existingLead || messagesLoading) return;
    if (extractionRanForThread.current === thread.id) return;

    // Só corre se houver pelo menos uma mensagem carregada ou se já não estiver em loading
    if (!messages || messages.length === 0) return;

    extractionRanForThread.current = thread.id;
    setPreviewLoading(true);
    extractContactInfo()
      .then((result) => setPreview(result))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactNotFound, contactLoading, existingLead, messagesLoading, messages, thread.id]);

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
        nif: extracted.nif || undefined,
        source: 'email',
        status: 'new',
        // Campos de topo — é daqui que Leads.tsx e LeadPopup360 leem directamente
        city: extracted.city || undefined,
        postal_code: extracted.postal_code || undefined,
        website: extracted.website || undefined,
        notes: (() => {
          const parts: string[] = [];
          if (extracted.nif) parts.push(`NIF: ${extracted.nif}`);
          if (extracted.razao_social) parts.push(`Razão Social: ${extracted.razao_social}`);
          if (extracted.request_type) parts.push(`Tipo: ${extracted.request_type}`);
          if (extracted.requested_items) parts.push(`Itens: ${extracted.requested_items}`);
          if (extracted.contact_role) parts.push(`Papel: ${extracted.contact_role}`);
          return parts.length > 0 ? parts.join(' | ') : undefined;
        })(),
        lead_data: {
          company_name: extracted.company_name || companyName || undefined,
          razao_social: extracted.razao_social || undefined,
          contact_name: contactName || undefined,
          nif: extracted.nif || undefined,
          iban: extracted.iban || undefined,
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

  const handleOpenEditModal = () => {
    const fallbackNome = thread.from_address.split('@')[0].replace(/[._-]/g, ' ');
    setEditForm({
      name: preview?.name || '',
      company_name: preview?.company_name || fallbackNome,
      phone: preview?.phone || '',
      city: preview?.city || '',
      nif: preview?.nif || '',
      requested_items: preview?.requested_items || '',
    });
    setIsEditContactOpen(true);
  };

  const handleSaveEditedLead = async () => {
    setCreating(true);
    try {
      const companyName = editForm.company_name.trim() || editForm.name.trim() || thread.from_address;
      const leadPayload: Record<string, unknown> = {
        display_name: companyName,
        email: thread.from_address,
        phone: editForm.phone.trim() || undefined,
        nif: editForm.nif.trim() || undefined,
        source: 'email',
        status: 'new',
        city: editForm.city.trim() || undefined,
        notes: (() => {
          const parts: string[] = [];
          if (editForm.nif.trim()) parts.push(`NIF: ${editForm.nif.trim()}`);
          if (editForm.requested_items.trim()) parts.push(`Itens: ${editForm.requested_items.trim()}`);
          return parts.length > 0 ? parts.join(' | ') : undefined;
        })(),
        lead_data: {
          company_name: editForm.company_name.trim() || undefined,
          contact_name: editForm.name.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          city: editForm.city.trim() || undefined,
          nif: editForm.nif.trim() || undefined,
          requested_items: editForm.requested_items.trim() || undefined,
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
        setCreatedLeadId(String(created.id));
        setCreatedLeadName(companyName);
        setContactNotFound(false);
        setIsEditContactOpen(false);
        toast({ title: 'Lead criada com sucesso!', description: 'Podes acompanhá-la na página de Leads.' });
      }
    } catch {
      toast({ title: 'Erro ao criar lead', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleSearchContacts = async (query: string) => {
    setSearchContactQuery(query);
    if (query.trim().length < 2) {
      setContactSearchResults([]);
      return;
    }
    setSearchingContacts(true);
    try {
      const res = await directusRequest<{ data: Array<{ id: string | number; company_name?: string; contact_name?: string; email?: string; phone?: string }> }>(
        `/items/contacts?search=${encodeURIComponent(query.trim())}&limit=8&fields=id,company_name,contact_name,email,phone`
      );
      setContactSearchResults(res?.data || []);
    } catch {
      setContactSearchResults([]);
    } finally {
      setSearchingContacts(false);
    }
  };

  const handleLinkExistingContact = async (c: { id: string | number; company_name?: string; contact_name?: string; email?: string; phone?: string }) => {
    setLinkingContact(true);
    try {
      await directusRequest(`/items/email_threads/${thread.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ contact_id: c.id }),
      });
      setContact({ id: String(c.id), company_name: c.company_name, contact_name: c.contact_name, email: c.email, phone: c.phone });
      setContactNotFound(false);
      setIsLinkContactOpen(false);
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      toast({ title: 'Cliente associado!', description: `A conversa foi associada a ${c.company_name || c.contact_name || c.email}.` });
    } catch {
      toast({ title: 'Erro ao associar cliente', variant: 'destructive' });
    } finally {
      setLinkingContact(false);
    }
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

      {/* Card estruturado de identificação de novo contacto / lead */}
      {!contact && !previewDismissed && (contactNotFound || existingLead) && (
        <div className={cn(
          "rounded-xl border p-4 mb-4 shadow-sm",
          existingLead
            ? "border-blue-200/80 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900/40"
            : "border-amber-200/80 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/40"
        )}>
          <div className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b",
            existingLead ? "border-blue-200/60 dark:border-blue-900/30" : "border-amber-200/60 dark:border-amber-900/30"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg font-bold text-xs",
                existingLead
                  ? "bg-blue-500/15 text-blue-800 dark:text-blue-300"
                  : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
              )}>
                {existingLead ? "📋" : "✨"}
              </div>
              <div>
                <h3 className={cn(
                  "text-sm font-semibold leading-tight",
                  existingLead ? "text-blue-950 dark:text-blue-200" : "text-amber-900 dark:text-amber-200"
                )}>
                  {existingLead ? `Lead já registada no CRM (#${existingLead.id})` : "Novo potencial cliente detetado"}
                </h3>
                <p className={cn(
                  "text-[11px]",
                  existingLead ? "text-blue-800/80 dark:text-blue-400/90" : "text-amber-800/80 dark:text-amber-400/90"
                )}>
                  {previewLoading
                    ? "A analisar a assinatura e texto do email com IA…"
                    : existingLead
                      ? "Os dados deste remetente já foram extraídos e registados como Lead no CRM:"
                      : "Este email não está registado no CRM. Revê os dados detetados e escolhe o que fazer:"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-amber-800 dark:text-amber-300 hover:text-foreground hover:bg-amber-100/50"
                disabled={previewLoading}
                onClick={() => {
                  setPreviewLoading(true);
                  extractContactInfo()
                    .then((r) => setPreview(r))
                    .finally(() => setPreviewLoading(false));
                }}
                title="Forçar nova análise da assinatura e do texto do email"
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", previewLoading && "animate-spin")} />
                Reanalisar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setPreviewDismissed(true)}
              >
                <X className="h-3 w-3 mr-1" /> Ignorar
              </Button>
            </div>
          </div>

          {previewLoading ? (
            <div className="py-4 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
              A detetar nome, empresa, telefone e artigos pretendidos…
            </div>
          ) : (
            <div className="py-3 space-y-2.5">
              {/* Grelha de campos detetados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-background/80 p-2 border border-amber-200/50 dark:border-amber-900/30">
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Contacto / Pessoa</span>
                  <span className="font-medium text-foreground truncate block">
                    {preview?.name || preview?.company_name || thread.from_address.split('@')[0].replace(/[._-]/g, ' ') || "—"}
                  </span>
                </div>

                <div className="rounded-lg bg-background/80 p-2 border border-amber-200/50 dark:border-amber-900/30">
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Empresa / Entidade</span>
                  <span className="font-medium text-foreground truncate block">
                    {preview?.company_name || (preview?.name ? "A confirmar" : "—")}
                  </span>
                </div>

                <div className="rounded-lg bg-background/80 p-2 border border-amber-200/50 dark:border-amber-900/30">
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Correio Eletrónico</span>
                  <span className="font-medium text-foreground truncate block" title={thread.from_address}>
                    {thread.from_address}
                  </span>
                </div>

                {preview?.phone && (
                  <div className="rounded-lg bg-background/80 p-2 border border-amber-200/50 dark:border-amber-900/30">
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Telefone</span>
                    <span className="font-medium text-foreground truncate block">{preview.phone}</span>
                  </div>
                )}

                {preview?.city && (
                  <div className="rounded-lg bg-background/80 p-2 border border-amber-200/50 dark:border-amber-900/30">
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Localidade</span>
                    <span className="font-medium text-foreground truncate block">
                      {preview.city} {preview.postal_code ? `(${preview.postal_code})` : ''}
                    </span>
                  </div>
                )}

                {preview?.nif && (
                  <div className="rounded-lg bg-background/80 p-2 border border-emerald-300/70 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block uppercase font-semibold">NIF / Faturação</span>
                    <span className="font-mono font-semibold text-emerald-900 dark:text-emerald-200 block">
                      🧾 {preview.nif}
                    </span>
                  </div>
                )}

                {preview?.contact_role && (
                  <div className="rounded-lg bg-background/80 p-2 border border-amber-200/50 dark:border-amber-900/30">
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Relação</span>
                    <span className="font-medium text-foreground capitalize block">
                      {preview.contact_role}
                    </span>
                  </div>
                )}
              </div>

              {preview?.razao_social && preview.razao_social !== preview.company_name && (
                <div className="rounded-lg bg-background/80 p-2 border border-amber-200/50 dark:border-amber-900/30 text-xs">
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Razão Social Registada</span>
                  <span className="font-medium text-foreground">🏢 {preview.razao_social}</span>
                </div>
              )}

              {preview?.requested_items && (
                <div className="rounded-lg bg-background/80 p-2.5 border border-amber-200/50 dark:border-amber-900/30 text-xs">
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium mb-0.5">Equipamentos / Pedido identificado</span>
                  <p className="text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
                    🛒 {preview.requested_items}
                  </p>
                </div>
              )}

              {/* Ações com botões explicativos */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                {existingLead ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      onClick={() => {
                        const ld = (existingLead.lead_data || {}) as Record<string, unknown>;
                        const params = buildContactCreationUrl({
                          id: existingLead.id,
                          contact_name: preview?.name || (ld.contact_name as string) || (existingLead as any).contact_name || existingLead.display_name,
                          company_name: preview?.company_name || (ld.company_name as string) || undefined,
                          phone: preview?.phone || (ld.phone as string) || (existingLead as any).contact_phone || (existingLead as any).phone,
                          mobile_phone: (existingLead as any).mobile_phone || (preview as any)?.mobile_phone,
                          email: existingLead.email || thread.from_address,
                          address: preview?.address || (ld.address as string) || (existingLead as any).address,
                          city: preview?.city || (ld.city as string) || (existingLead as any).city,
                          postal_code: preview?.postal_code || (ld.postal_code as string) || (existingLead as any).postal_code,
                          nif: preview?.nif || (ld.nif as string) || (existingLead as any).nif,
                          source: 'email_inbound',
                          lead_data: existingLead.lead_data,
                        }, { includeLeadId: true, includeNif: true });
                        window.location.href = `/customer360-shell/novo?${params.toString()}`;
                      }}
                      title="Abre a ficha completa de enriquecimento do cliente com todos os dados preenchidos"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir Ficha de Cliente (#{existingLead.id})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 hover:bg-blue-100/50"
                      onClick={() => setShowLeadTimeline(true)}
                      title="Abre o histórico de atividades e eventos desta Lead"
                    >
                      Timeline
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 hover:bg-blue-100/50"
                      onClick={() => {
                        setSearchContactQuery("");
                        setContactSearchResults([]);
                        setIsLinkContactOpen(true);
                      }}
                      title="Ligar esta conversa a outro contacto já existente"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      Associar a cliente
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      disabled={creating}
                      onClick={() => preview && createContactFromExtraction(preview)}
                      title="Regista uma Lead com estes dados para acompanhamento e criação de proposta"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {creating ? 'A registar Lead…' : '✓ Aceitar e Criar Lead'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50"
                      onClick={handleOpenEditModal}
                      title="Abre formulário para ajustar o nome, empresa ou telefone antes de criar"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar dados
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50"
                      onClick={() => {
                        setSearchContactQuery("");
                        setContactSearchResults([]);
                        setIsLinkContactOpen(true);
                      }}
                      title="Se este email pertencer a uma empresa que já tens no CRM, liga a conversa a ela"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      Associar a cliente existente
                    </Button>
                  </>
                )}
              </div>
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
      {thread.category === "pedido_orcamento" && (
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
                    category: thread.category || "",
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

      {/* Modal: Editar dados antes de criar Lead */}
      <Dialog open={isEditContactOpen} onOpenChange={setIsEditContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Edit3 className="h-4 w-4 text-primary" />
              Confirmar dados do novo contacto
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ajusta as informações detetadas antes de criar a Lead para seguimento comercial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium">Nome do Contacto / Pessoa</Label>
              <Input
                placeholder="Ex: João Silva"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium">Nome da Empresa / Estabelecimento</Label>
              <Input
                placeholder="Ex: Restaurante O Pescador Lda"
                value={editForm.company_name}
                onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">NIF / NIPC (Faturação)</Label>
                <Input
                  placeholder="Ex: 501 234 567"
                  value={editForm.nif}
                  onChange={(e) => setEditForm((f) => ({ ...f, nif: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Telefone / Telemóvel</Label>
                <Input
                  placeholder="Ex: 912 345 678"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium">Localidade / Morada</Label>
              <Input
                placeholder="Ex: Leiria"
                value={editForm.city}
                onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium">Equipamentos / Artigos Solicitados</Label>
              <Input
                placeholder="Ex: Forno convector, bancada inox"
                value={editForm.requested_items}
                onChange={(e) => setEditForm((f) => ({ ...f, requested_items: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditContactOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={creating} onClick={handleSaveEditedLead} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {creating ? 'A gravar…' : 'Gravar e Criar Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Associar a cliente existente */}
      <Dialog open={isLinkContactOpen} onOpenChange={setIsLinkContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4 text-primary" />
              Associar email a cliente existente
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pesquisa por nome da empresa, contacto, NIF ou email para ligar esta conversa a uma ficha existente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              placeholder="Pesquisar cliente (nome, empresa, NIF)..."
              value={searchContactQuery}
              onChange={(e) => handleSearchContacts(e.target.value)}
              className="h-9 text-xs"
              autoFocus
            />

            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-border/40">
              {searchingContacts && (
                <p className="text-xs text-muted-foreground py-3 text-center">A pesquisar clientes…</p>
              )}
              {!searchingContacts && searchContactQuery.trim().length >= 2 && contactSearchResults.length === 0 && (
                <p className="text-xs text-muted-foreground py-3 text-center">Nenhum cliente encontrado com esse termo.</p>
              )}
              {contactSearchResults.map((c) => (
                <div
                  key={c.id}
                  className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 hover:bg-muted/50 p-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 text-xs">
                    <p className="font-medium text-foreground truncate">
                      {c.company_name || c.contact_name || "Sem nome"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.contact_name && c.company_name ? `${c.contact_name} · ` : ""}
                      {c.email || c.phone || ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={linkingContact}
                    className="h-7 text-xs shrink-0"
                    onClick={() => handleLinkExistingContact(c)}
                  >
                    Associar
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsLinkContactOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        {/* Attachments — above body for visibility com pré-visualização de imagens */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-3 p-2.5 rounded-lg bg-muted/40 border border-border/80 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              Anexos e Imagens ({message.attachments.length})
            </p>
            <div className="flex flex-wrap gap-2.5">
              {message.attachments.map((att, i) => {
                const fn = (att.filename || "").toLowerCase();
                const isImg = fn.endsWith(".png") || fn.endsWith(".jpg") || fn.endsWith(".jpeg") || fn.endsWith(".gif") || fn.endsWith(".webp") || fn.endsWith(".bmp");
                const directusUrl = import.meta.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt";
                const assetUrl = `${directusUrl}/assets/${att.file}`;

                if (isImg) {
                  return (
                    <div
                      key={i}
                      className="group relative flex flex-col items-center rounded-lg border border-border bg-card p-1.5 shadow-sm hover:border-primary/50 transition-all"
                    >
                      <a
                        href={assetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded bg-muted/30"
                        title="Clique para ver imagem em tamanho real"
                      >
                        <img
                          src={`${assetUrl}?key=system-small-cover`}
                          alt={att.filename || "Imagem"}
                          className="h-20 w-24 object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            // Se o thumbnail com preset falhar, tenta o asset original
                            (e.target as HTMLImageElement).src = assetUrl;
                          }}
                        />
                      </a>
                      <div className="mt-1 flex w-24 items-center justify-between gap-1 px-0.5 text-[10px]">
                        <span className="truncate text-muted-foreground font-medium" title={att.filename}>
                          {att.filename || "imagem"}
                        </span>
                        {att.size && (
                          <span className="text-[9px] text-muted-foreground/80 shrink-0">
                            {Math.round(att.size / 1024)}K
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={async () => {
                      if (!att.file) return;
                      try {
                        const token = localStorage.getItem("directus_access_token") || "";
                        const resp = await fetch(assetUrl, { headers: { Authorization: `Bearer ${token}` } });
                        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                        const blob = await resp.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = att.filename || "anexo";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                      } catch {
                        window.open(assetUrl, "_blank");
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60 transition-colors cursor-pointer shadow-sm"
                  >
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate max-w-[140px]">{att.filename || "Anexo"}</span>
                    {att.size ? <span className="text-muted-foreground text-[10px]">({Math.round(att.size / 1024)}KB)</span> : null}
                  </button>
                );
              })}
            </div>
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
