import { Inbox, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmailFilters as EmailFiltersType } from "@/hooks/useEmailThreads";

const MAILBOXES = [
  { value: "", label: "Todas as caixas" },
  { value: "apoio.cliente@hotelequip.pt", label: "apoio.cliente@" },
  { value: "geral@hotelequip.pt", label: "geral@" },
];

const STATUSES = [
  { value: "", label: "Todos os estados" },
  { value: "queued", label: "Na fila" },
  { value: "assigned", label: "Assumido" },
  { value: "replied", label: "Respondido" },
  { value: "closed", label: "Fechado" },
  { value: "snoozed", label: "Adiado" },
];

const CATEGORIES = [
  { value: "", label: "Todas as categorias" },
  { value: "pedido_orcamento", label: "Orçamento" },
  { value: "followup_cliente", label: "Follow-up" },
  { value: "reclamacao", label: "Reclamação" },
  { value: "compra_cliente", label: "Compra" },
  { value: "fornecedor_sourcing", label: "Sourcing" },
  { value: "tabela_precos_fornecedor", label: "Tabela preços" },
  { value: "compra_fornecedor", label: "Compra forn." },
  { value: "fatura_administrativo", label: "Fatura/Admin" },
  { value: "spam", label: "Spam" },
  { value: "outro", label: "Outro" },
];

interface Props {
  filters: EmailFiltersType;
  onChange: (filters: EmailFiltersType) => void;
  search: string;
  onSearchChange: (value: string) => void;
  unassignedCount: number;
}

export function EmailFilterBar({ filters, onChange, search, onSearchChange, unassignedCount }: Props) {
  const toggleUnassigned = () =>
    onChange({ ...filters, onlyUnassigned: !filters.onlyUnassigned });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Fila comum toggle */}
      <button
        type="button"
        onClick={toggleUnassigned}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors border",
          filters.onlyUnassigned
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-muted text-muted-foreground border-border hover:bg-accent"
        )}
      >
        <Inbox className="h-3.5 w-3.5" />
        Fila comum
        {unassignedCount > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">
            {unassignedCount > 99 ? "99+" : unassignedCount}
          </span>
        )}
      </button>

      {/* Mailbox */}
      <Select
        value={filters.mailbox || "__all__"}
        onValueChange={(v) => onChange({ ...filters, mailbox: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MAILBOXES.map((m) => (
            <SelectItem key={m.value || "__all__"} value={m.value || "__all__"}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select
        value={filters.status || "__all__"}
        onValueChange={(v) => onChange({ ...filters, status: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value || "__all__"} value={s.value || "__all__"}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Category */}
      <Select
        value={filters.category || "__all__"}
        onValueChange={(v) => onChange({ ...filters, category: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.value || "__all__"} value={c.value || "__all__"}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative ml-auto min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar assunto / remetente"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>
    </div>
  );
}
