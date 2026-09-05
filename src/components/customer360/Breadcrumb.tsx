import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Breadcrumb horizontal compacto, usado no topo do Customer 360 shell.
 *  • Mobile: mostra só 2 níveis (Home › último).
 *  • Desktop: mostra todos os níveis.
 */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;
  // Em mobile, mostrar apenas Home › último
  const display = items.length <= 2 ? items : [items[0], items[items.length - 1]];

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {display.map((item, idx) => {
        const isLast = idx === display.length - 1;
        const isFirst = idx === 0;
        return (
          <span key={`${item.label}-${idx}`} className="flex items-center gap-1 min-w-0">
            {idx > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            )}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors truncate"
              >
                {isFirst && <Home className="h-3 w-3 shrink-0" />}
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate",
                  isLast ? "text-foreground font-medium" : "",
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
