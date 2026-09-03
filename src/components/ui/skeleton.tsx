import { cn } from "@/lib/utils";

/**
 * Card 17 — Skeleton com shimmer animation (gradient brand).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("shimmer-skeleton", className)}
      {...props}
    />
  );
}

export { Skeleton };
