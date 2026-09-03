interface MetricRowProps {
  label: string;
  value: string | number | undefined;
  mono?: boolean;
}

export function MetricRow({ label, value, mono }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}
