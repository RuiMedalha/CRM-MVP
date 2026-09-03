/**
 * EmailProductSuggestions — shows product suggestions from Meilisearch
 * based on lead.requested_items (when available) or email subject/body
 * as fallback. Auto-runs the search when requested_items is provided.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, FileText, ExternalLink, AlertTriangle, MessageCircle } from "lucide-react";
import { useMeilisearch, type MeilisearchProduct } from "@/hooks/useMeilisearch";
import { toast } from "@/hooks/use-toast";
import { createQuotation, createQuotationItems, patchQuotation, getQuotationById } from "@/integrations/directus/quotations";
import { generateWithAI, promptProductSpecificationQuestions } from "@/integrations/ai/anthropicClient";
import { approveProductSpecificationQuestions, createProductSpecification, getSpecificationByItemId, type ProductSpecification, type SpecQuestion } from "@/integrations/directus/productSpecifications";

// Critérios da regra de segurança — ver docs/p3-investigacao.md
const PRICE_DISPERSION_THRESHOLD = 3; // se max/min > 3x → revisão
const ABSOLUTE_PRICE_REVIEW_THRESHOLD = 3000; // item caro sem SKU explícito → revisão

interface Props {
  subject: string;
  bodyText?: string;
  contactId?: number | string;
  contactName?: string;
  contactCompany?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Thread ID for dedup (avoid creating multiple quotations for same thread) */
  threadId?: string;
  /**
   * Produtos já extraídos pela IA no momento da classificação (lead_data.requested_items).
   * Quando fornecido, é usado como query por defeito e a pesquisa corre automaticamente
   * (sem precisar do clique "Pesquisar"). Fallback primitivo do subject fica como último recurso.
   */
  requestedItems?: string | null;
}

