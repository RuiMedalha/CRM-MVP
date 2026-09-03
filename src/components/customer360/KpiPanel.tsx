import { SectionCard } from "./ui/SectionCard";

interface KpiPanelProps {
  annualValue?: number;
  potential?: string;
  totalProposals?: number;
  successRate?: number;
  daysSinceContact?: number;
  avgResponseTime?: string;
}

export function KpiPanel({
  annualValue,
  potential,
  totalProposals,
  successRate,
  daysSinceContact,
  avgResponseTime,
}: KpiPanelProps) {
  const kpis = [
    { label: "Valor anual", value: annualValue ? `€${annualValue.toLocaleString("pt-PT")}` : "—" },
    { label: "Potencial", value: potential ?? "—" },
    { label: "Total propostas", value: totalProposals?.toString() ?? "—" },
    { label: "Taxa sucesso", value: successRate != null ? `${successRate}%` : "—" },
    { label: "Dias s/ contacto", value: daysSinceContact?.toString() ?? "—" },
    { label: "Tempo médio resposta", value: avgResponseTime ?? "—" },
  ];

  return (
    <SectionCard title="KPIs">
      <div className="grid grid-cols-2 gap-2">
        {kpis.map(({ label, value }) => (
          <div key={label} className="rounded-md bg-muted/40 px-2.5 py-2 text-center">
            <div className="font-mono text-sm font-bold text-foreground tabular-nums">{value}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
