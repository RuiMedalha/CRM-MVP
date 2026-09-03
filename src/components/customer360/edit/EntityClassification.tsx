/**
 * EntityClassification — bloco de classificação obrigatório no topo da Ficha Mestre.
 * Tipo Jurídico + Papéis. Controla que campos são visíveis.
 * Estado local — não grava no Directus até os campos existirem.
 */

import { cn } from "@/lib/utils";

export type EntityType = "empresa" | "eni" | "particular" | "administracao_publica" | "associacao" | "outro";

export const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "empresa", label: "Empresa" },
  { value: "eni", label: "Empresário em Nome Individual" },
  { value: "particular", label: "Particular" },
  { value: "administracao_publica", label: "Administração Pública" },
  { value: "associacao", label: "Associação" },
  { value: "outro", label: "Outro" },
];

export type EntityRole = "lead" | "cliente" | "fornecedor" | "parceiro" | "fabricante" | "distribuidor" | "transportadora" | "prestador_servicos" | "instalador" | "subcontratado";

export const ENTITY_ROLES: { value: EntityRole; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "cliente", label: "Cliente" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "parceiro", label: "Parceiro" },
  { value: "fabricante", label: "Fabricante" },
  { value: "distribuidor", label: "Distribuidor" },
  { value: "transportadora", label: "Transportadora" },
  { value: "prestador_servicos", label: "Prestador de Serviços" },
  { value: "instalador", label: "Instalador" },
  { value: "subcontratado", label: "Subcontratado" },
];

interface EntityClassificationProps {
  entityType: EntityType;
  roles: EntityRole[];
  onTypeChange: (type: EntityType) => void;
  onRolesChange: (roles: EntityRole[]) => void;
}

export function EntityClassification({ entityType, roles, onTypeChange, onRolesChange }: EntityClassificationProps) {
  const toggleRole = (role: EntityRole) => {
    if (roles.includes(role)) {
      onRolesChange(roles.filter((r) => r !== role));
    } else {
      onRolesChange([...roles, role]);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-4">
      {/* Tipo Jurídico */}
      <div>
        <h3 className="text-[12px] font-semibold text-foreground mb-2">Tipo Jurídico</h3>
        <div className="flex flex-wrap gap-1.5">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onTypeChange(t.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                entityType === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Papéis */}
      <div>
        <h3 className="text-[12px] font-semibold text-foreground mb-2">Papéis</h3>
        <div className="flex flex-wrap gap-1.5">
          {ENTITY_ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleRole(r.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                roles.includes(r.value)
                  ? "bg-teal-50 text-teal-700 border-teal-300"
                  : "bg-card text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {roles.includes(r.value) ? "☑ " : "☐ "}{r.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground/60">
        Classificação local — será gravada no Directus quando os campos entity_type e roles forem criados.
      </p>
    </div>
  );
}
