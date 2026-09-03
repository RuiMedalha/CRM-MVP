import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        wa: "border-transparent bg-channel-wa1 text-white hover:bg-channel-wa1/85",
        tel: "border-transparent bg-channel-tel text-white hover:bg-channel-tel/85",
        ai: "border-transparent bg-channel-ai text-white hover:bg-channel-ai/85",
        ig: "border-transparent bg-channel-ig text-white hover:bg-channel-ig/85",
        fb: "border-transparent bg-channel-fb text-white hover:bg-channel-fb/85",
        atendimento: "border-transparent bg-state-atendimento text-white hover:bg-state-atendimento/85",
        urgente: "border-transparent bg-state-urgente text-white hover:bg-state-urgente/85",
        ia: "border-transparent bg-state-ia text-white hover:bg-state-ia/85",
        pendente: "border-transparent bg-state-pendente text-white hover:bg-state-pendente/85",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
