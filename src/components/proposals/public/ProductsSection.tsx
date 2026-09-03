import { useState, useCallback } from "react";
import { ProductCard } from "./ProductCard";
import { n } from "./utils";
import type { PublicQuotationItem } from "@/types/quotation";

interface ProductsSectionProps {
  items: PublicQuotationItem[];
  quotation: { urgency_discount_pct?: any; status?: string | null };
  onItemsChange?: (items: PublicQuotationItem[]) => void;
}

interface RemovedItem {
  item: PublicQuotationItem;
  index: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

export function ProductsSection({ items, quotation, onItemsChange }: ProductsSectionProps) {
  const hasUrgency = n(quotation.urgency_discount_pct) > 0;
  const status = quotation.status;
  const canRemove = status !== "approved" && status !== "rejected";

  const [removedItems, setRemovedItems] = useState<RemovedItem[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string | number>>(new Set());

  const handleRemove = useCallback((item: PublicQuotationItem, index: number) => {
    const itemId = item.id || `idx-${index}`;
    setHiddenIds((prev) => new Set([...prev, itemId]));

    const timeoutId = setTimeout(() => {
      setRemovedItems((prev) => prev.filter((r) => (r.item.id || `idx-${r.index}`) !== itemId));
      // Notify parent to recalculate total
      if (onItemsChange) {
        const remaining = items.filter((it, i) => {
          const id = it.id || `idx-${i}`;
          return id !== itemId;
        });
        onItemsChange(remaining);
      }
    }, 5000);

    setRemovedItems((prev) => [...prev, { item, index, timeoutId }]);
  }, [items, onItemsChange]);

  const handleRestore = useCallback((itemId: string | number) => {
    const found = removedItems.find((r) => (r.item.id || `idx-${r.index}`) === itemId);
    if (found) {
      clearTimeout(found.timeoutId);
      setRemovedItems((prev) => prev.filter((r) => r !== found));
    }
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, [removedItems]);

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", color: "#0f1923", margin: "0 0 20px" }}>
        Equipamentos Propostos
      </h2>
      <div className="he-products-grid">
      {items.map((item, i) => {
        const itemId = item.id || `idx-${i}`;
        if (hiddenIds.has(itemId)) return null;
        return (
          <ProductCard
            key={itemId}
            item={item}
            hasUrgency={hasUrgency}
            canRemove={canRemove}
            onRemove={() => handleRemove(item, i)}
          />
        );
      })}
      </div>

      {/* Toast for removed items */}
      {removedItems.map((removed) => {
        const itemId = removed.item.id || `idx-${removed.index}`;
        return (
          <div
            key={`toast-${itemId}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "#1a1a2e",
              color: "#fff",
              borderRadius: 8,
              fontSize: "0.875rem",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <span>Produto removido</span>
            <button
              type="button"
              onClick={() => handleRestore(itemId)}
              style={{
                background: "transparent",
                border: "none",
                color: "#5eead4",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              ↩ Restaurar
            </button>
          </div>
        );
      })}
    </div>
  );
}
