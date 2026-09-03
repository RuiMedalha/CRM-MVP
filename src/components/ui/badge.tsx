import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Card 17 redesign — badges com ícones Lucide opcionais, soft tints.
 */

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-brand-sm",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-[rgb(244,63,94)]/10 text-[rgb(225,29,72)] border-[rgb(244,63,94)]/20 dark:bg-[rgb(244,63,94)]/20 dark:text-[rgb(252,165,165)]",
        success: "border-transparent bg-[rgb(16,185,129)]/10 text-[rgb(5,150,105)] border-[rgb(16,185,129)]/20 dark:bg-[rgb(16,185,129)]/20 dark:text-[rgb(110,231,183)]",
        warning: "border-transparent bg-[rgb(245,158,11)]/10 text-[rgb(180,83,9)] border-[rgb(245,158,11)]/30 dark:bg-[rgb(245,158,11)]/20 dark:text-[rgb(252,211,77)]",
        info: "border-transparent bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-200 dark:border-brand-700/40",
        outline: "text-foreground border-border",
        wa: "border-transparent bg-channel-wa1 text-white",
        tel: "border-transparent bg-channel-tel text-white",
        ai: "border-transparent bg-channel-ai text-white",
        ig: "border-transparent bg-channel-ig text-white",
        fb: "border-transparent bg-channel-fb text-white",
        atendimento: "border-transparent bg-state-atendimento text-white",
        urgente: "border-transparent bg-state-urgente text-white",
        ia: "border-transparent bg-state-ia text-white",
        pendente: "border-transparent bg-state-pendente text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: LucideIcon;
}

function Badge({ className, variant, icon: Icon, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
