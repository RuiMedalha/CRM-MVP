/**
 * Card 16 — UI de revisão humana para runs AI que aguardam aprovação.
 *
 * Rota: /ai-review
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AiAgentRunRow,
  EmailDrafterOutput,
  FollowupSchedulerOutput,
  LeadQualifierOutput,
} from "@/services/ai/agents/types";
import {
  approveEmailDraft,
  approveFollowupDraft,
  approveLeadQualification,
  rejectAgentRun,
} from "@/services/ai/agents/reviewActions";
import { listAwaitingHumanAiAgentRuns } from "@/integrations/directus/ai-agent-runs";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";

const AGENT_LABEL: Record<string, string> = {
  lead_qualifier: "Qualificação de Lead",
  email_drafter: "Rascunho de Email",
  followup_scheduler: "Follow-up sugerido",
  call_summarizer: "Resumo de chamada",
};

function summarizeOutput(run: AiAgentRunRow): string {
  const out = run.output_payload as Record<string, unknown> | undefined;
  if (!out) return "(sem output)";
  if ("qualification_score" in out) {
    const o = out as unknown as LeadQualifierOutput;
    return `Score ${o.qualification_score}/100 · stage sugerido: ${o.suggested_stage}`;
  }
  if ("subject" in out) {
    const o = out as unknown as EmailDrafterOutput;
    return `${o.subject}`;
  }
  if ("next_action" in out) {
    const o = out as unknown as FollowupSchedulerOutput;
    return `${o.next_action} (${o.channel}, ${o.priority})`;
  }
  return JSON.stringify(out).slice(0, 140);
}

export default function AiAgentReviewPage() {
  const [runs, setRuns] = useState<AiAgentRunRow[]>([]);
  const [selected, setSelected] = useState<AiAgentRunRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const employee = useCurrentEmployee();

  const reload = async () => {
    const data = await listAwaitingHumanAiAgentRuns(100);
    setRuns(data);
  };

  useEffect(() => {
    reload();
  }, []);

  const reviewer = useMemo(
    () => ({
      id:
        (employee as any)?.id ||
        (employee as any)?.user?.id ||
        "anonymous",
      email: (employee as any)?.email || null,
      name:
        (employee as any)?.full_name ||
        (employee as any)?.name ||
        "Humano",
    }),
    [employee]
  );

  const onApprove = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (selected.agent_type === "lead_qualifier") {
        await approveLeadQualification(selected, reviewer);
      } else if (selected.agent_type === "email_drafter") {
        await approveEmailDraft(selected, reviewer);
      } else if (selected.agent_type === "followup_scheduler") {
        await approveFollowupDraft(selected, reviewer);
      }
      setSelected(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!selected) return;
    const reason = rejectReason.trim() || "Sem motivo";
    setBusy(true);
    try {
      await rejectAgentRun(selected, reviewer, reason);
      setRejectReason("");
      setSelected(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Revisão AI</h1>
        <p className="text-sm text-muted-foreground">
          Sugestões do agente que precisam de aprovação humana antes de agir
          no CRM.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          {runs.length === 0 && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Sem runs pendentes. Bom trabalho.
              </CardContent>
            </Card>
          )}
          {runs.map((run) => (
            <Card
              key={String(run.id)}
              className={`cursor-pointer transition-colors ${
                selected?.id === run.id ? "border-primary" : ""
              }`}
              onClick={() => setSelected(run)}
            >
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    {AGENT_LABEL[run.agent_type || ""] || run.agent_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    conf={run.confidence_score?.toFixed(2) ?? "?"}
                  </span>
                </div>
                <p className="text-sm">{summarizeOutput(run)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(run.date_created || "").toLocaleString("pt-PT")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selected && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Seleccione um run à esquerda para ver os detalhes.
              </CardContent>
            </Card>
          )}
          {selected && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium">
                      {AGENT_LABEL[selected.agent_type || ""] ||
                        selected.agent_type}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Run #{String(selected.id)} · confiança{" "}
                      {selected.confidence_score?.toFixed(2) ?? "?"}
                    </p>
                  </div>
                  <div className="space-x-2">
                    <Button
                      variant="default"
                      disabled={busy}
                      onClick={onApprove}
                    >
                      Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={onReject}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-1">Input</h3>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">
                    {JSON.stringify(selected.input_payload, null, 2)}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-1">Output</h3>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-72">
                    {JSON.stringify(selected.output_payload, null, 2)}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-1">
                    Motivo de rejeição (opcional)
                  </h3>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Porque rejeita esta sugestão?"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}