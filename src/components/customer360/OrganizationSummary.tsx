/**
 * OrganizationSummary — resumo editável da empresa no Customer360.
 * Cada campo é clicável e navega para a Ficha Mestre.
 */

import { SectionCard } from "./ui/SectionCard";
import { EditableSummaryField } from "./EditableSummaryField";

interface OrganizationSummaryProps {
  vatNumber?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  district?: string;
  origin?: string;
  segment?: string;
  businessType?: string;
  assignedTo?: string;
  entityType?: string;
  entityStatus?: string;
  onEditField?: () => void;
}

export function OrganizationSummary(props: OrganizationSummaryProps) {
  const edit = props.onEditField || (() => {});

  const fields: Array<{ label: string; value?: string }> = [
    { label: "NIF", value: props.vatNumber },
    { label: "Telefone", value: props.phone },
    { label: "Email", value: props.email },
    { label: "Website", value: props.website },
    { label: "Morada", value: props.address },
    { label: "Cód. Postal", value: props.postalCode },
    { label: "Cidade", value: props.city },
    { label: "Distrito", value: props.district },
    { label: "Origem", value: props.origin },
    { label: "Segmento", value: props.segment },
    { label: "Tipo Negócio", value: props.businessType },
    { label: "Responsável", value: props.assignedTo },
  ];

  return (
    <SectionCard title="Empresa">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {fields.map(({ label, value }) => (
          <EditableSummaryField key={label} label={label} value={value} onEdit={edit} />
        ))}
      </dl>
    </SectionCard>
  );
}
