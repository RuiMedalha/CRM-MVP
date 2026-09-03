import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  aiRouter,
  AIProviderMeta,
  AISettings,
  AICompletionResult,
} from "@/services/ai/router";

export default function AiSettings() {
  const [providers, setProviders] = useState<AIProviderMeta[]>([]);
  const [settings, setSettings] = useState<AISettings>({
    default_provider_id: null,
    fallback_provider_id: null,
    max_tokens_default: 1024,
    system_prompt_default: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Test Fallback State
  const [testingFallback, setTestingFallback] = useState(false);
  const [testResult, setTestResult] = useState<AICompletionResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const [provs, setts] = await Promise.all([
        aiRouter.listProviders(forceRefresh),
        aiRouter.getSettings(forceRefresh),
      ]);
      setProviders(provs);
      setSettings(setts);
    } catch (err: any) {
      toast({
        title: "Erro ao carregar configurações de IA",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await aiRouter.saveSettings(settings);
      toast({
        title: "Definições guardadas",
        description: "As configurações globais de IA foram atualizadas no Directus.",
      });
      await loadData(true);
    } catch (err: any) {
      toast({
        title: "Erro ao guardar definições",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestFallback = async () => {
    setTestingFallback(true);
    setTestResult(null);
    setTestError(null);

    try {
      const result = await aiRouter.completeWithFallback(
        "Diz ola em PT em 1 frase",
        { maxTokens: 80 }
      );
      setTestResult(result);
      toast({
        title: "Fallback Concluído!",
        description: `Resposta obtida via ${result.providerLabel || result.providerId} em ${result.latency}ms.`,
      });
    } catch (err: any) {
      const msg = err.message || "Erro desconhecido durante o teste de fallback.";
      setTestError(msg);
      toast({
        title: "Falha na conclusão com Fallback",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setTestingFallback(false);
    }
  };

  const enabledProviders = providers.filter((p) => p.enabled);

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-4xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link to="/definicoes" className="hover:underline">
                Definições
              </Link>
              <span>/</span>
              <Link to="/definicoes/ia-providers" className="hover:underline">
                Provedores IA
              </Link>
              <span>/</span>
              <span>Roteamento Global</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Cpu className="h-7 w-7 text-primary" />
              Configurações de Inteligência Artificial
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Defina o provedor primário, contingência de fallback, limites de tokens e prompts do sistema.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/definicoes/ia-providers">
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Gerir Provedores
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Recarregar</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">A carregar configurações do Directus...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Fallback & Routing Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Roteamento de Provedores e Fallback
                </CardTitle>
                <CardDescription className="text-xs">
                  Se o provedor predefinido falhar (erro 5xx, timeout ou esgotamento de quota), o sistema tentará automaticamente o provedor de contingência.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Default Provider */}
                  <div className="space-y-2">
                    <Label htmlFor="default-provider" className="text-xs font-semibold flex items-center gap-1.5">
                      <Bot className="h-4 w-4 text-emerald-500" />
                      Provedor Padrão (Preferencial) *
                    </Label>
                    <Select
                      value={settings.default_provider_id || ""}
                      onValueChange={(val) =>
                        setSettings({ ...settings, default_provider_id: val })
                      }
                    >
                      <SelectTrigger id="default-provider">
                        <SelectValue placeholder="Selecione o provedor padrão..." />
                      </SelectTrigger>
                      <SelectContent>
                        {enabledProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label} ({p.type} · {p.default_model})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Primeira escolha para gerar textos, e-mails, resumos e análises.
                    </p>
                  </div>

                  {/* Fallback Provider */}
                  <div className="space-y-2">
                    <Label htmlFor="fallback-provider" className="text-xs font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      Provedor de Fallback (Contingência)
                    </Label>
                    <Select
                      value={settings.fallback_provider_id || ""}
                      onValueChange={(val) =>
                        setSettings({ ...settings, fallback_provider_id: val })
                      }
                    >
                      <SelectTrigger id="fallback-provider">
                        <SelectValue placeholder="Selecione o fallback..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (usar ordem da lista)</SelectItem>
                        {enabledProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label} ({p.type} · {p.default_model})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Provedor alternativo acionado em caso de indisponibilidade do principal.
                    </p>
                  </div>
                </div>

                {/* Test Fallback Button and Result */}
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold">Testar Roteador e Fallback</p>
                      <p className="text-[11px] text-muted-foreground">
                        Simula uma chamada completa com fallback automático entre os provedores ativos.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleTestFallback}
                      disabled={testingFallback || enabledProviders.length === 0}
                      className="gap-2 shrink-0"
                    >
                      {testingFallback ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      Testar Rota com Fallback
                    </Button>
                  </div>

                  {testingFallback && (
                    <div className="flex items-center gap-2 p-2.5 rounded bg-muted text-xs text-muted-foreground border animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>A tentar conclusão no roteador com contingência automática...</span>
                    </div>
                  )}

                  {testResult && (
                    <Alert className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-xs py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <AlertTitle className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                        <span>Roteador respondeu com sucesso!</span>
                        <span className="font-mono text-[10px] font-normal">
                          Provedor: {testResult.providerLabel} · {testResult.latency}ms · {testResult.tokens} tokens
                        </span>
                      </AlertTitle>
                      <AlertDescription className="text-[11px] text-emerald-900 dark:text-emerald-200 mt-1 italic">
                        "{testResult.text}"
                      </AlertDescription>
                    </Alert>
                  )}

                  {testError && (
                    <Alert variant="destructive" className="text-xs py-2.5">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-xs font-semibold">Erro no Roteamento</AlertTitle>
                      <AlertDescription className="text-[11px] mt-1 whitespace-pre-wrap">
                        {testError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Model Generation Defaults Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Parâmetros de Geração Padrão
                </CardTitle>
                <CardDescription className="text-xs">
                  Valores padrão aplicados quando a chamada à IA não especifica parâmetros detalhados.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-1.5 max-w-xs">
                  <Label htmlFor="max-tokens" className="text-xs font-semibold">
                    Máximo de Tokens Padrão (Max Tokens) *
                  </Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min={64}
                    max={32000}
                    value={settings.max_tokens_default || 1024}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        max_tokens_default: parseInt(e.target.value, 10) || 1024,
                      })
                    }
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Recomendado: 1024 para tarefas rápidas, 4096 para resumos longos.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="system-prompt" className="text-xs font-semibold">
                    Prompt de Sistema Global Predefinido
                  </Label>
                  <Textarea
                    id="system-prompt"
                    rows={4}
                    placeholder="Instruções de persona e estilo globais..."
                    value={settings.system_prompt_default || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        system_prompt_default: e.target.value,
                      })
                    }
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Define a identidade e tom de voz (ex: Assistente de CRM HotelEquip em PT-PT) injetado nas chamadas sem system prompt explícito.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  As definições são sincronizadas com a coleção <code>ai_settings</code> do Directus.
                </p>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar Definições
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
