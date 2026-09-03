import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  ArrowRight, Mail, MessageCircle, Loader2, Send,
  ExternalLink, User, Package, CreditCard, MapPin, Truck, Copy,
} from "lucide-react";
import { convertOrderToProposal, sendOrderEmail, ORDER_STATUSES, type SiteOrder } from "@/integrations/directus/site-orders";
import { sendTextViaEvolution } from "@/integrations/evolution/client";
import { OrderTrackingEditor } from "@/components/orders/OrderTrackingEditor";
import { StatusSelect } from "@/components/orders/StatusSelect";
import { enrichSiteOrderFromWoo } from "@/integrations/directus/woo-enricher";

const eur = (n?: number | null, cur = "EUR") =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur || "EUR" }).format(Number(n) || 0);

/** Normaliza para número internacional (assume Portugal se 9 dígitos). */
function waNumber(phone?: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("351")) return d;
  if (d.length === 9) return "351" + d;
  return d;
}

/** Extrai meta_data por chave (case-insensitive). */
function meta(order: SiteOrder, key: string): string | null {
  // meta_data é um array de {id, key, value} — procuramos por chave
  const md = order.meta_data;
  if (Array.isArray(md)) {
    const hit = md.find((m: any) => m?.key === key);
    if (hit && hit.value != null) return String(hit.value);
  }
  // fallback: alguns campos vivem em billing (legado)
  const b: any = order.billing || {};
  return b[key] ?? null;
}

/**
 * Formata uma morada estruturada (billing/shipping) em **linhas estruturadas**,
 * não só uma linha concatenada. Cada parte num <div> separado para legibilidade.
 */
function renderAddress(addr?: {
  first_name?: string; last_name?: string; company?: string;
  address_1?: string; address_2?: string; city?: string;
  state?: string; postcode?: string; country?: string;
} | null): JSX.Element | null {
  if (!addr) return null;
  const hasAny = [addr.first_name, addr.last_name, addr.company,
                  addr.address_1, addr.address_2, addr.postcode,
                  addr.city, addr.state, addr.country].some(Boolean);
  if (!hasAny) return null;
  return (
    <div className="space-y-0.5">
      {(addr.first_name || addr.last_name) && (
        <div className="font-medium">{[addr.first_name, addr.last_name].filter(Boolean).join(" ")}</div>
      )}
      {addr.company && <div className="text-xs text-muted-foreground">{addr.company}</div>}
      {addr.address_1 && <div>{addr.address_1}</div>}
      {addr.address_2 && <div>{addr.address_2}</div>}
      {(addr.postcode || addr.city) && (
        <div>{[addr.postcode, addr.city].filter(Boolean).join(" ")}</div>
      )}
      {addr.state && <div className="text-xs text-muted-foreground">{addr.state}</div>}
      {addr.country && <div className="text-xs text-muted-foreground">{addr.country}</div>}
    </div>
  );
}

/** Helper: devolve morada formatada como string (uma linha) — usado em <Field inline>. */
function formatAddress(addr?: {
  address_1?: string; address_2?: string; city?: string;
  state?: string; postcode?: string; country?: string;
} | null): string {
  if (!addr) return "";
  const parts = [
    addr.address_1,
    addr.address_2,
    [addr.postcode, addr.city].filter(Boolean).join(" "),
    addr.state,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
}

/** Formata ISO date em pt-PT. */
function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("pt-PT"); } catch { return ""; }
}

/** Rótulo do estado de pagamento (pago / pendente). */
function paymentStatusLabel(order: SiteOrder): string {
  if (order.date_paid) return "Pago ✓";
  if (order.payment_method_title) return "Pendente";
  return "—";
}

/** Verifica se o método de pagamento é Multibanco (e portanto tem refs). */
function isMultibanco(order: SiteOrder): boolean {
  return Boolean(
    order.payment_method?.includes("multibanco") ||
    order.payment_method_title?.toLowerCase().includes("multibanco"),
  );
}

/** Botão pequeno para copiar texto para a clipboard. */
function CopyButton({ text }: { text: string }) {
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text);
      }}
      className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

