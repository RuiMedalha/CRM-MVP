/**
 * EntitySection — card reutilizável para secções da Ficha Mestre.
 * Consistente com o design system do Customer360.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EntitySectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function EntitySection({ title, subtitle, children, className }: EntitySectionProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="px-4 pt-3.5 pb-2">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-4 pb-4">
        {children}
      </div>
    </div>
  );
}
