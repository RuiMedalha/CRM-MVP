import { cn } from "@/lib/utils";

export type ReplyChannelKey = "whatsapp_916" | "whatsapp_918" | "email";

export interface ChannelToggleOption {
  value: ReplyChannelKey;
  label: string;
  hint?: string;
}

const OPTIONS: ChannelToggleOption[] = [
  { value: "whatsapp_916", label: "WhatsApp 916", hint: "916 542 211" },
  { value: "whatsapp_918", label: "WhatsApp 918", hint: "918 346 615" },
  { value: "email", label: "Email", hint: "Geral" },
];

export interface ChannelToggleProps {
  value: ReplyChannelKey;
  onChange: (next: ReplyChannelKey) => void;
  disabled?: boolean;
  className?: string;
}

export function ChannelToggle({
  value,
  onChange,
  disabled,
  className,
}: ChannelToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Canal de resposta"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
              active
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
            title={opt.hint}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
