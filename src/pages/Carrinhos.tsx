import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, RefreshCw, ShoppingCart, ExternalLink, User, Mail, Phone, MessageCircle, Send, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { listAbandonedCarts, getAbandonedCart, CART_STATUSES, type AbandonedCart } from "@/integrations/directus/abandoned-carts";
import { StatusSelect } from "@/components/orders/StatusSelect";
import { toast } from "@/hooks/use-toast";
import { sendCartEmail } from "@/integrations/directus/abandoned-carts";
import { sendTextViaEvolution } from "@/integrations/evolution/client";

/** Normaliza para número internacional (assume Portugal se 9 dígitos). */
function waNumber(phone?: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("351")) return d;
  if (d.length === 9) return "351" + d;
  return d;
}

/** Mensagem de recuperação pré-preenchida (WhatsApp/email). */
function recoveryMessage(cart: AbandonedCart): string {
  const nome = (cart.customer_name || "").split(" ")[0];
  const saudacao = nome ? `Olá ${nome}, ` : "Olá, ";
  const artigos = cart.items_count ? `os ${cart.items_count} artigo(s) que` : "o que";
  const link = cart.recovery_url ? `\n\nRetome aqui: ${cart.recovery_url}` : "";
  return `${saudacao}reparámos que ${artigos} deixou no carrinho na Hotelequip.pt ainda está disponível. Se precisar de ajuda ou de um orçamento, é só dizer.${link}`;
}

const eur = (n?: number | null, cur = "EUR") =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur || "EUR" }).format(Number(n) || 0);
const fmt = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
};

