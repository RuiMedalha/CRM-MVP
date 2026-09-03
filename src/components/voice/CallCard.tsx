/**
 * CallCard — Card de ultima chamada com analise AI para Customer 360.
 * Mobile-first: formato compacto.
 */

import { useAiCallRunByCall, useLatestCallRunByContact } from "../../hooks/voice/useAiCallRun";
import { AiCallRun } from "../../integrations/directus/ai-call-runs";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { ChevronDown, ChevronUp, Phone, Clock, Bot, Play } from "lucide-react";
import { cn } from "../../lib/utils";
import { useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────

const SENTIMENT_CONFIG: Record<string, { label: string; color: string }> = {
  positive: { label: "Positivo", color: "bg-green-100 text-green-800 border-green-300" },
  neutral: { label: "Neutro", color: "bg-gray-100 text-gray-700 border-gray-300" },
  negative: { label: "Negativo", color: "bg-red-100 text-red-800 border-red-300" },
  unknown: { label: "---", color: "bg-gray-50 text-gray-400 border-gray-200" },
};

function formatDuration(seconds?: number | null): string {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  const cfg = SENTIMENT_CONFIG[sentiment || "unknown"] || SENTIMENT_CONFIG.unknown;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", cfg.color)}>
      {sentiment === "positive" && "👍"}
      {sentiment === "negative" && "👎"}
      {sentiment === "neutral" && "➖"}
      {sentiment || "---"}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────

interface CallCardProps {
  callId?: number | string;
  contactCallIds?: (number | string)[];
  compact?: boolean;
  className?: string;
}

export function CallCard({ callId, contactCallIds, compact, className }: CallCardProps) {
  const [open, setOpen] = useState(false);

  const singleQuery = useAiCallRunByCall(callId);
  const multiQuery = useLatestCallRunByContact(contactCallIds);
  const run = callId ? singleQuery.data?.[0] : multiQuery.data;
  const isLoading = callId ? singleQuery.isLoading : multiQuery.isLoading;

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!run) return null;

  if (compact) {
    return <CallCardCompact run={run} />;
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Ultima Chamada
        </CardTitle>
        <SentimentBadge sentiment={run.sentiment} />
      </CardHeader>
      <CardContent className="space-y-2">
        {run.summary ? (
          <p className="text-sm text-muted-foreground line-clamp-3">{run.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Sem resumo disponivel</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(run.date_created)}
          </span>
          {run.provider && (
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {run.provider.replace("_", " ")}
            </span>
          )}
          {run.cost_estimate !== null && run.cost_estimate !== undefined && (
            <span>~${run.cost_estimate.toFixed(4)}</span>
          )}
        </div>

        {run.next_action && (
          <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
            Proximo passo: {run.next_action}
          </div>
        )}

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7">
              {open ? "Ocultar" : "Ver"} transcricao
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 max-h-40 overflow-y-auto rounded border bg-muted/50 p-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {run.transcript || "Sem transcricao"}
            </div>
            {run.key_topics && run.key_topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {run.key_topics.map((topic, i) => (
                  <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ─── Versao compacta (mobile-first) ───────────────────────────────────────

function CallCardCompact({ run }: { run: AiCallRun }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1.5 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          <span>Chamada</span>
          <span className="text-[10px]">{formatDate(run.date_created)}</span>
        </div>
        <SentimentBadge sentiment={run.sentiment} />
      </div>

      {run.summary && (
        <p className="text-xs text-foreground line-clamp-2">{run.summary}</p>
      )}

      {run.next_action && (
        <div className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
          {run.next_action}
        </div>
      )}

      {run.transcript && (
        <details className="text-[10px] text-muted-foreground">
          <summary className="cursor-pointer">Transcript</summary>
          <div className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap">
            {run.transcript}
          </div>
        </details>
      )}
    </div>
  );
}
