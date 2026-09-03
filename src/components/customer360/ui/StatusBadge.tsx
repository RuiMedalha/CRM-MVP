import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "muted";
  size?: "xs" | "sm";
}

const VARIANT_CLASSES: Record<string, string> = {
  default: "bg-gray-100 text-gray-700 border-gray-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  muted: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ label, variant = "default", size = "xs" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-mono font-semibold uppercase tracking-wide",
        size === "xs" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs",
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default
      )}
    >
      {label}
    </span>
  );
}
