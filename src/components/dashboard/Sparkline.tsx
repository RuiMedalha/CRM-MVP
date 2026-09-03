import * as React from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

import { cn } from "@/lib/utils";

/**
 * Sparkline — micro gráfico embebido em KPI cards.
 * Pinta gradiente brand → transparente por baixo da curva.
 */
export interface SparklineProps {
  data: number[];
  /** Cor da linha (sem sufixo). Aceita hex/rgb. */
  color?: string;
  height?: number;
  className?: string;
  /** Mostrar ponto final. */
  showEndDot?: boolean;
  /** Label para tooltip (aria-label only — chart não é interativo). */
  ariaLabel?: string;
}

export function Sparkline({
  data,
  color = "rgb(79 70 229)",
  height = 36,
  className,
  showEndDot = false,
  ariaLabel,
}: SparklineProps) {
  if (!data?.length) {
    return (
      <div
        aria-hidden
        className={cn("h-9 w-full shimmer-skeleton", className)}
        style={{ height }}
      />
    );
  }

  const chartData = data.map((v, i) => ({ i, v }));
  const gradientId = React.useId();
  const last = data[data.length - 1] ?? 0;

  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel ?? `Tendência últimos ${data.length} pontos: ${last}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.30} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-${gradientId})`}
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
            dot={false}
            activeDot={
              showEndDot
                ? { r: 3, fill: color, stroke: "white", strokeWidth: 2 }
                : false
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Sparkline;
