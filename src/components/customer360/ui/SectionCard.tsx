import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function SectionCard({ title, children, className, action }: SectionCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      <div className="px-4 pb-3">
        {children}
      </div>
    </div>
  );
}
