import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Truck,
  ExternalLink,
  ArrowRight,
  Loader2,
  Calendar,
  CreditCard,
  Plus,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  listSiteOrdersForCustomer,
  listSiteOrdersByContact,
  convertOrderToProposal,
  getOrderTracking,
  type SiteOrder,
  ORDER_STATUSES,
} from "@/integrations/directus/site-orders";
import {
  listAbandonedCartsForCustomer,
  type AbandonedCart,
  CART_STATUSES,
} from "@/integrations/directus/abandoned-carts";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { CustomerRequestsPanel } from "@/components/contacts/CustomerRequestsPanel";
import { SectionCard } from "./ui/SectionCard";

interface CustomerOrdersTabProps {
  contactId?: string | number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

const eur = (n?: number | null, cur = "EUR") =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur || "EUR" }).format(Number(n) || 0);

function getStatusBadgeClass(status?: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "processing":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
    case "pending":
    case "on-hold":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
    case "cancelled":
    case "failed":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300";
    case "refunded":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function CustomerOrdersTab({
  contactId,
  contactName,
  contactEmail,
  contactPhone,
}: CustomerOrdersTabProps) {
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState<SiteOrder | null>(null);
  const [convertingId, setConvertingId] = useState<number | null>(null);

  const hasIdentifier = Boolean(
    (contactId !== undefined && contactId !== null && String(contactId).trim() !== "") ||
    (contactEmail && contactEmail.trim()) ||
    (contactPhone && contactPhone.trim())
  );

  const ordersQuery = useQuery({
    queryKey: ["site_orders", "customer", contactId, contactEmail, contactPhone],
    queryFn: () =>
      hasIdentifier
        ? listSiteOrdersForCustomer({
            contactId,
            email: contactEmail,
            phone: contactPhone,
            limit: 50,
          })
        : Promise.resolve([]),
    enabled: hasIdentifier,
  });

  const cartsQuery = useQuery({
    queryKey: ["abandoned_carts", "customer", contactId, contactEmail, contactPhone],
    queryFn: () =>
      hasIdentifier
        ? listAbandonedCartsForCustomer({
            contactId,
            email: contactEmail,
            phone: contactPhone,
            limit: 20,
          })
        : Promise.resolve([]),
    enabled: hasIdentifier,
  });

  const orders = ordersQuery.data || [];
  const carts = cartsQuery.data || [];

  const handleConvert = async (order: SiteOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    setConvertingId(order.id);
    try {
      const propId = await convertOrderToProposal(order);
      toast({
        title: "Orçamento criado com sucesso!",
        description: `Encomenda #${order.order_number || order.id} convertida em proposta.`,
      });
      navigate(`/propostas/${propId}/detalhe`);
    } catch (err) {
      toast({
        title: "Erro ao converter encomenda",
        description: String((err as Error)?.message || ""),
        variant: "destructive",
      });
    } finally {
      setConvertingId(null);
    }
  };

  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const completedCount = orders.filter((o) => o.status === "completed").length;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Resumo de Compras & Carrinhos / Métricas do Cliente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total Encomendas</p>
              <p className="text-lg font-bold text-foreground">{orders.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Valor Total Gasto</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{eur(totalSpent)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Concluídas</p>
              <p className="text-lg font-bold text-foreground">
                {completedCount} <span className="text-xs text-muted-foreground font-normal">({orders.length ? Math.round((completedCount / orders.length) * 100) : 0}%)</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Carrinhos no Site</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{carts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Encomendas */}
      <SectionCard
        title={`Histórico de Encomendas (${orders.length})`}
        action={
          <Link
            to="/pedidos"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Ver todas em Pedidos <ExternalLink className="h-3 w-3" />
          </Link>
        }
      >
        {ordersQuery.isLoading ? (
          <div className="space-y-3 p-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">Nenhuma encomenda registada</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              As encomendas efetuadas pelo cliente na loja online ou criadas no CRM aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const tracking = getOrderTracking(order);
              const statusObj = ORDER_STATUSES.find((s) => s.value === order.status);
              const statusLabel = statusObj?.label || order.status || "Pendente";
              const itemsCount = order.items?.length || 0;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-600 flex items-center justify-center shrink-0 font-bold text-xs">
                        #{order.order_number || order.wc_order_id || order.id}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            Encomenda #{order.order_number || order.wc_order_id || order.id}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadgeClass(
                              order.status
                            )}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {order.date_ordered && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(order.date_ordered).toLocaleDateString("pt-PT")}
                            </span>
                          )}
                          {order.payment_method_title && (
                            <span>· {order.payment_method_title}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-primary">{eur(order.total, order.currency)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {itemsCount} {itemsCount === 1 ? "artigo" : "artigos"}
                      </p>
                    </div>
                  </div>

                  {/* Lista de Itens resumida */}
                  {order.items && order.items.length > 0 && (
                    <div className="bg-muted/40 rounded-lg p-2 text-xs text-muted-foreground space-y-1 border border-border/40">
                      {order.items.slice(0, 3).map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="truncate max-w-[80%] font-medium text-foreground">
                            {it.qty || 1}x {it.name || "Artigo"}
                          </span>
                          <span>{eur(it.total || it.price)}</span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-[11px] text-muted-foreground font-medium pt-0.5">
                          + {order.items.length - 3} outros artigos
                        </p>
                      )}
                    </div>
                  )}

                  {/* Rodapé do Card com Tracking e Ações */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {(tracking.carrier || tracking.code) && (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                          <Truck className="h-3.5 w-3.5 text-blue-600" />
                          {[tracking.carrier, tracking.code].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {order.quotation_id && (
                        <span className="inline-flex items-center gap-1 text-purple-600 font-medium">
                          <FileText className="h-3 w-3" />
                          Proposta associada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!order.quotation_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={convertingId === order.id}
                          onClick={(e) => void handleConvert(order, e)}
                          className="h-7 text-xs gap-1 hover:border-primary/50"
                        >
                          {convertingId === order.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          Converter em Proposta
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-primary hover:text-primary"
                        onClick={() => setSelectedOrder(order)}
                      >
                        Ver Detalhe <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Carrinhos Abandonados / Criados no Site */}
      <SectionCard
        title={`Carrinhos Abandonados no Site (${carts.length})`}
        action={
          <Link
            to="/carrinhos"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Ver todos em Carrinhos <ExternalLink className="h-3 w-3" />
          </Link>
        }
      >
        {cartsQuery.isLoading ? (
          <div className="space-y-3 p-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : carts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-semibold text-foreground">Nenhum carrinho registado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Não existem carrinhos abandonados registados para este contacto.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {carts.map((cart) => {
              const statusObj = CART_STATUSES.find((s) => s.value === cart.status);
              const statusLabel = statusObj?.label || (cart.status === "converted" ? "Convertido em Encomenda" : "Abandonado");
              const isConverted = cart.status === "converted";
              const isRecovered = cart.status === "recovered";
              const itemsCount = cart.items_count || cart.items?.length || 0;

              return (
                <div
                  key={cart.id}
                  className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center shrink-0 font-bold text-xs">
                        🛒 #{cart.id}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            Carrinho #{cart.id} {cart.wp_cart_id ? `(WP #${cart.wp_cart_id})` : ""}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              isConverted
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : isRecovered
                                ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {cart.date_abandoned && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(cart.date_abandoned).toLocaleDateString("pt-PT", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                          {cart.order_id && <span>· Encomenda associada: #{cart.order_id}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-foreground">{eur(cart.cart_total, cart.currency)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {itemsCount} {itemsCount === 1 ? "artigo" : "artigos"}
                      </p>
                    </div>
                  </div>

                  {/* Itens do Carrinho */}
                  {cart.items && cart.items.length > 0 && (
                    <div className="bg-muted/40 rounded-lg p-2 text-xs text-muted-foreground space-y-1 border border-border/40">
                      {cart.items.slice(0, 3).map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="truncate max-w-[80%] font-medium text-foreground">
                            {it.qty || 1}x {it.name || "Artigo"}
                          </span>
                          <span>{eur(it.line_total || it.price)}</span>
                        </div>
                      ))}
                      {cart.items.length > 3 && (
                        <p className="text-[11px] italic text-muted-foreground pt-1">
                          + {cart.items.length - 3} outro(s) artigo(s)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                    {cart.recovery_url && (
                      <a
                        href={cart.recovery_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      >
                        Abrir Link de Recuperação <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Pedidos do Site (Pedidos de Informação, Assistência, Reclamações) */}
      <SectionCard title="Pedidos de Suporte & Contacto do Site">
        <CustomerRequestsPanel
          contactId={contactId}
          contactEmail={contactEmail}
          contactPhone={contactPhone}
        />
      </SectionCard>

      {/* Modal de Detalhe da Encomenda */}
      <OrderDetailModal
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
        onConverted={() => {
          ordersQuery.refetch();
        }}
      />
    </div>
  );
}
