import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Card 17 redesign — expressiva, gradient no primary, focus ring visível.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-brand-sm hover:shadow-brand-md hover:from-brand-700 hover:to-brand-800 border border-brand-700/20",
        gradient:
          "bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white shadow-brand-md hover:shadow-brand-lg border border-white/10",
        destructive:
          "bg-gradient-to-br from-[rgb(244,63,94)] to-[rgb(225,29,72)] text-white shadow-sm hover:shadow-md",
        success:
          "bg-gradient-to-br from-[rgb(16,185,129)] to-[rgb(5,150,105)] text-white shadow-sm hover:shadow-md",
        warning:
          "bg-gradient-to-br from-[rgb(245,158,11)] to-[rgb(217,119,6)] text-white shadow-sm hover:shadow-md",
        soft:
          "bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-100 dark:bg-brand-900/30 dark:text-brand-200 dark:border-brand-800/40",
        outline:
          "border border-brand-200 bg-background text-brand-700 hover:bg-brand-50 hover:border-brand-300 dark:border-brand-700 dark:text-brand-200 dark:hover:bg-brand-900/40",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40",
        link:
          "text-brand-600 underline-offset-4 hover:underline hover:text-brand-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
