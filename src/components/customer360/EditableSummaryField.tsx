/**
 * EditableSummaryField — campo clicável no resumo Customer360.
 * Mostra label + valor. Se vazio mostra "Adicionar".
 * Ao clicar, navega para tab Editar e destaca o campo.
 */

interface EditableSummaryFieldProps {
  label: string;
  value?: string;
  onEdit: () => void;
}

export function EditableSummaryField({ label, value, onEdit }: EditableSummaryFieldProps) {
  return (
    <div className="contents">
      <dt className="text-xs text-muted-foreground py-0.5">{label}</dt>
      <dd
        className="text-[12px] font-medium py-0.5 truncate cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-accent/50"
        onClick={onEdit}
        title={value ? `Clicar para editar ${label}` : `Clicar para adicionar ${label}`}
      >
        {value ? (
          <span className="text-foreground">{value}</span>
        ) : (
          <span className="text-primary/60 text-xs">+ Adicionar</span>
        )}
      </dd>
    </div>
  );
}
