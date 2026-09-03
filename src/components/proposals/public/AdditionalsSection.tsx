import { n, eur } from "./utils";
import type { PublicQuotationItem } from "@/types/quotation";

interface AdditionalsSectionProps {
  items: PublicQuotationItem[];
}

export function AdditionalsSection({ items }: AdditionalsSectionProps) {
  if (!items.length) return null;

  return (
    <div>
      <h2
        style={{
          fontFamily: "serif",
          fontSize: "1.25rem",
          color: "#1a1a2e",
          margin: "0 0 16px 0",
        }}
      >
        Itens Adicionais
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item, i) => (
          <div
            key={item.id || i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fff",
              borderRadius: 10,
              padding: "14px 18px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>
                {item.product_name}
              </p>
              {n(item.quantity) > 1 && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#718096" }}>
                  Qtd: {n(item.quantity)}
                </p>
              )}
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: 600,
                fontSize: 15,
                color: "#1a6b7c",
              }}
            >
              {eur(item.line_total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
