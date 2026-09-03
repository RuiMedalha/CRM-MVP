/**
 * Scoring Rules (Card 7)
 *
 * Página de definições para o modelo de Lead Scoring:
 *  - Lista de regras com pesos editáveis (sliders) — espelha DEFAULT_WEIGHTS_V1
 *  - Recalibração em massa: reescreve scores de todos os leads
 *  - A/B test: dois modelos (v1 baseline + variante "experiment" com pesos
 *    alternativos que o utilizador ajusta). Mostra uma side-by-side preview
 *    de contagens por bucket para cada modelo.
 *
 * IMPORTANTE: este MVP altera apenas os pesos DEFAULT_WEIGHTS_V1 em memória;
 * o Directus hook continua a usar v1 hard-coded até que se generalize
 * weights por collection. O A/B test aqui é preview — os resultados ficam
 * visíveis para o utilizador decidir fazer rollback ou promover.
 */

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, RefreshCw, FlaskConical, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  breakdownScore, DEFAULT_WEIGHTS_V1, scoreBucket, SCORE_MODEL_VERSION,
  type ScoreWeights,
} from "@/services/leadScoring/score";
import { directusRequest } from "@/integrations/directus/client";

interface RuleRow {
  key: keyof typeof DEFAULT_WEIGHTS_V1;
  label: string;
  description: string;
  min: number;
  max: number;
}

const RULES: RuleRow[] = [
  { key: "has_phone",                    label: "Telefone presente",      description: "Lead tem telefone válido.",                            min: 0,  max: 50 },
  { key: "has_email",                    label: "Email presente",         description: "Lead tem email válido.",                               min: 0,  max: 40 },
  { key: "has_nif",                      label: "NIF presente",           description: "Lead tem NIF (empresa).",                              min: 0,  max: 30 },
  { key: "whatsapp_replies",             label: "WhatsApp respostas",     description: "Por cada resposta do lead no WhatsApp.",               min: 0,  max: 50 },
  { key: "email_opens",                  label: "Email aberturas",        description: "Por cada abertura de email de marketing.",             min: 0,  max: 40 },
  { key: "status_qualified",             label: "Status qualified",       description: "Lead marcado como qualified.",                          min: 0,  max: 30 },
  { key: "decay_per_day_after_7d",       label: "Idle decay (−5/dia)",     description: "Penalização por dia sem follow-up após 7 dias.",       min: -20, max: 0 },
  { key: "penalty_discarded_or_spam",    label: "Penalty discarded/spam", description: "Penalização forte para leads descartados/spam.",        min: -100, max: 0 },
];

interface ABVariant {
  weights: ScoreWeights;
  preview: { hot: number; warm: number; cold: number; sample: number } | null;
}

function useWeights(initial: ScoreWeights) {
  const [weights, setWeights] = useState<ScoreWeights>(initial);
  return {
    weights,
    setKey: (k: keyof ScoreWeights, v: number) => setWeights((w) => ({ ...w, [k]: v })),
    reset: () => setWeights(initial),
  };
}

function previewDistribution(variant: ScoreWeights, sample: any[]) {
  let hot = 0, warm = 0, cold = 0;
  for (const lead of sample) {
    const score = breakdownScore(
      {
        phone: lead.contact_phone || lead.phone,
        email: lead.email,
        nif: lead.nif,
        status: lead.status,
        last_activity_at: lead.last_attempt_at || lead.date_created,
        whatsapp_replies: lead.whatsapp_replies ?? 0,
        email_opens: lead.email_opens ?? 0,
      },
      variant,
    ).score;
    const bucket = scoreBucket(score);
    if (bucket === "hot") hot++;
    else if (bucket === "warm") warm++;
    else cold++;
  }
  return { hot, warm, cold, sample: sample.length };
}