export default function Carrinhos() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState("abandoned");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [selected, setSelected] = useState<AbandonedCart | null>(null);
  const [panel, setPanel] = useState<"" | "wa" | "email">("");
  const [busy, setBusy] = useState<"" | "wa" | "email">("");
  const [waMsg, setWaMsg] = useState("");
  const [subject, setSubject] = useState("");
  const [emailMsg, setEmailMsg] = useState("");

  // Ao abrir um carrinho, prepara as mensagens de recuperação.
  useEffect(() => {
    if (!selected) return;
    setPanel("");
    setWaMsg(recoveryMessage(selected));
    setSubject("O seu carrinho na Hotelequip.pt");
    setEmailMsg(recoveryMessage(selected));
  }, [selected?.id]);

  // A produção encaminha Evolution exclusivamente pelo endpoint Directus /wa-proxy.
  const evoActive = true;
  const selPhone = waNumber(selected?.phone);

  async function doWhatsApp() {
    if (!selPhone) return;
    setBusy("wa");
    try {
      await sendTextViaEvolution(selPhone, waMsg);
      toast({ title: "WhatsApp enviado", description: selected?.phone });
      setPanel("");
    } catch (e: any) {
      toast({ title: "Falha no WhatsApp", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(""); }
  }

  async function doEmail() {
    if (!selected?.email) return;
    setBusy("email");
    try {
      await sendCartEmail({ to: selected.email, subject, message: emailMsg, customer_name: selected.customer_name });
      toast({ title: "Email enviado", description: selected.email });
      setPanel("");
    } catch (e: any) {
      toast({ title: "Falha no email", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(""); }
  }

  // deep-link do push: /carrinhos?cart=<id>
  useEffect(() => {
    const id = searchParams.get("cart");
    if (!id) return;
    getAbandonedCart(id).then((c) => {
      if (c) setSelected(c);
      setSearchParams({}, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 350); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => { setPage(1); }, [search, status]);

  const query = useQuery({
    queryKey: ["abandoned_carts", status, search, page],
    queryFn: () => listAbandonedCarts({ status, search, page, limit: pageSize }),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });
  const carts = query.data?.data || [];
  const total = query.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Carrinhos abandonados</h1>
            <p className="text-muted-foreground">Leads do site para recuperar — link de recuperação, contacto e valor do carrinho.</p>
          </div>
        </div>

        {/* filtros por estado */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setStatus("all")} className={`rounded-full px-3 py-1 text-xs font-medium ${status === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Todos</button>
          {CART_STATUSES.map((s) => (
            <button key={s.value} onClick={() => setStatus(s.value)} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s.label}</button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Pesquisar por nome, email, telefone…" className="pl-9" />
          </div>
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["abandoned_carts"] })}>
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="grid gap-2">
          {query.isLoading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : carts.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Sem carrinhos {status !== "all" ? "neste estado" : "ainda"}.</p>
            </CardContent></Card>
          ) : (
            carts.map((c) => (
              <Card key={c.id} className="border cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelected(c)}>
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{c.customer_name || "(sem nome)"}</span>
                        <StatusSelect
                          mode="cart"
                          id={c.id}
                          value={c.status}
                          options={CART_STATUSES}
                          queryKey={["abandoned_carts", status, search, page]}
                          onOptimistic={(next) => { c.status = next; }}
                          className="min-w-[140px]"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                        <span>{c.items_count || 0} art.</span>
                        <span>{fmt(c.date_abandoned || c.date_created)}</span>
                        {c.email && <span className="truncate max-w-[180px]">{c.email}</span>}
                        {c.phone && <span>{c.phone}</span>}
                      </div>
                    </div>
                    <div className="font-semibold whitespace-nowrap">{eur(c.cart_total, c.currency)}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">{total} carrinho(s)</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  {selected.customer_name || "Carrinho abandonado"}
                  <StatusSelect
                    mode="cart"
                    id={selected.id}
                    value={selected.status}
                    options={CART_STATUSES}
                    queryKey={["abandoned_carts", status, search, page]}
                    onOptimistic={(next) => { selected.status = next; }}
                    className="min-w-[160px]"
                  />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {selected.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{selected.email}</span>}
                  {selected.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selected.phone}</span>}
                </div>

                <div className="rounded-lg border divide-y">
                  {(selected.items || []).map((it, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">{it.sku ? `${it.sku} · ` : ""}Qt: {it.qty}</p>
                      </div>
                      <span className="whitespace-nowrap font-medium">{eur(it.line_total)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2.5 text-sm font-semibold">
                    <span>Total</span>
                    <span>{eur(selected.cart_total, selected.currency)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* WhatsApp — via API Evolution se ativa; senão abre o WhatsApp Web */}
                  {evoActive ? (
                    <Button size="sm" variant="outline" disabled={!selPhone} onClick={() => setPanel(panel === "wa" ? "" : "wa")}>
                      <MessageCircle className="h-4 w-4 mr-1 text-[#25D366]" /> WhatsApp
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!selPhone} title="WhatsApp não está ativo na API — abre o WhatsApp Web"
                      onClick={() => selPhone && window.open(`https://wa.me/${selPhone}?text=${encodeURIComponent(waMsg)}`, "_blank")}>
                      <MessageCircle className="h-4 w-4 mr-1 text-[#25D366]" /> WhatsApp
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={!selected.email} onClick={() => setPanel(panel === "email" ? "" : "email")}>
                    <Mail className="h-4 w-4 mr-1" /> Email
                  </Button>
                  {selected.recovery_url && (
                    <a href={selected.recovery_url} target="_blank" rel="noreferrer">
                      <Button size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Link de recuperação</Button>
                    </a>
                  )}
                  {selected.contact_id ? (
                    <Link to={`/customer360-shell/${selected.contact_id}`}>
                      <Button size="sm" variant="outline"><User className="h-4 w-4 mr-1" /> Ver contacto</Button>
                    </Link>
                  ) : null}
                  {selected.order_id ? (
                    <Badge variant="outline" className="text-xs">Pedido #{selected.order_id}</Badge>
                  ) : null}
                </div>

                {/* Painel WhatsApp */}
                {panel === "wa" && evoActive && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <Label className="text-xs">Mensagem para {selected.phone}</Label>
                    <Textarea rows={4} value={waMsg} onChange={(e) => setWaMsg(e.target.value)} placeholder="Mensagem de WhatsApp…" />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={doWhatsApp} disabled={busy === "wa" || !waMsg.trim()}>
                        {busy === "wa" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />} Enviar WhatsApp
                      </Button>
                    </div>
                  </div>
                )}

                {/* Painel Email */}
                {panel === "email" && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <Label className="text-xs">Assunto</Label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea rows={4} value={emailMsg} onChange={(e) => setEmailMsg(e.target.value)} placeholder="Mensagem para o cliente…" />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={doEmail} disabled={busy === "email" || !emailMsg.trim()}>
                        {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />} Enviar para {selected.email}
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">Abandonado {fmt(selected.date_abandoned || selected.date_created)}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
