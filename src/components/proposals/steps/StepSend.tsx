import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProposalForm, type FollowUp } from "@/contexts/ProposalFormContext";
import { calculatePersuasionScore } from "@/utils/persuasionScore";
import { createQuotation, createQuotationItems, patchQuotation, replaceQuotationItems, sendQuotation, getQuotationById } from "@/integrations/directus/quotations";
import { triggerQuotationSent } from "@/integrations/n8n/quotationWebhooks";
import { generateProposalPDF } from "@/utils/generateProposalPDF";
import { getPublicCompanySettings } from "@/integrations/directus/quotationPublic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  Send,
  Clock,
  Link as LinkIcon,
  Copy,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  FileDown,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { Quotation } from "@/types/quotation";

export function StepSend() {
  const { state, reset, updateField } = useProposalForm();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sentResult, setSentResult] = useState<{ token: string; url: string } | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [savedQuotationId, setSavedQuotationId] = useState<string | null>(null);
  const [followupsEnabled, setFollowupsEnabled] = useState(true);

  useEffect(() => {
    if (!sentResult && state.editingId) {
      (async () => {
        try {
          const { quotation } = await getQuotationById(state.editingId);
          if (quotation) {
            setSavedQuotationId(state.editingId);
            if (quotation.public_token) {
              const baseUrl = import.meta.env.VITE_PROPOSALS_BASE_URL || "https://proposta.hotelequip.pt";
              setSentResult({ token: quotation.public_token, url: `${baseUrl}/p/${quotation.public_token}` });
            }
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [state.editingId, sentResult]);

  const { score } = useMemo(() => calculatePersuasionScore(state), [state]);
  const total = state.items.reduce((sum, i) => sum + (i.line_total || 0), 0);
  const followups = state.followups || [];

  const handleFollowupChange = (
    index: number,
    field: keyof FollowUp,
    value: FollowUp[keyof FollowUp]
  ) => {
    const updated = [...followups];
    (updated[index] as Record<string, unknown>)[field] = value;
    updateField("followups", updated);
  };

  const handleGenerateFollowups = () => {
    const productNames = state.items.map((i) => i.product_name).join(", ");
    const base = productNames || "os produtos selecionados";
    const generated: FollowUp[] = [
      {
        days: 2,
        message: `Olá {nome_cliente}, enviámos-lhe uma proposta para ${base}. Teve oportunidade de a analisar? Estamos disponíveis para esclarecer qualquer dúvida.`,
        channel: "whatsapp",
        active: true,
      },
      {
        days: 5,
        message: `Olá {nome_cliente}, gostaríamos de saber se a proposta para ${base} corresponde às vossas expectativas. Podemos ajustar condições ou quantidades se necessário.`,
        channel: "email",
        active: true,
      },
      {
        days: 2,
        message: `Olá {nome_cliente}, a proposta para ${base} expira em breve. Não perca as condições especiais que preparámos. Podemos fechar hoje?`,
        channel: "whatsapp",
        active: true,
      },
    ];
    updateField("followups", generated);
  };

  /** Coerce empty/whitespace/"null" strings to null. Directus rejects "" on text fields. */
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

  const buildPayload = (): Partial<any> => cleanPayload({
    document_type: "proposal",
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
    urgency_expires_at: (state.urgency_discount_pct && state.urgency_hours)
      ? new Date(Date.now() + (state.urgency_hours * 3600000)).toISOString()
      : null,
    valid_until: s(state.valid_until),
    theme: s(state.theme),
    phone_gate_enabled: state.phone_gate_enabled,
    notes: s(state.notes),
    terms_conditions: s(state.terms_conditions),
    internal_notes: s(state.internal_notes),
    persuasion_score: score,
    sent_to_email: s(state.customer_email),
    sent_to_phone: s(state.sent_to_phone) || s(state.customer_phone),
    followups: followupsEnabled ? followups : null,
    newsletter_discount_enabled: state.newsletter_discount_enabled || false,
    newsletter_discount_percent: state.newsletter_discount_enabled ? state.newsletter_discount_percent : null,
    newsletter_discount_code: state.newsletter_discount_enabled ? s(state.newsletter_discount_code) : null,
    show_terms: state.show_terms ?? false,
    customer_logo_url: s((state as any).customer_logo_url),
  });

  const buildItemsPayload = (quotationId: string) =>
    [...state.items, ...state.additional_items].map((item, idx) => ({
      quotation_id: quotationId,
      item_type: item.item_type || "product",
      product_id: item.product_id || null,
      product_name: item.product_name,
      sku: item.sku || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent || 0,
      line_total: item.line_total,
      image_url: item.image_url || null,
      images: item.images || null,
      product_url: item.product_url || null,
      datasheet_url: item.datasheet_url || null,
      datasheet_label: item.datasheet_label || null,
      ai_description: item.ai_description || null,
      comparison_group: item.comparison_group || null,
      is_recommended: item.is_recommended || false,
      comparison_specs: item.comparison_specs || null,
      sort_order: idx,
    }));

  const handleSend = async (mode: "now" | "best_time" | "skip") => {
    setIsSending(true);
    try {
      const payload = buildPayload();
      payload.status = mode === "skip" ? "draft" : "sent";

      let quotationId: string;
      let quotationNumber: string | undefined;

      if (state.editingId) {
        // PATCH existing quotation
        const updated = await patchQuotation(state.editingId, payload);
        quotationId = state.editingId;
        quotationNumber = updated?.quotation_number || undefined;
        // Replace items
        const allItems = buildItemsPayload(quotationId);
        if (allItems.length > 0) {
          await replaceQuotationItems(quotationId, allItems);
        }
      } else {
        // POST new quotation
        const created = await createQuotation(payload);
        if (!created?.id) throw new Error("Falha ao criar proposta");
        quotationId = created.id;
        quotationNumber = created.quotation_number || undefined;
        const allItems = buildItemsPayload(quotationId);
        if (allItems.length > 0) {
          await createQuotationItems(allItems);
        }
      }

      // Persistir reviews na coleção quotation_reviews
      if (state.reviews && state.reviews.length > 0) {
        try {
          const { directusRequest } = await import("@/integrations/directus/client");
          // Apagar reviews anteriores desta quotation (replace)
          const existingReviews = await directusRequest<{ data: { id: string }[] }>(
            `/items/quotation_reviews?filter[quotation_id][_eq]=${quotationId}&fields=id`
          ).catch(() => ({ data: [] }));
          if (existingReviews.data?.length) {
            await Promise.all(
              existingReviews.data.map((r) =>
                directusRequest(`/items/quotation_reviews/${r.id}`, { method: "DELETE" }).catch(() => {})
              )
            );
          }
          // Criar novas
          const reviewPayloads = state.reviews.map((r) => ({
            quotation_id: quotationId,
            reviewer_name: r.reviewer_name || "Cliente",
            rating: r.rating || 5,
            review_text: r.review_text || "",
            source: (r as any).source || "manual",
          }));
          await directusRequest("/items/quotation_reviews", {
            method: "POST",
            body: JSON.stringify(reviewPayloads),
          });
        } catch {
          // Non-blocking — reviews são opcionais
        }
      }

      const result = await sendQuotation(quotationId, {
        email: mode === "skip" ? undefined : state.customer_email,
        phone: state.sent_to_phone || state.customer_phone,
      });
      setSentResult(result);
      setSavedQuotationId(quotationId);

      if (mode !== "skip") {
        await triggerQuotationSent({
          id: quotationId,
          quotation_number: quotationNumber,
          customer_id: state.customer_id,
          treatment: state.treatment,
          language: state.language,
          sent_to_email: state.customer_email,
          sent_to_phone: state.sent_to_phone || state.customer_phone,
          total_amount: total,
          valid_until: state.valid_until,
          public_token: result.token,
          status: "sent",
        } as Quotation);
        toast({ title: "Proposta enviada!", description: `Link: ${result.url}` });
      } else {
        toast({ title: "Link da proposta pronto a partilhar!", description: `Link: ${result.url}` });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha ao enviar", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const copyLink = () => {
    if (sentResult?.url) {
      navigator.clipboard.writeText(sentResult.url);
      toast({ title: "Link copiado!" });
    }
  };

  const handleDownloadPDF = async () => {
    if (!savedQuotationId) return;
    setLoadingPdf(true);
    try {
      const { quotation, items } = await getQuotationById(savedQuotationId);
      const companyData = await getPublicCompanySettings();
      const pdfQuotation = { ...quotation, items };
      const pdfCompany = {
        name: companyData?.name || "HotelEquip",
        logo_url: companyData?.logo_url || undefined,
        address: companyData?.address || "",
        phone: companyData?.phone || "",
        email: companyData?.email || "",
        vat_number: companyData?.vat_number || "",
        iban: companyData?.iban || "",
        multibanco_entity: (companyData as any)?.multibanco_entity || "",
        multibanco_reference: (companyData as any)?.multibanco_reference || "",
      };
      await generateProposalPDF(pdfQuotation, pdfCompany);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (err) {
      toast({ title: "Erro ao gerar PDF", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setLoadingPdf(false);
    }
  };

  // ─── Success screen ──────────────────────────────────────────────────────
  if (sentResult) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h2 className="text-xl font-bold">Proposta enviada com sucesso!</h2>
              <p className="text-muted-foreground">
                O link da proposta foi gerado. Partilhe-o com o cliente.
              </p>

              <div className="w-full max-w-md space-y-3 mt-4">
                <div className="flex items-center gap-2">
                  <Input value={sentResult.url} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* QR Code */}
              <div className="py-4">
                <QRCodeSVG value={sentResult.url} size={160} />
              </div>

              <div className="flex gap-3 mt-4 flex-wrap justify-center">
                <Button
                  size="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  onClick={() => {
                    const phone = (state.sent_to_phone || state.customer_phone || "").replace(/[^0-9]/g, "");
                    const validUntilText = state.valid_until
                      ? new Date(state.valid_until).toLocaleDateString("pt-PT")
                      : "";
                    const message = `Olá ${state.customer_name || ""}, segue a sua proposta personalizada da HotelEquip:\n${sentResult.url}${validUntilText ? `\nVálida até ${validUntilText}.` : ""}\nQualquer dúvida estou à inteira disposição.`;
                    const waUrl = phone
                      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                      : `https://wa.me/?text=${encodeURIComponent(message)}`;
                    window.open(waUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Enviar por WhatsApp
                </Button>
                <Button variant="outline" onClick={copyLink}>
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copiar link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(sentResult.url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4 mr-1.5 text-blue-500" />
                  Abrir página pública
                </Button>
                <Button variant="outline" onClick={handleDownloadPDF} disabled={loadingPdf}>
                  {loadingPdf ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
                  {loadingPdf ? "A gerar..." : "Descarregar PDF"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    reset();
                    navigate("/propostas");
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Voltar às propostas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Send options ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo da proposta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">{state.customer_name || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Nº de produtos:</span>
              <p className="font-medium">{state.items.length + state.additional_items.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total:</span>
              <p className="font-medium text-lg">€{total.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Persuasão:</span>
              <Badge variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "destructive"}>
                {score}/100
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">Enviar também por WhatsApp</span>
            </div>
            <Switch checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} />
          </div>
        </CardContent>
      </Card>

      {/* Follow-ups automáticos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Follow-ups automáticos</span>
            <Switch checked={followupsEnabled} onCheckedChange={setFollowupsEnabled} />
          </CardTitle>
        </CardHeader>
        {followupsEnabled && (
          <CardContent className="space-y-4">
            {followups.map((fu, index) => (
              <div key={index} className="p-3 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Follow-up {index + 1}
                    {index === 2 ? " (antes de expirar)" : " (após envio)"}
                  </Label>
                  <Switch
                    checked={fu.active}
                    onCheckedChange={(checked) =>
                      handleFollowupChange(index, "active", checked)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {index === 2 ? "Dias antes de expirar" : "Dias após envio"}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={fu.days}
                      onChange={(e) =>
                        handleFollowupChange(index, "days", parseInt(e.target.value) || 1)
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Canal</Label>
                    <Select
                      value={fu.channel}
                      onValueChange={(v) =>
                        handleFollowupChange(index, "channel", v as "whatsapp" | "email")
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={fu.message}
                    onChange={(e) =>
                      handleFollowupChange(index, "message", e.target.value)
                    }
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateFollowups}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Gerar mensagens com IA
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Send buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Button
          onClick={() => handleSend("now")}
          disabled={isSending}
          className="h-auto py-4 flex-col gap-1"
        >
          <Send className="h-5 w-5" />
          <span className="font-medium">Enviar agora</span>
          <span className="text-xs opacity-70">Email imediato</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => handleSend("best_time")}
          disabled={isSending}
          className="h-auto py-4 flex-col gap-1"
        >
          <Clock className="h-5 w-5" />
          <span className="font-medium">Melhor horário</span>
          <span className="text-xs opacity-70">10:00 hora do cliente</span>
        </Button>

        <Button
          variant="ghost"
          onClick={() => handleSend("skip")}
          disabled={isSending}
          className="h-auto py-4 flex-col gap-1"
        >
          <LinkIcon className="h-5 w-5" />
          <span className="font-medium">Gerar link apenas</span>
          <span className="text-xs opacity-70">Sem enviar email</span>
        </Button>
      </div>
    </div>
  );
}