export default function ScoringRules() {
  // Modelo A (baseline v1) e Modelo B (variante experimental)
  const a = useWeights({ ...DEFAULT_WEIGHTS_V1 });
  const b = useWeights({ ...DEFAULT_WEIGHTS_V1, has_phone: 30, has_email: 20, decay_per_day_after_7d: -8 });

  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);

  // Load sample of leads (latest 200 non-converted) for preview
  const loadLeads = async () => {
    try {
      setLoadingLeads(true);
      const res = await directusRequest<{ data: any[] }>(
        `/items/leads?limit=200&filter[status][_nin]=discarded,spam,converted&fields=id,phone,contact_phone,email,nif,status,date_created,last_attempt_at,whatsapp_replies,email_opens`
      );
      setLeads(res.data ?? []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar leads", description: err.message, variant: "destructive" });
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => { loadLeads(); }, []);

  const previewA = useMemo(() => previewDistribution(a.weights, leads), [a.weights, leads]);
  const previewB = useMemo(() => previewDistribution(b.weights, leads), [b.weights, leads]);

  /** Recalibra em massa: chama o hook do Directus para cada lead */
  const recalibrateAll = async () => {
    setRecalibrating(true);
    try {
      // Patch cada lead com o status atual (force re-trigger do hook).
      // O hook usa o payload para recalcular e gravar.
      let updated = 0;
      for (const lead of leads) {
        try {
          await directusRequest(`/items/leads/${lead.id}`, {
            method: "PATCH",
            body: JSON.stringify({ __skipScoreRecalc: false }),
          });
          updated++;
        } catch (_) {
          // Ignorar falhas individuais
        }
      }
      toast({ title: "Recalibração concluída", description: `${updated} leads recalculados.` });
    } catch (err: any) {
      toast({ title: "Erro na recalibração", description: err.message, variant: "destructive" });
    } finally {
      setRecalibrating(false);
    }
  };

  const saveWeights = async () => {
    setSaving(true);
    try {
      // MVP: guardamos os pesos B como snapshot numa collection de settings
      // (não implementada nesta entrega — placeholder). O modelo A é o
      // DEFAULT_WEIGHTS_V1 hard-coded no hook Directus.
      localStorage.setItem("crm:leadScoring:weights:A", JSON.stringify(a.weights));
      localStorage.setItem("crm:leadScoring:weights:B", JSON.stringify(b.weights));
      toast({ title: "Pesos guardados", description: "Snapshot A e B em localStorage." });
    } catch (err: any) {
      toast({ title: "Erro ao guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Lead Scoring — Regras</h1>
          <p className="text-sm text-muted-foreground">
            Modelo v{SCORE_MODEL_VERSION}. Ajusta pesos, recalibra em massa, ou corre um A/B test.
          </p>
        </header>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Como funciona</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>• <strong>Modelo A (Baseline v1)</strong>: pesos default do hook Directus.</p>
            <p>• <strong>Modelo B (Variante)</strong>: ajusta livremente — só é preview, NÃO altera o hook.</p>
            <p>• <strong>Recalibração em massa</strong>: força o hook a recomputar todos os leads visíveis.</p>
          </AlertDescription>
        </Alert>

        {/* Sample loader */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Sample para preview
            </CardTitle>
            <CardDescription className="text-xs">
              {loadingLeads
                ? "A carregar leads..."
                : `${leads.length} leads não-convertidos carregados (últimos 200).`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={loadLeads} disabled={loadingLeads}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingLeads ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
            <Button size="sm" onClick={saveWeights} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Guardar pesos (localStorage)
            </Button>
            <Button size="sm" variant="outline" onClick={recalibrateAll} disabled={recalibrating || loadingLeads}>
              {recalibrating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Recalibrar todos
            </Button>
          </CardContent>
        </Card>

        {/* Two model columns */}
        <div className="grid lg:grid-cols-2 gap-4">
          <ModelEditor
            title="Modelo A — Baseline v1"
            subtitle="Pesos default usados pelo hook Directus (production)"
            badge="PRODUCTION"
            weights={a.weights}
            onChange={a.setKey}
            onReset={a.reset}
            preview={previewA}
            accent="border-green-300"
          />
          <ModelEditor
            title="Modelo B — Variante"
            subtitle="Edita livremente — preview only, não afecta produção"
            badge="EXPERIMENT"
            initial={DEFAULT_WEIGHTS_V1}
            weights={b.weights}
            onChange={b.setKey}
            onReset={b.reset}
            preview={previewB}
            accent="border-amber-300"
          />
        </div>
      </div>
    </AppLayout>
  );
}

function ModelEditor({
  title, subtitle, badge, weights, onChange, onReset, preview, accent, initial,
}: {
  title: string;
  subtitle: string;
  badge: string;
  weights: ScoreWeights;
  onChange: (k: keyof ScoreWeights, v: number) => void;
  onReset: () => void;
  preview: { hot: number; warm: number; cold: number; sample: number } | null;
  accent: string;
  initial?: ScoreWeights;
}) {
  return (
    <Card className={`${accent} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
            badge === "PRODUCTION"
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-amber-100 text-amber-800 border border-amber-200"
          }`}>
            {badge}
          </span>
        </div>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {RULES.map((rule) => {
          const value = (weights[rule.key] ?? DEFAULT_WEIGHTS_V1[rule.key]) as number;
          return (
            <div key={rule.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <Label className="text-xs">{rule.label}</Label>
                <span className={`tabular-nums font-semibold ${value >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {value > 0 ? `+${value}` : value}
                </span>
              </div>
              <Slider
                min={rule.min}
                max={rule.max}
                step={1}
                value={[value]}
                onValueChange={([v]) => onChange(rule.key, v)}
                className="w-full"
                aria-label={rule.label}
              />
              <p className="text-xs text-muted-foreground">{rule.description}</p>
            </div>
          );
        })}

        <div className="flex justify-end pt-1">
          <Button size="sm" variant="ghost" onClick={onReset}>
            Reset
          </Button>
        </div>

        {preview && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Distribuição preview (n={preview.sample})</p>
            <div className="grid grid-cols-3 gap-2">
              <BucketTile label="Quentes" value={preview.hot} pct={preview.sample ? Math.round((preview.hot / preview.sample) * 100) : 0} className="bg-green-100 text-green-800" />
              <BucketTile label="Mornos"  value={preview.warm} pct={preview.sample ? Math.round((preview.warm / preview.sample) * 100) : 0} className="bg-amber-100 text-amber-800" />
              <BucketTile label="Frios"   value={preview.cold} pct={preview.sample ? Math.round((preview.cold / preview.sample) * 100) : 0} className="bg-red-100 text-red-800" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BucketTile({ label, value, pct, className }: { label: string; value: number; pct: number; className: string }) {
  return (
    <div className={`rounded-lg border border-border/50 p-2 ${className}`}>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs">{pct}%</div>
    </div>
  );
}