export function EmailProductSuggestions({ subject, bodyText, contactId, contactName, contactCompany, contactEmail, contactPhone, threadId, requestedItems }: Props) {
  const navigate = useNavigate();
  const { search } = useMeilisearch();
  const [products, setProducts] = useState<MeilisearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftQuotationId, setDraftQuotationId] = useState<string | number | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewReasons, setReviewReasons] = useState<string[]>([]);
  const [clarificationDraft, setClarificationDraft] = useState<string>("");
  const [clarifying, setClarifying] = useState(false);
  const [searched, setSearched] = useState(false);
  const [autoRan, setAutoRan] = useState(false);
  const [generatingForm, setGeneratingForm] = useState(false);
  const [formLink, setFormLink] = useState<string | null>(null);
  const [submittedSpecText, setSubmittedSpecText] = useState<string | null>(null);
  const [pendingSpecReview, setPendingSpecReview] = useState<Array<{ spec: ProductSpecification; productName: string; questions: SpecQuestion[] }>>([]);
  const [pendingSpecToken, setPendingSpecToken] = useState<string | null>(null);

  // 1) Fonte primária: requested_items da lead (IA extraiu na classificação)
  // 2) Fallback primitivo: subject sem palavras-chave comerciais
  const trimmedRequested = (requestedItems || "").trim();
  const subjectTerms = (subject || "")
    .replace(/^(re:|fwd:|fw:|enc:)\s*/gi, "")
    .replace(/orçamento|proposta|preço|cotação|pedido/gi, "")
    .trim();
  const useRequested = trimmedRequested.length >= 3;
  const searchTerms = useRequested ? trimmedRequested : subjectTerms;

  // Auto-search quando temos requested_items (informação já é de confiança)
  useEffect(() => {
    if (!useRequested || autoRan) return;
    setAutoRan(true);
    (async () => {
      setLoading(true);
      try {
        // requested_items vem como "fritadeiras industriais, abatedor de temperatura"
        // Pesquisar cada termo individualmente e agregar resultados
        const terms = trimmedRequested
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 2);
        const allResults: MeilisearchProduct[] = [];
        for (const term of terms.slice(0, 3)) {
          const r = await search(term);
          allResults.push(...r.slice(0, 3));
        }
        const unique = allResults.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
        setProducts(unique.slice(0, 8));
        setSearched(true);
      } catch { /* silent */ }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedItems]);

  const handleSearch = async (query?: string) => {
    const q = query || searchTerms;
    if (!q || q.length < 3) return;
    setLoading(true);
    try {
      const results = await search(q);
      setProducts(results.slice(0, 5));
      setSearched(true);
    } catch { /* silent */ }
    setLoading(false);
  };

  // AI-powered extraction from body text — só como fallback quando não há lead
  const handleAIExtract = async () => {
    if (!bodyText && !subject) return;
    setLoading(true);
    try {
      const { generateWithAI } = await import("@/integrations/ai/anthropicClient");
      const text = (bodyText || subject || "").slice(0, 1000);
      const aiResult = await generateWithAI(
        `Deste email, extrai APENAS os nomes de produtos/equipamentos pedidos, como lista separada por vírgula. Se não encontrares produtos específicos, devolve as palavras-chave mais relevantes para pesquisa.\n\nEmail:\n"""${text}"""\n\nDevolve APENAS a lista, sem explicação.`
      );
      // Search each extracted term
      const terms = aiResult.split(",").map(t => t.trim()).filter(t => t.length > 2);
      const allResults: typeof products = [];
      for (const term of terms.slice(0, 3)) {
        const r = await search(term);
        allResults.push(...r.slice(0, 3));
      }
      // Deduplicate by id
      const unique = allResults.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
      setProducts(unique.slice(0, 8));
      setSearched(true);
    } catch { /* silent */ }
    setLoading(false);
  };

  // --- Tarefa 1: Corrigir botão "→ Proposta" (por produto individual) ---
  const handleOpenProposal = (product: MeilisearchProduct) => {
    navigate('/propostas/nova', {
      state: {
        prefill: {
          contactId: contactId || undefined,
          contactName: contactName || undefined,
          email: contactEmail || undefined,
          phone: contactPhone || undefined,
          products: [{
            sku: product.sku,
            name: product.title || product.name,
            price: product.price,
          }],
          notes: `Email: ${subject}`,
        },
      },
    });
  };

  type ProductSafetyDecision = {
    product: MeilisearchProduct;
    needsReview: boolean;
    reason?: string;
    candidates: MeilisearchProduct[];
  };

  const analyzeProductSafety = async (product: MeilisearchProduct): Promise<ProductSafetyDecision> => {
    const query = product.sku || product.title || product.name;
    const candidates = (await search(query)).slice(0, 5);
    const prices = candidates.map((p) => Number(p.price) || 0).filter((v) => v > 0).sort((a, b) => a - b);

    if (prices.length >= 2) {
      const min = prices[0];
      const max = prices[prices.length - 1];
      const dispersion = max / min;
      if (dispersion > PRICE_DISPERSION_THRESHOLD) {
        return {
          product,
          needsReview: true,
          reason: `Preço muito disperso entre top 5 (${min.toFixed(2)}€–${max.toFixed(2)}€, ${dispersion.toFixed(1)}x).`,
          candidates,
        };
      }
    }

    // Se não há SKU e o termo é genérico, não fixar automaticamente SKU/preço.
    const hasSku = Boolean(product.sku && String(product.sku).trim().length >= 3);
    if (!hasSku && candidates.length >= 3) {
      return {
        product,
        needsReview: true,
        reason: "Resultado sem SKU claro e vários candidatos possíveis.",
        candidates,
      };
    }

    return { product, needsReview: false, candidates };
  };

  const handleClarificationDraft = async () => {
    setClarifying(true);
    try {
      const result = await generateWithAI(
        `Escreve uma mensagem curta e objetiva em português europeu para pedir esclarecimento ao cliente.

Pedido original: ${requestedItems || subject}

Razões internas de dúvida (não mencionar ao cliente como "erro" nem assumir que os candidatos estão certos):
${reviewReasons.map((r) => `- ${r}`).join("\n")}

Contexto do cliente: ${contactName || contactEmail || "cliente"}

Regras:
- Começa obrigatoriamente com "Obrigado pelo seu pedido!".
- Não vendas e não envies orçamento.
- Nunca presumas tipo, escala, capacidade ou modelo do equipamento.
- Não escolhas entre candidatos internos nem perguntes sobre modelos/capacidades específicos da pesquisa.
- Faz 2-4 perguntas de descoberta sobre uso, volume aproximado, instalação/espaço e energia disponível.
- Para lavagem de loiça/copos, pergunta primeiro se é para copos/chávenas, loiça/pratos ou misto; se substitui máquina existente ou é instalação nova; onde ficará; e energia/voltagem disponível.

Devolve apenas o texto da mensagem, sem título.`
      );
      setClarificationDraft(result.trim());
    } catch (err) {
      toast({ title: "Erro ao gerar esclarecimento", description: String((err as Error)?.message || ""), variant: "destructive" });
    } finally {
      setClarifying(false);
    }
  };

  const generatePublicToken = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(36))
      .join("")
      .substring(0, 16);

  const getVariedCandidateContext = async (productName: string, notes?: string | null) => {
    const base = String(productName || "").trim();
    if (!base) return String(notes || "");
    const qualifiers = ["bancada", "capota", "túnel", "compacta", "pequena", "industrial"];
    const seen = new Set<string>();
    const examples: string[] = [];

    for (const qualifier of qualifiers) {
      if (examples.length >= 3) break;
      const result = (await search(`${base} ${qualifier}`).catch(() => [])).find((p) => {
        const key = String(p.sku || p.id || p.title || p.name || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (result) {
        examples.push(`${result.title || result.name} (${result.sku || "sem SKU"}) — €${Number(result.price || 0).toFixed(2)}`);
      }
    }

    return [
      notes ? `Notas de revisão: ${notes}` : "",
      examples.length ? `Exemplos variados do catálogo para contexto interno: ${examples.join("; ")}` : "",
    ].filter(Boolean).join("\n");
  };

  const parseQuestionsJson = (raw: string) => {
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length < 3 || parsed.length > 5) {
      throw new Error("A IA não devolveu 3-5 perguntas válidas.");
    }
    return parsed.map((q: any) => ({
      question: String(q.question || "").trim(),
      type: ["text", "number", "choice", "photo"].includes(q.type) ? q.type : "text",
      ...(Array.isArray(q.choices) ? { choices: q.choices.map(String).filter(Boolean) } : {}),
      ...(q.followUpQuestion && typeof q.followUpQuestion === "object" ? { followUpQuestion: q.followUpQuestion } : {}),
    })).filter((q: any) => q.question);
  };

  const handleGenerateForm = async () => {
    if (!draftQuotationId) {
      toast({ title: "Cria primeiro a proposta", description: "O formulário fica ligado aos itens em revisão da proposta automática." });
      return;
    }
    setGeneratingForm(true);
    try {
      const { quotation, items } = await getQuotationById(String(draftQuotationId));
      const reviewItems = (items || []).filter((i: any) =>
        i.manual_entry || String(i.notes || "").includes("Revisão necessária")
      );
      if (!reviewItems.length) throw new Error("Não encontrei itens em revisão nesta proposta.");

      const publicToken = quotation?.public_token || generatePublicToken();
      if (!quotation?.public_token) {
        await patchQuotation(String(draftQuotationId), { public_token: publicToken } as any);
      }

      let created = 0;
      const reviewPanelItems: Array<{ spec: ProductSpecification; productName: string; questions: SpecQuestion[] }> = [];
      for (const reviewItem of reviewItems) {
        let spec = await getSpecificationByItemId(reviewItem.id).catch(() => null);
        let questions = spec?.questions || [];
        if (!spec) {
          const candidateContext = await getVariedCandidateContext(
            reviewItem.product_name || requestedItems || subject,
            reviewItem.notes
          );
          const prompt = promptProductSpecificationQuestions(
            reviewItem.product_name || requestedItems || subject,
            reviewItem.notes || reviewReasons.join(" | "),
            candidateContext
          );
          const aiResult = await generateWithAI(prompt);
          questions = parseQuestionsJson(aiResult);
          spec = await createProductSpecification(reviewItem.id, questions);
          created += 1;
        }
        reviewPanelItems.push({ spec, productName: reviewItem.product_name || `Item #${reviewItem.id}`, questions });
      }

      setPendingSpecReview(reviewPanelItems);
      setPendingSpecToken(publicToken);
      setFormLink(null);
      toast({ title: "Perguntas geradas", description: `${created || reviewItems.length} item(ns) prontos para revisão do agente.` });
    } catch (err) {
      toast({ title: "Erro ao gerar formulário", description: String((err as Error)?.message || ""), variant: "destructive" });
    } finally {
      setGeneratingForm(false);
    }
  };

  const updatePendingQuestion = (specId: number | string, index: number, text: string) => {
    setPendingSpecReview((prev) => prev.map((entry) => {
      if (String(entry.spec.id) !== String(specId)) return entry;
      const questions = [...entry.questions];
      questions[index] = { ...questions[index], question: text };
      return { ...entry, questions };
    }));
  };

  const removePendingQuestion = (specId: number | string, index: number) => {
    setPendingSpecReview((prev) => prev.map((entry) => {
      if (String(entry.spec.id) !== String(specId)) return entry;
      return { ...entry, questions: entry.questions.filter((_, i) => i !== index) };
    }));
  };

  const addPendingQuestion = (specId: number | string) => {
    setPendingSpecReview((prev) => prev.map((entry) => {
      if (String(entry.spec.id) !== String(specId)) return entry;
      return { ...entry, questions: [...entry.questions, { question: "", type: "text" as const }] };
    }));
  };

  const handleApproveGeneratedForm = async () => {
    if (!pendingSpecToken || !pendingSpecReview.length) return;
    try {
      for (const entry of pendingSpecReview) {
        const questions = entry.questions.filter((q) => q.question.trim());
        if (questions.length < 1) throw new Error(`Sem perguntas válidas para ${entry.productName}.`);
        await approveProductSpecificationQuestions(entry.spec.id, questions);
      }
      const baseUrl = import.meta.env.VITE_PROPOSALS_BASE_URL || "https://proposta.hotelequip.pt";
      const link = `${baseUrl}/p/${pendingSpecToken}/spec`;
      setFormLink(link);
      setPendingSpecReview([]);
      toast({ title: "Formulário aprovado", description: "Link pronto para copiar e enviar ao cliente." });
    } catch (err) {
      toast({ title: "Erro ao aprovar formulário", description: String((err as Error)?.message || ""), variant: "destructive" });
    }
  };

  const handleLoadSpecificationResponses = async () => {
    if (!draftQuotationId) return;
    try {
      const { items } = await getQuotationById(String(draftQuotationId));
      const lines: string[] = [];
      for (const item of items || []) {
        const spec = item.id ? await getSpecificationByItemId(item.id) : null;
        if (!spec || spec.status !== "submitted") continue;
        lines.push(`Produto: ${item.product_name || item.id}`);
        (spec.questions || []).forEach((q, idx) => {
          const answer = spec.answers?.[idx] || {};
          const value = answer.answer_text ?? answer.answer_number ?? answer.answer_choice ?? "";
          if (value !== "") lines.push(`• ${q.question}: ${value}`);
        });
        if (spec.photo_url) lines.push(`• Foto: ${spec.photo_url}`);
      }
      setSubmittedSpecText(lines.length ? lines.join("\n") : "Ainda não há respostas submetidas.");
    } catch (err) {
      toast({ title: "Erro ao carregar respostas", description: String((err as Error)?.message || ""), variant: "destructive" });
    }
  };

  const hydrateReviewStateFromQuotation = async (quotationId: string | number) => {
    const { items } = await getQuotationById(String(quotationId));
    const reviewItems = (items || []).filter((item: any) =>
      item?.manual_entry === true || String(item?.notes || "").includes("Revisão necessária")
    );

    if (reviewItems.length > 0) {
      setNeedsReview(true);
      setReviewReasons(
        reviewItems.map((item: any) => {
          const productName = item.product_name || `Item #${item.id}`;
          const notes = String(item.notes || "Revisão necessária").trim();
          return `"${productName}": ${notes}`;
        })
      );
    } else {
      setNeedsReview(false);
      setReviewReasons([]);
    }
  };

  // --- Tarefa 2: Criar proposta automática — UM item por produto pedido ---
  const handleCreateDraftProposal = async () => {
    if (!products.length) return;
    setCreatingDraft(true);
    try {
      // Dedup: verificar se já existe proposta draft para esta thread
      if (threadId) {
        const existing = await import("@/integrations/directus/client").then(m =>
          m.directusRequest<{ data: Array<{ id: string | number; quotation_number?: string }> }>(
            `/items/quotations?filter[internal_notes][_contains]=email_thread:${threadId}&filter[status][_eq]=draft&limit=1&fields=id,quotation_number`
          )
        );
        if (existing?.data?.length) {
          const existingId = existing.data[0].id;
          setDraftQuotationId(existingId);
          await hydrateReviewStateFromQuotation(existingId);
          toast({ title: "Proposta já existe", description: `Rascunho ${existing.data[0].quotation_number || "#" + existingId} já criado para este email.` });
          setCreatingDraft(false);
          return;
        }
      }

      // --- Regra de segurança: UM item por TERMO PEDIDO (não por candidato Meilisearch) ---
      // Parsear termos do pedido original
      const requestedTerms = (requestedItems || subject || "")
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2);

      if (!requestedTerms.length) {
        toast({ title: "Sem termos", description: "Não foi possível identificar produtos no pedido.", variant: "destructive" });
        setCreatingDraft(false);
        return;
      }

      // Para cada termo, buscar top 5 e decidir
      type ItemDecision = {
        term: string;
        needsReview: boolean;
        reason?: string;
        bestCandidate: MeilisearchProduct | null;
        candidates: MeilisearchProduct[];
      };

      const decisions: ItemDecision[] = [];
      for (const term of requestedTerms.slice(0, 5)) {
        const candidates = (await search(term)).slice(0, 5);
        const prices = candidates.map((p) => Number(p.price) || 0).filter((v) => v > 0).sort((a, b) => a - b);

        let needsReview = false;
        let reason: string | undefined;

        if (prices.length >= 2) {
          const min = prices[0];
          const max = prices[prices.length - 1];
          const dispersion = max / min;
          if (dispersion > PRICE_DISPERSION_THRESHOLD) {
            needsReview = true;
            reason = `Preço muito disperso nos top 5 (${min.toFixed(0)}€–${max.toFixed(0)}€, ${dispersion.toFixed(1)}x). Pode ser máquinas de tamanho/tipo muito diferentes.`;
          }
        }

        // Sem SKU claro + vários candidatos = genérico
        if (!needsReview && candidates.length >= 3) {
          const topHasSku = Boolean(candidates[0]?.sku && String(candidates[0].sku).trim().length >= 3);
          if (!topHasSku) {
            needsReview = true;
            reason = "Resultado sem SKU claro e vários candidatos com preços/tamanhos diferentes.";
          }
        }

        // Segunda rede: preço absoluto alto sem SKU explícito no pedido
        if (!needsReview && candidates[0]) {
          const topPrice = Number(candidates[0].price) || 0;
          if (topPrice > ABSOLUTE_PRICE_REVIEW_THRESHOLD) {
            // Verificar se o termo pedido contém SKU que bata com o candidato
            const topSku = String(candidates[0].sku || "").trim().toLowerCase();
            const termLower = term.toLowerCase();
            const hasExplicitSkuMatch = topSku.length >= 3 && termLower.includes(topSku);
            if (!hasExplicitSkuMatch) {
              needsReview = true;
              reason = `Preço elevado (€${topPrice.toFixed(0)}) sem referência/modelo explícito no pedido. Pode não ser o produto pretendido.`;
            }
          }
        }

        // Sem candidatos = também review
        if (!candidates.length) {
          needsReview = true;
          reason = "Nenhum produto encontrado no catálogo.";
        }

        decisions.push({
          term,
          needsReview,
          reason,
          bestCandidate: needsReview ? null : (candidates[0] || null),
          candidates,
        });
      }

      const reviewItems = decisions.filter((d) => d.needsReview);
      const safeItems = decisions.filter((d) => !d.needsReview && d.bestCandidate);
      const hasReview = reviewItems.length > 0;

      if (hasReview) {
        setNeedsReview(true);
        setReviewReasons(reviewItems.map((r) => `"${r.term}": ${r.reason}`));
      }

      // Calcular subtotal (só items seguros)
      const subtotal = safeItems.reduce((sum, d) => sum + (Number(d.bestCandidate!.price) || 0), 0);

      // Criar quotation com dados do cliente
      const internalNotes = [
        threadId ? `email_thread:${threadId}` : "",
        hasReview ? `[needs_review] ${reviewItems.length} item(s) precisam confirmação` : "",
      ].filter(Boolean).join("\n");

      const quotation = await createQuotation({
        status: "draft",
        customer_id: contactId ? (Number(contactId) || contactId) as any : undefined,
        customer_name: contactName || contactCompany || undefined,
        customer_company: contactCompany || contactName || undefined,
        subtotal,
        total_amount: subtotal,
        notes: `Pedido de orçamento via email: ${subject}`,
        internal_notes: internalNotes || undefined,
      } as any);

      if (!quotation?.id) throw new Error("Quotation criada sem ID");

      // Criar items — UM por termo pedido
      const items = decisions.map((d, i) => {
        if (d.needsReview || !d.bestCandidate) {
          // Item em revisão: sem SKU/preço, nota com candidatos
          const candidateList = d.candidates.slice(0, 3)
            .map((c) => `${c.title || c.name} (${c.sku || "sem SKU"}) — €${Number(c.price || 0).toFixed(2)}`)
            .join("; ");
          return {
            quotation_id: quotation.id,
            product_id: null,
            product_name: d.term,
            sku: null,
            quantity: 1,
            unit_price: 0,
            discount_percent: 0,
            line_total: 0,
            image_url: null,
            product_url: null,
            item_type: "product",
            manual_entry: true,
            sort_order: i,
            notes: `⚠️ Revisão necessária: ${d.reason}\nCandidatos: ${candidateList}`,
          };
        }
        // Item seguro: melhor candidato
        const p = d.bestCandidate;
        return {
          quotation_id: quotation.id,
          product_id: String(p.id || p.sku || ""),
          product_name: p.title || p.name || d.term,
          sku: p.sku || null,
          quantity: 1,
          unit_price: Number(p.price) || 0,
          discount_percent: 0,
          line_total: Number(p.price) || 0,
          image_url: p.thumbnail || p.image_url || null,
          product_url: p.link || null,
          item_type: "product",
          manual_entry: false,
          sort_order: i,
          notes: null,
        };
      });

      await createQuotationItems(items);
      setDraftQuotationId(quotation.id);

      const reviewMsg = hasReview ? ` (${reviewItems.length} requer confirmação)` : "";
      toast({ title: "Proposta criada", description: `Rascunho ${quotation.quotation_number || ""} com ${items.length} produto(s)${reviewMsg}.` });
    } catch (err) {
      toast({ title: "Erro ao criar proposta", description: String((err as Error)?.message || ""), variant: "destructive" });
    } finally {
      setCreatingDraft(false);
    }
  };

  if (!searchTerms && !bodyText && !searched) return null;

  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <ShoppingCart className="h-3.5 w-3.5" />
          Produtos sugeridos
          {useRequested && (
            <span className="text-[10px] font-normal text-amber-700/70">(da lead)</span>
          )}
        </div>
        <div className="flex gap-1">
          {!useRequested && (
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => handleSearch()} disabled={loading}>
              <Search className="h-3 w-3" />
              {loading ? "..." : "Pesquisar"}
            </Button>
          )}
          {!useRequested && (
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15" onClick={handleAIExtract} disabled={loading}>
              ✨ IA Extrair
            </Button>
          )}
          {useRequested && (
            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => handleSearch()} disabled={loading}>
              <Search className="h-3 w-3" />
              {loading ? "..." : "Repesquisar"}
            </Button>
          )}
          {/* Tarefa 2: Botão criar proposta automática */}
          {products.length > 0 && !draftQuotationId && (
            <Button
              size="sm"
              variant="default"
              className="h-6 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
              onClick={handleCreateDraftProposal}
              disabled={creatingDraft}
            >
              <FileText className="h-3 w-3" />
              {creatingDraft ? "A criar..." : "Criar proposta automática"}
            </Button>
          )}
        </div>
      </div>

      {searchTerms && !searched && (
        <p className="text-xs text-amber-700">
          {useRequested ? "Detectámos" : "Termos detectados"}: "{searchTerms}"
          {!useRequested && " — clica Pesquisar"}
        </p>
      )}

      {searched && products.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum produto encontrado.</p>
      )}

      {draftQuotationId && (
        <div className="rounded-md bg-blue-50 border border-blue-100 px-2 py-1.5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-blue-800 font-medium">Proposta automática criada em rascunho</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs gap-1 text-blue-700 hover:text-blue-900"
                onClick={handleLoadSpecificationResponses}
              >
                Ver respostas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs gap-1 text-blue-700 hover:text-blue-900"
                onClick={() => navigate(`/propostas/${draftQuotationId}`)}
              >
                Abrir <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {submittedSpecText && (
            <pre className="whitespace-pre-wrap rounded bg-white/70 border border-blue-100 p-2 text-[11px] text-blue-950">{submittedSpecText}</pre>
          )}
        </div>
      )}

      {/* Aviso e botão de esclarecimento quando produtos precisam revisão */}
      {needsReview && (
        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2.5 space-y-2 text-xs">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Alguns produtos precisam de confirmação</p>
              <ul className="mt-1 space-y-0.5 text-amber-700">
                {reviewReasons.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1"
              onClick={handleClarificationDraft}
              disabled={clarifying}
            >
              <MessageCircle className="h-3 w-3" />
              {clarifying ? "A gerar..." : "Pedir esclarecimento ao cliente"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1"
              onClick={handleGenerateForm}
              disabled={generatingForm || !draftQuotationId}
              title={!draftQuotationId ? "Cria primeiro a proposta automática" : undefined}
            >
              <FileText className="h-3 w-3" />
              {generatingForm ? "A gerar..." : "Gerar formulário"}
            </Button>
          </div>
          {clarificationDraft && (
            <div className="mt-2 rounded border border-border bg-card p-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Rascunho sugerido:</p>
              <p className="text-sm whitespace-pre-wrap">{clarificationDraft}</p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(clarificationDraft);
                      toast({ title: "Copiado", description: "Cola no campo de resposta ao email." });
                    } catch {
                      toast({ title: "Erro", variant: "destructive" });
                    }
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
          )}
          {pendingSpecReview.length > 0 && (
            <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2 space-y-2">
              <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wide">Rever perguntas antes de enviar:</p>
              {pendingSpecReview.map((entry) => (
                <div key={String(entry.spec.id)} className="rounded bg-white/80 border border-blue-100 p-2 space-y-2">
                  <p className="font-medium text-blue-900">{entry.productName}</p>
                  {entry.questions.map((q, idx) => (
                    <div key={`${entry.spec.id}-${idx}`} className="flex gap-2 items-center">
                      <input
                        className="flex-1 rounded border border-blue-100 px-2 py-1 text-xs"
                        value={q.question}
                        onChange={(e) => updatePendingQuestion(entry.spec.id, idx, e.target.value)}
                      />
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => removePendingQuestion(entry.spec.id, idx)}>
                        Apagar
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => addPendingQuestion(entry.spec.id)}>
                    + Adicionar pergunta
                  </Button>
                </div>
              ))}
              <Button size="sm" className="h-7 text-xs" onClick={handleApproveGeneratedForm}>
                Aprovar e gerar link
              </Button>
            </div>
          )}
          {formLink && (
            <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2">
              <p className="text-[10px] font-medium text-emerald-700 uppercase tracking-wide mb-1">Formulário gerado:</p>
              <p className="text-xs break-all text-emerald-900">{formLink}</p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(formLink);
                      toast({ title: "Link copiado", description: "Envia ao cliente por email ou WhatsApp." });
                    } catch {
                      toast({ title: "Erro", variant: "destructive" });
                    }
                  }}
                >
                  Copiar link
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {products.length > 0 && (
        <div className="space-y-1.5">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-card border px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{p.title || p.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {p.sku && <Badge variant="secondary" className="text-xs px-1 py-0 h-4">{p.sku}</Badge>}
                  {p.price > 0 && <span className="font-mono">€{Number(p.price).toFixed(2)}</span>}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs shrink-0"
                onClick={() => handleOpenProposal(p)}
              >
                → Proposta
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
