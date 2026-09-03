import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiCallRunsList } from "@/hooks/voice/useAiCallRun";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Bot, Clock, DollarSign } from "lucide-react";
import { AiCallRun } from "@/integrations/directus/ai-call-runs";
import { cn } from "@/lib/utils";
import { useState } from "react";

const SENTIMENT_CFG: Record<string, string> = {
  positive: "bg-green-100 text-green-700 border-green-300",
  neutral: "bg-gray-100 text-gray-600 border-gray-300",
  negative: "bg-red-100 text-red-700 border-red-300",
  unknown: "bg-gray-50 text-gray-400 border-gray-200",
};

const STATUS_CFG: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function formatDate(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AiCallRow({ run }: { run: AiCallRun }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">Call #{run.call_id ?? run.id}</span>
          {run.sentiment && (
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", SENTIMENT_CFG[run.sentiment])}>
              {run.sentiment}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {run.status && (
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_CFG[run.status])}>
              {run.status}
            </span>
          )}
          <Bot className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {run.date_created && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(run.date_created)}
          </span>
        )}
        {run.provider && <span>{run.provider.replace("_", " ")}</span>}
        {run.cost_estimate !== null && run.cost_estimate !== undefined && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {run.cost_estimate.toFixed(4)}
          </span>
        )}
        {run.tokens_used !== null && run.tokens_used !== undefined && (
          <span>{run.tokens_used} tokens</span>
        )}
        {run.latency_ms !== null && run.latency_ms !== undefined && (
          <span>{run.latency_ms}ms</span>
        )}
      </div>

      {expanded && run.summary && (
        <p className="text-sm text-muted-foreground mt-1">{run.summary}</p>
      )}
      {expanded && run.next_action && (
        <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
          {run.next_action}
        </div>
      )}
      {expanded && run.transcript && (
        <details className="mt-1">
          <summary className="text-xs text-muted-foreground cursor-pointer">Transcript</summary>
          <div className="mt-1 max-h-32 overflow-y-auto rounded border bg-muted/50 p-2 text-xs text-muted-foreground whitespace-pre-wrap">
            {run.transcript}
          </div>
        </details>
      )}
    </div>
  );
}

function CallsDashboard() {
  const { data: runs, isLoading } = useAiCallRunsList({ limit: 50 });

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Chamadas com IA</h1>
          <p className="text-sm text-muted-foreground">Analise automatica de chamadas Telecof com transcricao e sentiment</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="h-4 w-4" />
          <span>{runs?.length ?? 0} registos</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : !runs || runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhuma chamada analisada ainda.</p>
            <p className="text-xs">As chamadas Telecof aparecerao aqui apos o webhook de fim de chamada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <AiCallRow key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CallsPage() {
  return (
    <AppLayout fullHeight>
      <CallsDashboard />
    </AppLayout>
  );
}
