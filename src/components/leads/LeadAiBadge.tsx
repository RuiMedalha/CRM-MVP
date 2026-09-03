/**
 * Card 16 — Badge "AI: qualified N" + botão "Ver raciocínio" na lista de leads.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sparkles, Brain } from "lucide-react";
import { listAiAgentRuns } from "@/services/ai/agents";
import {
  AiAgentRunRow,
  LeadQualifierOutput,
} from "@/services/ai/agents/types";

interface Props {
  lead: { id: string | number };
}

function pickLatestQualifier(runs: AiAgentRunRow[]): AiAgentRunRow | null {
  const filtered = runs
    .filter((r) => r.agent_type === "lead_qualifier")
    .sort((a, b) =>
      (b.date_created || "").localeCompare(a.date_created || "")
    );
  return filtered[0] || null;
}

export function LeadAiBadge({ lead }: Props) {
  const [run, setRun] = useState<AiAgentRunRow | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listAiAgentRuns({
      leadId: String(lead.id),
      agentType: "lead_qualifier",
      limit: 5,
    })
      .then((rows) => {
        if (active) setRun(pickLatestQualifier(rows));
      })
      .catch(() => {
        if (active) setRun(null);
      });
    return () => {
      active = false;
    };
  }, [lead.id]);

  if (!run) return null;

  const out = run.output_payload as LeadQualifierOutput | undefined;
  const score = out?.qualification_score;

  return (
    <div className="inline-flex items-center gap-1">
      {typeof score === "number" && (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200"
          title={`Confiança ${(run.confidence_score ?? 0).toFixed(2)}`}
        >
          <Sparkles className="h-3 w-3 mr-0.5" />
          AI: qualified {Math.round(score)}
        </Badge>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[10px] gap-1"
            title="Ver raciocínio do agente"
          >
            <Brain className="h-3 w-3" />
            Ver raciocínio
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Lead Qualifier</span>
            <span className="text-muted-foreground">
              conf {(run.confidence_score ?? 0).toFixed(2)}
            </span>
          </div>
          {out && (
            <ul className="list-disc pl-4 space-y-1">
              {out.key_signals?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {out?.recommended_action && (
            <p className="text-muted-foreground">
              <strong>Acção:</strong> {out.recommended_action}
            </p>
          )}
          {out?.suggested_stage && (
            <p className="text-muted-foreground">
              <strong>Stage:</strong> {out.suggested_stage}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}