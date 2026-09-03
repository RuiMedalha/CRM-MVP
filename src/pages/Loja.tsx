import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import {
  ShoppingBag, ShoppingCart, Euro, TrendingUp, PhoneCall, ExternalLink,
} from "lucide-react";
import {
  getWooOrders, getAbandonedCarts, computeStoreStats,
  type WooOrder, type AbandonedCart, type StoreStats,
} from "@/integrations/directus/store";
import { toast } from "@/hooks/use-toast";

const eur = (n: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
const rel = (d: string) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "há minutos";
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
};

const STATUS_TINT: Record<string, string> = {
  won: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  processing: "bg-blue-100 text-blue-800",
  "on-hold": "bg-amber-100 text-amber-800",
  pending: "bg-muted text-foreground",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-red-100 text-red-700",
};

export default function Loja() {
  const [orders, setOrders] = useState<WooOrder[]>([]);
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [o, c] = await Promise.all([getWooOrders(), getAbandonedCarts()]);
      if (!alive) return;
      setOrders(o);
      setCarts(c);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const stats: StoreStats = useMemo(
    () => computeStoreStats(orders, carts),
    [orders, carts],
  );

  const sendRecovery = (c: AbandonedCart) => {
    // Dispara o webhook n8n de recuperação (a criar). Por agora, feedback local.
    toast({ title: "Recuperação por ligar", description: `Carrinho de ${c.customer_name ?? c.customer_email ?? "cliente"} — webhook de recuperação a configurar.` });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-5 p-4">
        <header className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Loja</h1>
          <span className="text-sm text-muted-foreground">WooCommerce</span>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi icon={ShoppingBag} label="Encomendas hoje" value={loading ? "—" : String(stats.ordersToday)} />
          <Kpi icon={TrendingUp} label="Encomendas (mês)" value={loading ? "—" : String(stats.ordersMonth)} />
          <Kpi icon={Euro} label="Receita (mês)" value={loading ? "—" : eur(stats.revenueMonth)} />
          <Kpi icon={ShoppingCart} label="Carrinhos abandon." value={loading ? "—" : String(stats.abandonedCarts)} tone={stats.abandonedCarts > 0 ? "warn" : undefined} />
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Encomendas ({orders.length})</TabsTrigger>
            <TabsTrigger value="carts">Carrinhos abandonados ({carts.length})</TabsTrigger>
          </TabsList>

          {/* ENCOMENDAS */}
          <TabsContent value="orders">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Encomendas recentes</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {loading ? (
                  <>{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</>
                ) : orders.length === 0 ? (
                  <Empty text="Sem encomendas sincronizadas. Assim que o webhook Woo estiver activo, aparecem aqui." />
                ) : (
                  orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/40">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">#{o.woo_order_id}</span>
                          <Badge variant="secondary" className={STATUS_TINT[o.status] ?? ""}>{o.status}</Badge>
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {o.customer_id ? (
                            <Link to={`/customer360-shell/${o.customer_id}`} className="hover:underline">{o.customer_name ?? "Cliente"}</Link>
                          ) : (o.customer_name ?? "Cliente")}
                          <span className="mx-1">·</span>{rel(o.date_created)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">{eur(o.total_amount)}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CARRINHOS */}
          <TabsContent value="carts">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Carrinhos abandonados</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {loading ? (
                  <>{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</>
                ) : carts.length === 0 ? (
                  <Empty text="À espera de fonte de carrinhos. Confirma o plugin de carrinhos abandonados do Woo e ligamos o webhook — a UI já está pronta." />
                ) : (
                  carts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/40">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {c.customer_id ? (
                            <Link to={`/customer360-shell/${c.customer_id}`} className="hover:underline">{c.customer_name ?? c.customer_email}</Link>
                          ) : (c.customer_name ?? c.customer_email ?? "Visitante")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {c.items_count} artigo(s) · abandonado {rel(c.abandoned_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums">{eur(c.total)}</span>
                        {c.recovery_sent ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Recuperação enviada</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => sendRecovery(c)}>
                            <PhoneCall className="mr-1 h-3.5 w-3.5" /> Recuperar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Dados de encomendas via sincronização n8n (deals com origem Woo). Carrinhos abandonados ligam quando a fonte do plugin estiver configurada.
        </p>
      </div>
    </AppLayout>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${tone === "warn" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
