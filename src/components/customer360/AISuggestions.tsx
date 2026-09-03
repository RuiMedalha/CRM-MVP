/**
 * AISuggestions — sugestões inteligentes baseadas no contexto da Organization.
 * Mock por agora — preparado para ligação ao proxy n8n/Anthropic.
 * Reutilizável: Customer360, Inbox (contextual).
 */

import { SectionCard } from "./ui/SectionCard";
import { Sparkles } from "lucide-react";

export interface AISuggestion {
  id: string;
  text: string;
  type: "info" | "action" | "warning";
}

interface AISuggestionsProps {
  suggestions: AISuggestion[];
}

const TYPE_STYLE = {
  info: "border-l-blue-300 bg-blue-50/50",
  action: "border-l-teal-300 bg-teal-50/50",
  warning: "border-l-amber-300 bg-amber-50/50",
};

export function AISuggestions({ suggestions }: AISuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <SectionCard title="Sugestões IA" action={<Sparkles className="h-3 w-3 text-muted-foreground" />}>
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className={`rounded-md border-l-[3px] px-3 py-2 text-[11.5px] text-foreground/80 leading-relaxed ${TYPE_STYLE[s.type]}`}
          >
            {s.text}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
