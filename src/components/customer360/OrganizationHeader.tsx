import { StatusBadge } from "./ui/StatusBadge";

interface KpiCardProps {
  label: string;
  value: string | number | undefined;
}

function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="text-center px-3">
      <div className="text-lg font-bold text-foreground font-mono tabular-nums">{value ?? "—"}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

interface OrganizationHeaderProps {
  name: string;
  status: string;
  roles: string[];
  assignedTo?: string;
  lastActivity?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  vatNumber?: string;
  createdAt?: string;
  // KPIs
  annualValue?: number;
  pipelineActive?: number;
  dealsWon?: number;
  dealsLost?: number;
  commercialScore?: number;
  lastContactDays?: number;
  // Actions
  onNewProposal?: () => void;
  onNewQuotation?: () => void;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
  lead: "warning",
  qualified: "info",
  active: "success",
  inactive: "muted",
  churned: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  active: "Cliente",
  inactive: "Inactivo",
  churned: "Perdido",
};

const ROLE_LABEL: Record<string, string> = {
  customer: "Cliente",
  supplier: "Fornecedor",
  partner: "Parceiro",
  prospect: "Prospect",
};

export function OrganizationHeader({
  name, status, roles, assignedTo, lastActivity,
  city, phone, email, website, vatNumber, createdAt,
  annualValue, pipelineActive, dealsWon, dealsLost, commercialScore, lastContactDays, nextTask,
  onNewProposal, onNewQuotation,
}: OrganizationHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      {/* Left — Identity */}
      <div className="min-w-0 flex-1">
          {/* Name + badges + Quick CTA buttons */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h1 className="text-xl font-bold text-foreground truncate">{name}</h1>
            <StatusBadge label={STATUS_LABEL[status] ?? status} variant={STATUS_VARIANT[status] ?? "muted"} size="sm" />
            {roles.map((r) => (
              <StatusBadge key={r} label={ROLE_LABEL[r] ?? r} variant="info" />
            ))}

            {/* Prominent header action buttons */}
            <div className="flex items-center gap-2 ml-auto sm:ml-2">
              {onNewProposal && (
                <button
                  type="button"
                  onClick={onNewProposal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer"
                  title="Criar nova proposta comercial com pré-visualização e PDF"
                >
                  <span className="text-sm leading-none font-bold">+</span> Nova Proposta
                </button>
              )}
              {onNewQuotation && (
                <button
                  type="button"
                  onClick={onNewQuotation}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer"
                  title="Criar novo orçamento tradicional com discriminação de IVA e produtos"
                >
                  <span className="text-sm leading-none font-bold">+</span> Novo Orçamento
                </button>
              )}
            </div>
          </div>

          {/* Info line */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {assignedTo && (
              <span className="flex items-center gap-1">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary">{assignedTo.charAt(0)}</span>
                {assignedTo}
              </span>
            )}
            {lastActivity && <span>🕐 {lastActivity}</span>}
            {createdAt && <span>Cliente desde {createdAt}</span>}
            {city && <span>📍 {city}</span>}
            {phone && <span>📞 {phone}</span>}
            {email && <span>✉️ {email}</span>}
            {website && <span>🌐 {website}</span>}
            {vatNumber && <span className="font-mono">NIF {vatNumber}</span>}
          </div>
        </div>

        {/* Right — KPI cards */}
        <div className="hidden lg:flex items-center gap-1 divide-x divide-border">
          <KpiCard label="Valor anual" value={annualValue ? `€${(annualValue / 1000).toFixed(0)}k` : undefined} />
          <KpiCard label="Pipeline" value={pipelineActive} />
          <KpiCard label="Ganhos" value={dealsWon} />
          <KpiCard label="Perdidos" value={dealsLost} />
          <KpiCard label="Score" value={commercialScore ? `${commercialScore}%` : undefined} />
          <KpiCard label="Dias s/ contacto" value={lastContactDays} />
        </div>
      </div>
  );
}
