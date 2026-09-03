/**
 * StatusSelect — dropdown reutilizável para mudar o status de uma encomenda
 * ou carrinho abandonado. Optimistic update via react-query + toast de feedback.
 *
 * Suporta dois modos:
 *   - "order": usa SiteOrderStatusValue + ORDER_STATUSES
 *   - "cart": usa CartStatus + CART_STATUSES
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  updateSiteOrderStatus,
  type SiteOrderStatusValue,
} from "@/integrations/directus/site-orders";
import {
  updateAbandonedCartStatus,
  type CartStatus,
} from "@/integrations/directus/abandoned-carts";

interface OrderProps {
  mode: "order";
  id: number | string;
  value: string | undefined;
  options: { value: string; label: string }[];
  /** Chave react-query a invalidar após o update (ex: ["site_orders", status, page]). */
  queryKey?: readonly unknown[];
  /** Optimistic update no cache antes da resposta (opcional). */
  onOptimistic?: (newStatus: string) => void;
  /** Se true, ocupa a largura toda do pai. */
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
}

interface CartProps {
  mode: "cart";
  id: number | string;
  value: string | undefined;
  options: { value: string; label: string }[];
  queryKey?: readonly unknown[];
  onOptimistic?: (newStatus: string) => void;
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
}

type Props = OrderProps | CartProps;

export function StatusSelect(props: Props) {
  const qc = useQueryClient();
  const [localValue, setLocalValue] = useState(props.value);

  const mutation = useMutation({
    mutationFn: async (next: string) => {
      if (next === localValue) return null;
      if (props.mode === "order") {
        return updateSiteOrderStatus(props.id, next as SiteOrderStatusValue);
      } else {
        return updateAbandonedCartStatus(props.id, next as CartStatus);
      }
    },
    onMutate: async (next) => {
      // Optimistic
      const prev = localValue;
      setLocalValue(next);
      props.onOptimistic?.(next);
      return { prev };
    },
    onError: (err, _next, ctx) => {
      // Reverter
      if (ctx?.prev) setLocalValue(ctx.prev);
      const description = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro ao mudar status", description, variant: "destructive" });
    },
    onSuccess: (_data, next) => {
      toast({
        title: "Status actualizado",
        description: `Novo estado: ${props.options.find((o) => o.value === next)?.label ?? next}`,
      });
      if (props.queryKey) {
        qc.invalidateQueries({ queryKey: props.queryKey as readonly unknown[] });
      }
    },
  });

  const widthClass = props.fullWidth ? "w-full" : "w-auto";

  return (
    <div
      className={widthClass}
      onClick={(e) => {
        // não abrir o card/modal-pai quando se clica no select
        e.stopPropagation();
      }}
    >
      <Select
        value={localValue ?? ""}
        onValueChange={(next) => mutation.mutate(next)}
        disabled={props.disabled || mutation.isPending}
      >
        <SelectTrigger className={`h-7 w-full text-xs ${props.className ?? ""}`}>
          {mutation.isPending ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> a gravar…
            </span>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {props.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
