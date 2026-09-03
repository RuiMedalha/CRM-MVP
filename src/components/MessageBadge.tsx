import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, ShieldCheck, Zap, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MessageBadgeProps {
  provider?: "evolution" | "meta" | "none" | string;
  instanceName?: string;
  phoneNumber?: string;
  className?: string;
  size?: "xs" | "sm" | "default";
  inverted?: boolean;
  showTooltip?: boolean;
}

export function MessageBadge({
  provider,
  instanceName,
  phoneNumber,
  className,
  size = "xs",
  inverted = false,
  showTooltip = true,
}: MessageBadgeProps) {
  const normProvider = String(provider || "").toLowerCase();

  // Se não for nem evolution nem meta, tenta inferir por instanceName ou retorna nulo
  const isEvolution =
    normProvider === "evolution" ||
    instanceName?.includes("918") ||
    instanceName?.includes("916") ||
    instanceName?.includes("evo");

  const isMeta =
    normProvider === "meta" ||
    normProvider === "waba" ||
    normProvider === "meta_cloud" ||
    instanceName?.includes("913") ||
    instanceName?.includes("waba");

  if (!isEvolution && !isMeta) {
    return null;
  }

  const labelText = isEvolution
    ? `via Evolution ${instanceName ? `· ${instanceName.replace(/^hotelequip-/, "")}` : ""}`
    : `via Meta Cloud ${phoneNumber ? `· ${phoneNumber.slice(-4)}` : instanceName ? `· ${instanceName}` : ""}`;

  const tooltipText = isEvolution
    ? `Mensagem roteada via Evolution API (${instanceName || "Instância WhatsApp"})`
    : `Mensagem roteada via Meta Cloud API Oficial WABA (${phoneNumber || instanceName || "913"})`;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0 h-4 gap-1 font-medium tracking-tight",
    sm: "text-xs px-2 py-0.5 h-5 gap-1.5 font-medium",
    default: "text-xs px-2.5 py-1 gap-2 font-medium",
  };

  const badgeElement = (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center select-none transition-colors border shadow-2xs",
        sizeClasses[size],
        isEvolution &&
          (inverted
            ? "border-emerald-400/40 bg-emerald-950/40 text-emerald-200"
            : "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"),
        isMeta &&
          (inverted
            ? "border-sky-400/40 bg-sky-950/40 text-sky-200"
            : "border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300"),
        className,
      )}
    >
      {isEvolution ? (
        <Radio className="h-2.5 w-2.5 shrink-0 text-emerald-500 animate-pulse" />
      ) : (
        <ShieldCheck className="h-2.5 w-2.5 shrink-0 text-sky-500" />
      )}
      <span className="truncate max-w-[140px]">{labelText}</span>
    </Badge>
  );

  if (!showTooltip) return badgeElement;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badgeElement}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default MessageBadge;
