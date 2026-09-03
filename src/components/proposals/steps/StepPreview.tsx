import { useState } from "react";
import { useProposalForm } from "@/contexts/ProposalFormContext";
import { calculateProposalTotals } from "@/lib/money/proposalEngine";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepPreview() {
  const { state } = useProposalForm();
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  // Motor financeiro canónico — cálculo único para todos os canais
  const allItems = [...state.items, ...state.additional_items];
  const engineItems = allItems.map((i) => ({
    unit_price: i.unit_price || 0,
    quantity: i.quantity || 1,
    discount_percent: i.discount_percent || 0,
    iva_percent: (i as any).iva_percent || 0,
  }));
  const totals = calculateProposalTotals({
    items: engineItems,
    urgency_discount_pct: state.urgency_discount_pct || 0,
  });
  const subtotal = totals.subtotalSemIva;
  const total = totals.total;
  const additionalTotal = state.additional_items.reduce((sum, i) => sum + (i.line_total || 0), 0);

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex justify-center gap-2">
        <Button
          variant={viewMode === "desktop" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("desktop")}
        >
          <Monitor className="h-4 w-4 mr-1.5" />
          Desktop
        </Button>
        <Button
          variant={viewMode === "mobile" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("mobile")}
        >
          <Smartphone className="h-4 w-4 mr-1.5" />
          Mobile
        </Button>
      </div>

      {/* Preview frame */}
      <div className="flex justify-center">
        <div
          className={cn(
            "border rounded-xl shadow-lg overflow-hidden bg-white dark:bg-zinc-950 transition-all",
            viewMode === "desktop" ? "w-full max-w-3xl" : "w-[375px]"
          )}
        >
          <div className="p-6 md:p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">HotelEquip</h2>
              <p className="text-muted-foreground">
                Olá {state.treatment || ""} {state.customer_name || "Cliente"},
              </p>
            </div>

            {/* Welcome message */}
            {state.welcome_message && (
              <p className="text-sm leading-relaxed">
                {state.welcome_message.replace("{nome_cliente}", state.customer_name || "Cliente")}
              </p>
            )}

            {/* Urgency banner */}
            {(state.urgency_discount_pct || 0) > 0 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                <p className="text-sm font-bold text-red-700 dark:text-red-400">
                  OFERTA POR TEMPO LIMITADO
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  {state.urgency_discount_pct}% de desconto se aceitar em {state.urgency_hours}h
                </p>
              </div>
            )}

            {/* Products */}
            {state.items.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Produtos / Serviços</h3>
                {state.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                    {item.image_url && (
                      <img src={item.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold">€{(item.line_total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Additional items */}
            {state.additional_items.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Serviços adicionais</h3>
                {state.additional_items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg border-dashed">
                    <span className="text-sm">{item.product_name}</span>
                    <span className="text-sm font-semibold">€{(item.line_total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              {additionalTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Serviços adicionais</span>
                  <span>€{additionalTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>TOTAL</span>
                <span>€{total.toFixed(2)}</span>
              </div>
              {state.deposit_type === "partial" && (
                <p className="text-xs text-muted-foreground text-right">
                  Sinal de {state.deposit_percent}%: €{(total * (state.deposit_percent / 100)).toFixed(2)}
                </p>
              )}
            </div>

            {/* Reviews */}
            {state.reviews.length > 0 && (
              <div className="space-y-2 pt-4">
                <h3 className="font-semibold text-sm">O que dizem os nossos clientes</h3>
                {state.reviews.map((review, i) => (
                  <div key={i} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{review.reviewer_name}</span>
                      <span className="text-yellow-500 text-xs">{"★".repeat(review.rating)}</span>
                    </div>
                    {review.review_text && (
                      <p className="text-xs text-muted-foreground mt-1">{review.review_text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons (preview only, non-functional) */}
            <div className="flex gap-3 pt-4">
              <div className="flex-1 bg-green-600 text-white text-center py-3 rounded-lg text-sm font-medium">
                ✅ Aprovar proposta
              </div>
              <div className="flex-1 border text-center py-3 rounded-lg text-sm font-medium">
                ❌ Recusar
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
