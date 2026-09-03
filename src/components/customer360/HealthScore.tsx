/**
 * HealthScore — indicador visual de saúde de uma Organization.
 * Reutilizável em todo o Hotelequip OS (Customer360, Pipeline, Listagens).
 * Cálculo mock por agora — preparado para injecção de lógica real.
 */

import { cn } from "@/lib/utils";

interface HealthScoreProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getScoreConfig(score: number) {
  if (score >= 90) return { label: "Excelente", color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" };
  if (score >= 75) return { label: "Bom", color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200" };
  if (score >= 50) return { label: "Atenção", color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" };
  return { label: "Crítico", color: "text-red-600", bg: "bg-red-50", ring: "ring-red-200" };
}

const SIZE_MAP = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
};

export function HealthScore({ score, size = "md", showLabel = true }: HealthScoreProps) {
  const config = getScoreConfig(score);

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-mono font-bold ring-2",
          SIZE_MAP[size],
          config.bg,
          config.color,
          config.ring,
        )}
      >
        {score}
      </div>
      {showLabel && (
        <div>
          <span className={cn("text-xs font-semibold", config.color)}>{config.label}</span>
        </div>
      )}
    </div>
  );
}
