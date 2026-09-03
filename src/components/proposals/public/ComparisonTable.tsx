import { useSlideUp } from "@/hooks/useIntersectionAnimation";
import { Star, FileText } from "lucide-react";
import { eur } from "./utils";
import type { PublicQuotationItem } from "@/types/quotation";

interface ComparisonTableProps {
  items: PublicQuotationItem[];
  companyName: string;
  recommendationText?: string;
}

export function ComparisonTable({ items, companyName, recommendationText }: ComparisonTableProps) {
  const { ref, className } = useSlideUp<HTMLDivElement>();

  if (items.length < 2) return null;

  // Collect all unique spec labels
  const allLabels: string[] = [];
  items.forEach((item) => {
    (item.comparison_specs || []).forEach((spec) => {
      if (!allLabels.includes(spec.label)) allLabels.push(spec.label);
    });
  });

  // Add price as first row
  const recommended = items.find((i) => i.is_recommended);

  return (
    <div ref={ref} className={className}>
      <div className="mb-6">
        <h2 className="he-title text-2xl mb-2">Comparação de Opções</h2>
        <div className="he-dots-wide max-w-[80px]" aria-hidden="true" />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block he-card overflow-hidden">
        <table className="he-comparison-table">
          <thead>
            <tr>
              <th style={{ width: "30%" }} />
              {items.map((item, i) => (
                <th key={i} className="text-center">
                  <div className="space-y-2 py-2">
                    <p className="text-sm font-medium normal-case" style={{ color: "var(--he-text)", letterSpacing: 0 }}>
                      {item.product_name}
                    </p>
                    {item.is_recommended && (
                      <span className="he-badge-recommended">
                        <Star className="h-3 w-3" /> Recomendado
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium">Preço</td>
              {items.map((item, i) => (
                <td key={i} className="text-center">
                  <span className="he-price text-lg">€{eur(item.unit_price)}</span>
                </td>
              ))}
            </tr>
            {allLabels.map((label) => (
              <tr key={label}>
                <td className="font-medium">{label}</td>
                {items.map((item, i) => {
                  const spec = (item.comparison_specs || []).find((s) => s.label === label);
                  return (
                    <td key={i} className="text-center">
                      {spec?.value || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td />
              {items.map((item, i) => (
                <td key={i} className="text-center">
                  {item.datasheet_url && (
                    <a
                      href={item.datasheet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium"
                      style={{ color: "var(--he-teal)" }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Ficha técnica
                    </a>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {[...items].sort((a, b) => (b.is_recommended ? 1 : 0) - (a.is_recommended ? 1 : 0)).map((item, i) => (
          <div
            key={i}
            className={`he-card p-4 space-y-3 ${item.is_recommended ? "he-comparison-recommended" : ""}`}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{item.product_name}</h4>
              {item.is_recommended && (
                <span className="he-badge-recommended text-xs">
                  <Star className="h-3 w-3" /> Recomendado
                </span>
              )}
            </div>
            <p className="he-price text-xl">€{eur(item.unit_price)}</p>
            {(item.comparison_specs || []).map((spec, j) => (
              <div key={j} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: "var(--he-border)" }}>
                <span style={{ color: "var(--he-text-muted)" }}>{spec.label}</span>
                <span className="font-medium">{spec.value}</span>
              </div>
            ))}
            {item.datasheet_url && (
              <a
                href={item.datasheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium pt-1"
                style={{ color: "var(--he-teal)" }}
              >
                <FileText className="h-3.5 w-3.5" />
                Ver ficha técnica
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Recommendation text */}
      {recommendationText && (
        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: "rgba(26, 107, 124, 0.05)" }}>
          <p className="text-sm leading-relaxed" style={{ color: "var(--he-text)" }}>
            <strong>Recomendação {companyName}:</strong> {recommendationText}
          </p>
        </div>
      )}
    </div>
  );
}
