import * as React from "react";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Master-detail layout: a mobile back flow and a persistent desktop two-column view. */
export interface ResponsiveDetailProps extends React.HTMLAttributes<HTMLDivElement> {
  list: React.ReactNode;
  detail: React.ReactNode;
  hasSelection: boolean;
  onBack?: () => void;
  backLabel?: string;
  listClassName?: string;
  detailClassName?: string;
}

export function ResponsiveDetail({ list, detail, hasSelection, onBack, backLabel = "Voltar à lista", listClassName, detailClassName, className, ...props }: ResponsiveDetailProps) {
  return (
    <div className={cn("min-h-0 md:grid md:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)] md:divide-x", className)} {...props}>
      <section className={cn(hasSelection ? "hidden md:block" : "block", listClassName)}>{list}</section>
      <section className={cn(hasSelection ? "block" : "hidden md:block", detailClassName)}>
        {hasSelection && onBack ? <Button variant="ghost" size="sm" className="mb-2 md:hidden" onClick={onBack}><ArrowLeft className="size-4" />{backLabel}</Button> : null}
        {detail}
      </section>
    </div>
  );
}
