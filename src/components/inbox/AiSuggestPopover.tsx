import { useState } from "react";
import { Sparkles, Loader2, Wand2, ListChecks, CalendarClock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type AiSuggestionKind = "short" | "technical" | "followup";

export interface AiSuggestionOption {
  kind: AiSuggestionKind;
  label: string;
  description: string;
  icon: typeof Sparkles;
  prompt: string;
}

export const AI_SUGGESTION_OPTIONS: AiSuggestionOption[] = [
  {
    kind: "short",
    label: "Resposta curta",
    description: "Tom humano, 1–2 frases, ideal para WhatsApp.",
    icon: Wand2,
    prompt:
      "Gera uma resposta MUITO curta (1-2 frases), simpática, em Português de Portugal, sem markdown, sem aspas. Sem saudações repetidas.",
  },
  {
    kind: "technical",
    label: "Resposta técnica c/ catálogo",
    description: "Recomenda produtos da HotelEquip com referência SKU.",
    icon: ListChecks,
    prompt:
      "Recomenda 1-2 produtos do catálogo HotelEquip adequados ao que o cliente pediu, indica SKU aproximado e a justificação técnica em 2-3 frases.",
  },
  {
    kind: "followup",
    label: "Follow-up agendado",
    description: "Marca retorno em 24-48h com objetivo claro.",
    icon: CalendarClock,
    prompt:
      "Propõe um follow-up objetivo (24-48h) com pergunta de retorno, em 1-2 frases, sem markdown e em Português de Portugal.",
  },
];

export interface AiSuggestPopoverProps {
  disabled?: boolean;
  loading?: boolean;
  onSelect: (option: AiSuggestionOption) => void;
  className?: string;
}

export function AiSuggestPopover({
  disabled,
  loading,
  onSelect,
  className,
}: AiSuggestPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
            className,
          )}
          title="Sugerir resposta com IA"
          aria-label="Sugerir resposta com IA"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-amber-500" />
          )}
          <span className="hidden md:inline">
            ✨ Sugerir resposta
          </span>
          <span className="md:hidden">Sugerir</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80 p-2">
        <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Como quer que a IA responda?
        </p>
        <div className="space-y-1">
          {AI_SUGGESTION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.kind}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(opt);
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-muted"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">
                    {opt.label}
                  </span>
                  <span className="block text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