interface Props {
  order: SiteOrder | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConverted?: () => void;
}

export function OrderDetailModal({ order, open, onOpenChange, onConverted }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"" | "convert" | "email" | "wa">("");
  const [panel, setPanel] = useState<"" | "email" | "wa">("");
  const [subject, setSubject] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [enrichedOrder, setEnrichedOrder] = useState<SiteOrder | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichFailed, setEnrichFailed] = useState(false);

  useEffect(() => {
    if (!order) return;
    setSubject(`Sobre a sua encomenda #${order.order_number || order.wc_order_id}`);
    setEmailMsg("");
    setWaMsg("");
    setPanel("");
    setEnrichedOrder(null);
    setEnrichFailed(false);

    // Tenta enriquecer com campos em falta via WooCommerce
    setEnriching(true);
    enrichSiteOrderFromWoo(order)
      .then((next) => {
        setEnrichedOrder(next);
        // Se o enricher não devolveu nada a mais do que já tinhamos, marca como falha
        const hadNewData = Boolean(next.payment_method_title || next.shipping_lines);
        setEnrichFailed(!hadNewData);
      })
      .catch(() => setEnrichFailed(true))
      .finally(() => setEnriching(false));
  }, [order?.id]);

  const o: SiteOrder = enrichedOrder || order || ({} as SiteOrder);
  if (!order) return null;
  const evoActive = true; // WhatsApp Evolution já activo em produção (WA 918/913)
  const items = o.items || [];
  const phone = waNumber(o.customer_phone);
  const converted = !!o.quotation_id;

  async function convert() {
    setBusy("convert");
    try {
      const qid = await convertOrderToProposal(o);
      toast({ title: "Orçamento criado a partir do pedido" });
      onConverted?.();
      navigate(`/propostas/${qid}/editar`);
    } catch (e: any) {
      toast({ title: "Erro ao converter", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(""); }
  }

  async function doEmail() {
    if (!o.customer_email) return;
    setBusy("email");
    try {
      await sendOrderEmail({ to: o.customer_email, subject, message: emailMsg, customer_name: o.customer_name });
      toast({ title: "Email enviado", description: o.customer_email });
      setPanel(""); setEmailMsg("");
    } catch (e: any) {
      toast({ title: "Falha no email", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(""); }
  }

  async function doWhatsApp() {
    if (!phone) return;
    setBusy("wa");
    try {
      await sendTextViaEvolution(phone, waMsg);
      toast({ title: "WhatsApp enviado" });
      setPanel(""); setWaMsg("");
    } catch (e: any) {
      toast({ title: "Falha no WhatsApp", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(""); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Package className="h-5 w-5" /> Pedido #{o.order_number || o.wc_order_id}
            <StatusSelect
              mode="order"
              id={o.id}
              value={o.status}
              options={ORDER_STATUSES}
              queryKey={["site_orders"]}
              onOptimistic={(next) => { o.status = next; }}
              className="min-w-[160px]"
            />
            {enriching && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> a sincronizar com WooCommerce…
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {enrichFailed && !enriching && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Pagamento, moradas e envio:</strong> os dados detalhados serão preenchidos em breve, quando o webhook do site for actualizado. Por agora, vês o que está no Directus (pode estar vazio para encomendas antigas).
          </div>
        )}

        <div className="space-y-4">
          {/* Cliente + Identificação */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><User className="h-4 w-4" /> Cliente</div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              <Field label="Nome" value={o.customer_name} />
              {o.billing?.company && <Field label="Empresa" value={o.billing.company} />}
              <Field label="Email" value={o.customer_email} />
              <Field label="Telefone" value={o.customer_phone} />
              <Field label="NIF" value={o.customer_nif} />
              {meta(o, "_billing_vat") && meta(o, "_billing_vat") !== o.customer_nif && (
                <Field label="VAT" value={meta(o, "_billing_vat")} />
              )}
              {meta(o, "_billing_entity_type") && (
                <Field label="Tipo entidade" value={meta(o, "_billing_entity_type")} />
              )}
              {meta(o, "_billing_cpf") && meta(o, "_billing_cpf") !== o.customer_nif && (
                <Field label="CPF" value={meta(o, "_billing_cpf")} />
              )}
            </div>
          </div>

          {/* Moradas */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" /> Moradas</div>
            <div className="space-y-3 text-sm">
              {/* Faturação */}
              {(renderAddress(o.billing) || o.billing?.email || o.billing?.phone) && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Faturação</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {renderAddress(o.billing) && (
                      <div className="sm:col-span-2">{renderAddress(o.billing)}</div>
                    )}
                    {o.billing?.email && (
                      <Field label="Email" value={o.billing.email} />
                    )}
                    {o.billing?.phone && (
                      <Field label="Telefone" value={o.billing.phone} />
                    )}
                    {(meta(o, "_billing_cpf") || meta(o, "_billing_vat") || o.billing?.nif) && (
                      <Field label="NIF/VAT" value={meta(o, "_billing_vat") || meta(o, "_billing_cpf") || o.billing?.nif} />
                    )}
                    {meta(o, "_billing_entity_type") && (
                      <Field label="Tipo entidade" value={meta(o, "_billing_entity_type")} />
                    )}
                  </div>
                </div>
              )}

              {/* Entrega — só se for diferente */}
              {o.shipping && (formatAddress(o.shipping) !== formatAddress(o.billing) || (o.shipping?.first_name && o.shipping.first_name !== o.billing?.first_name)) && renderAddress(o.shipping) && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrega</div>
                  <div className="sm:col-span-2">
                    {renderAddress(o.shipping)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pagamento */}
          {(o.payment_method_title || o.payment_method) && (
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4" /> Pagamento</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <Field label="Método" value={o.payment_method_title || o.payment_method} />
                <Field label="Estado" value={paymentStatusLabel(o)} />
                {o.transaction_id && <Field label="ID transacção" value={o.transaction_id} />}
                {o.date_paid && <Field label="Data pagamento" value={formatDate(o.date_paid)} />}
                {o.date_completed && <Field label="Data conclusão" value={formatDate(o.date_completed)} />}
                {o.payment_url && (
                  <div className="col-span-2">
                    <a href={o.payment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> Abrir link de pagamento
                    </a>
                  </div>
                )}
                {/* Multibanco refs (se houver) */}
                {isMultibanco(o) && (
                  <div className="col-span-2 mt-1 rounded-md bg-amber-50 p-2 text-xs space-y-0.5">
                    <div><span className="font-medium">Entidade:</span> {meta(o, "_multibanco_ifthen_for_woocommerce_ent")}</div>
                    <div><span className="font-medium">Referência:</span> <span className="font-mono">{meta(o, "_multibanco_ifthen_for_woocommerce_ref")}</span> <CopyButton text={meta(o, "_multibanco_ifthen_for_woocommerce_ref") || ""} /></div>
                    <div><span className="font-medium">Valor:</span> {eur(Number(meta(o, "_multibanco_ifthen_for_woocommerce_val")), o.currency)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Envio */}
          {(o.shipping_lines && o.shipping_lines.length > 0) && (
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4" /> Envio</div>
              <div className="space-y-1 text-sm">
                {o.shipping_lines.map((sl, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>{sl.method_title || sl.method_id || "Método"}</span>
                    <span className="font-medium">{eur(Number(sl.total), o.currency)}</span>
                  </div>
                ))}
                {o.tax_lines && o.tax_lines.length > 0 && (
                  <div className="border-t pt-1 mt-1 space-y-0.5">
                    {o.tax_lines.map((tl, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>IVA {tl.rate_percent}%</span>
                        <span>{eur(Number(tl.tax_total), o.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Artigos */}
          <div className="rounded-lg border overflow-hidden">
            <div className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">Artigos ({items.length})</div>
            <div className="divide-y">
              {items.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.sku ? `SKU ${it.sku} · ` : ""}{it.qty}× {eur(it.price, o.currency)}</div>
                  </div>
                  <div className="font-medium whitespace-nowrap">{eur(it.total, o.currency)}</div>
                </div>
              ))}
            </div>
            <div className="border-t bg-muted/40 px-3 py-2 space-y-1 text-sm">
              {o.subtotal != null && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{eur(o.subtotal, o.currency)}</span>
                </div>
              )}
              {!!o.discount_total && (
                <div className="flex items-center justify-between text-green-700">
                  <span>Desconto {o.coupon_codes?.length ? `(${o.coupon_codes.join(", ")})` : ""}</span>
                  <span>−{eur(o.discount_total, o.currency)}</span>
                </div>
              )}
              {!!o.shipping_total && !o.shipping_lines?.length && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Portes</span><span>{eur(o.shipping_total, o.currency)}</span>
                </div>
              )}
              {!!o.tax_total && !o.tax_lines?.length && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>IVA</span><span>{eur(o.tax_total, o.currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-1 font-semibold">
                <span>Total</span><span>{eur(o.total, o.currency)}</span>
              </div>
            </div>
          </div>

          {o.customer_note && (
            <div className="rounded-lg border bg-amber-50 p-3 text-sm">
              <div className="font-semibold text-amber-800">Nota do cliente</div>
              <div className="text-amber-900 whitespace-pre-wrap">{o.customer_note}</div>
            </div>
          )}

          <OrderTrackingEditor order={o} onUpdated={onConverted} />

          {/* Links úteis */}
          {o.wc_order_id && (
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={`https://www.hotelequip.pt/wp-admin/post.php?post=${o.wc_order_id}&action=edit`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Abrir no WP Admin
              </a>
            </div>
          )}

          <Separator />

          {/* Ações */}
          <div className="flex flex-wrap gap-2">
            {converted ? (
              <Button variant="outline" onClick={() => navigate(`/propostas/${o.quotation_id}/editar`)}>
                <ExternalLink className="h-4 w-4 mr-1" /> Ver orçamento
              </Button>
            ) : (
              <Button onClick={convert} disabled={!!busy}>
                {busy === "convert" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />} Converter em orçamento
              </Button>
            )}
            <Button variant="outline" onClick={() => setPanel(panel === "email" ? "" : "email")} disabled={!o.customer_email}>
              <Mail className="h-4 w-4 mr-1" /> Email
            </Button>
            {evoActive ? (
              <Button variant="outline" onClick={() => setPanel(panel === "wa" ? "" : "wa")} disabled={!phone}>
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </Button>
            ) : (
              <Button variant="outline" disabled={!phone} onClick={() => phone && window.open(`https://wa.me/${phone}`, "_blank")} title="WhatsApp não está ativo na API — abre o WhatsApp Web">
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </Button>
            )}
          </div>

          {/* Painel email */}
          {panel === "email" && (
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs">Assunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              <Label className="text-xs">Mensagem</Label>
              <Textarea rows={4} value={emailMsg} onChange={(e) => setEmailMsg(e.target.value)} placeholder="Escreve a mensagem para o cliente…" />
              <div className="flex justify-end">
                <Button size="sm" onClick={doEmail} disabled={busy === "email" || !emailMsg.trim()}>
                  {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />} Enviar para {o.customer_email}
                </Button>
              </div>
            </div>
          )}

          {/* Painel WhatsApp */}
          {panel === "wa" && evoActive && (
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs">Mensagem para {o.customer_phone}</Label>
              <Textarea rows={3} value={waMsg} onChange={(e) => setWaMsg(e.target.value)} placeholder="Escreve a mensagem de WhatsApp…" />
              <div className="flex justify-end">
                <Button size="sm" onClick={doWhatsApp} disabled={busy === "wa" || !waMsg.trim()}>
                  {busy === "wa" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />} Enviar WhatsApp
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, inline }: { label: string; value?: string | null; inline?: boolean }) {
  if (!value) return null;
  if (inline) {
    return <span className="font-medium break-words">{value}</span>;
  }
  return <div><span className="text-muted-foreground">{label}: </span><span className="font-medium break-words">{value}</span></div>;
}
