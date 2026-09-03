import { AppLayout } from "@/components/layout/AppLayout";
import { SiteOrdersTab } from "@/components/orders/SiteOrdersTab";

export default function Pedidos() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Encomendas do site</h1>
          <p className="text-muted-foreground">Pedidos vindos de hotelequip.pt</p>
        </div>
        <SiteOrdersTab />
      </div>
    </AppLayout>
  );
}
