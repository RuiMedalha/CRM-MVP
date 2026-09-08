import { cn } from "@/lib/utils";
import type { InboxStatusKey } from "./types";

export interface InboxFilterChipsProps {
  value: InboxStatusKey;
  onChange: (next: InboxStatusKey) => void;
  counts?: Partial<Record<InboxStatusKey, number>>;
  className?: string;
}

const CHIPS: Array<{ value: InboxStatusKey; label: string }> = [
  { value: "all", label: "Tudo" },
  { value: "unread", label: "Não lidos" },
  { value: "mine", label: "Meus" },
  { value: "sla_breached", label: "SLA vencido" },
];

export function InboxFilterChips({
  value,
  onChange,
  counts,
  className,
}: InboxFilterChipsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filtros do inbox"
      className={cn(
        "flex flex-wrap items-center gap-1.5 border-b border-border bg-background px-3 py-2",
        className,
      )}
    >
      {CHIPS.map((chip) => {
        const active = chip.value === value;
        const count = counts?.[chip.value];
        return (
          <button
            key={chip.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{chip.label}</span>
            {typeof count === "number" && count > 0 ? (
              <span
                className={cn(
                  "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
