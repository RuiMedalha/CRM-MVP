/**
 * Onboarding Wizard - /onboarding
 *
 * 6 steps guided setup:
 *  1. Empresa (nome, logo, NIF)
 *  2. Utilizador admin (employee)
 *  3. Primeiro pipeline (deal)
 *  4. Primeiro lead demo
 *  5. Configurar WhatsApp (link)
 *  6. Configurar IA (link)
 *
 * Auto-trigger: ao entrar, se company_settings.onboarding_done !== true
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Loader2,
  MessageSquare,
  SkipForward,
  Sparkles,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  fetchOnboardingState,
  setOnboardingStep,
  completeOnboarding,
  upsertCompanyBasics,
  bootstrapAdminEmployee,
  ensureDefaultPipeline,
  bootstrapDemoLead,
  type CompanySettingsOnboarding,
} from "@/integrations/directus/onboarding";

type Step = {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: Step[] = [
  { id: 1, title: "Empresa", description: "Nome, NIF e logo", icon: Building2 },
  { id: 2, title: "Utilizador admin", description: "Criar employee", icon: UserPlus },
  { id: 3, title: "Primeiro pipeline", description: "Deal default", icon: Workflow },
  { id: 4, title: "Primeiro lead", description: "Lead de demonstracao", icon: Users },
  { id: 5, title: "WhatsApp", description: "Configurar instancia", icon: MessageSquare },
  { id: 6, title: "IA", description: "Configurar providers", icon: Bot },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<CompanySettingsOnboarding | null>(null);
  const [busy, setBusy] = useState(false);

  const [company, setCompany] = useState({ name: "", vat_number: "", logo_url: "" });
  const [employee, setEmployee] = useState({ full_name: "", email: "", phone: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchOnboardingState();
        if (cancelled) return;
        setState(s);
        if (s?.name) setCompany((c) => ({ ...c, name: s.name ?? "" }));
        if (s?.vat_number) setCompany((c) => ({ ...c, vat_number: s.vat_number ?? "" }));
        if (s?.logo_url) setCompany((c) => ({ ...c, logo_url: s.logo_url ?? "" }));
        if (s?.onboarding_done) {
          navigate("/dashboard", { replace: true });
          return;
        }
        const next = Math.max(1, Math.min(6, Number(s?.onboarding_step ?? 1))) as 1 | 2 | 3 | 4 | 5 | 6;
        setStep(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  async function persistStep(nextStep: 1 | 2 | 3 | 4 | 5 | 6) {
    setStep(nextStep);
    await setOnboardingStep(nextStep);
  }

  async function onStep1Save() {
    if (!company.name.trim()) {
      toast({ title: "Nome da empresa obrigatorio", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await upsertCompanyBasics({
        name: company.name.trim(),
        vat_number: company.vat_number.trim() || null,
        logo_url: company.logo_url.trim() || null,
      });
      await persistStep(2);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function onStep2Save() {
    if (!employee.full_name.trim()) {
      toast({ title: "Nome do utilizador obrigatorio", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await bootstrapAdminEmployee({
        full_name: employee.full_name.trim(),
        email: employee.email.trim() || null,
        phone: employee.phone.trim() || null,
        role: "admin",
      });
      await persistStep(3);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function onStep3Save() {
    setBusy(true);
    try {
      await ensureDefaultPipeline();
      await persistStep(4);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function onStep4Save() {
    setBusy(true);
    try {
      await bootstrapDemoLead();
      await persistStep(5);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function skipExternalSteps(to: 6 | "finish") {
    setBusy(true);
    try {
      if (to === 6) {
        await persistStep(6);
      } else {
        await completeOnboarding();
        toast({ title: "Onboarding concluido!" });
        navigate("/dashboard", { replace: true });
      }
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await completeOnboarding();
      toast({ title: "Onboarding concluido!", description: "Bem-vindo ao CRMMVP." });
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 max-w-3xl flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const pct = Math.round(((step - 1) / (STEPS.length - 1)) * 100);
  const StepIcon = STEPS[step - 1].icon;

  return (
    <AppLayout>
      <div className="container mx-auto p-3 sm:p-6 max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Configuracao inicial</h1>
            <Badge variant="outline" className="ml-2">Step {step} / 6</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Vamos configurar o essencial em 6 passos. Pode saltar os passos externos e configura-los mais tarde em Definicoes.
          </p>
          <Progress value={pct} className="mt-3" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {STEPS.map((s) => {
            const done = s.id < step;
            const active = s.id === step;
            const Icon = s.icon;
            return (
              <Card key={s.id} className={active ? "border-primary" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : active ? (
                    <CircleDot className="h-5 w-5 text-primary" />
                  ) : (
                    <CircleDashed className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.description}</div>
                  </div>
                  <Icon className="h-4 w-4 ml-auto text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <StepIcon className="h-5 w-5" /> {STEPS[step - 1].title}
            </CardTitle>
            <CardDescription>{STEPS[step - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div>
                  <Label htmlFor="ob-name">Nome da empresa</Label>
                  <Input id="ob-name" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Hotelequip, Lda." />
                </div>
                <div>
                  <Label htmlFor="ob-vat">NIF</Label>
                  <Input id="ob-vat" value={company.vat_number} onChange={(e) => setCompany({ ...company, vat_number: e.target.value })} placeholder="PT500000000" />
                </div>
                <div>
                  <Label htmlFor="ob-logo">Logo URL (opcional)</Label>
                  <Input id="ob-logo" value={company.logo_url} onChange={(e) => setCompany({ ...company, logo_url: e.target.value })} placeholder="https://..." />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <Label htmlFor="ob-emp-name">Nome completo</Label>
                  <Input id="ob-emp-name" value={employee.full_name} onChange={(e) => setEmployee({ ...employee, full_name: e.target.value })} placeholder="Rui Silva" />
                </div>
                <div>
                  <Label htmlFor="ob-emp-email">Email</Label>
                  <Input id="ob-emp-email" type="email" value={employee.email} onChange={(e) => setEmployee({ ...employee, email: e.target.value })} placeholder="rui@empresa.pt" />
                </div>
                <div>
                  <Label htmlFor="ob-emp-phone">Telefone</Label>
                  <Input id="ob-emp-phone" value={employee.phone} onChange={(e) => setEmployee({ ...employee, phone: e.target.value })} placeholder="+351 ..." />
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Vamos criar um <strong>Pipeline Default</strong> caso ainda nao exista nenhum deal.</p>
                <p>Pode ajustar etapas, valores e SLA em <code>/definicoes/pipelines</code>.</p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Vamos criar um <strong>Lead de demonstracao</strong> para ja ter dados em <code>/leads</code>.</p>
                <p>Fonte: <code>Onboarding Demo</code> (pode filtrar/limpar depois).</p>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Para captar leads do WhatsApp, configure uma instancia em
                </p>
                <Button asChild variant="outline" className="gap-2">
                  <a href="/definicoes/whatsapp"><MessageSquare className="h-4 w-4" /> Abrir Definicoes WhatsApp</a>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Pode saltar este passo agora e configura-lo mais tarde.
                </p>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Para usar IA na escrita de mensagens, configuracao de agentes, etc., defina providers em
                </p>
                <Button asChild variant="outline" className="gap-2">
                  <a href="/definicoes/ia-providers"><Bot className="h-4 w-4" /> Abrir Definicoes IA</a>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Pode saltar este passo agora e configura-lo mais tarde.
                </p>
              </div>
            )}
          </CardContent>
          <div className="flex items-center justify-between p-4 border-t">
            <Button
              variant="ghost"
              disabled={step === 1 || busy}
              onClick={() => persistStep((step - 1) as 1 | 2 | 3 | 4 | 5 | 6)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Anterior
            </Button>
            <div className="flex items-center gap-2">
              {step === 5 || step === 6 ? (
                <Button variant="outline" onClick={() => skipExternalSteps(step === 5 ? 6 : "finish")} disabled={busy} className="gap-1">
                  <SkipForward className="h-4 w-4" /> Saltar
                </Button>
              ) : null}
              {step === 1 && <Button onClick={onStep1Save} disabled={busy} className="gap-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Proximo</Button>}
              {step === 2 && <Button onClick={onStep2Save} disabled={busy} className="gap-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Proximo</Button>}
              {step === 3 && <Button onClick={onStep3Save} disabled={busy} className="gap-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Proximo</Button>}
              {step === 4 && <Button onClick={onStep4Save} disabled={busy} className="gap-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Proximo</Button>}
              {step === 6 && <Button onClick={finish} disabled={busy} className="gap-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Concluir</Button>}
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Pode fechar esta pagina e voltar mais tarde — o progresso fica guardado em <code>company_settings.onboarding_step</code>.
        </p>
      </div>
    </AppLayout>
  );
}
