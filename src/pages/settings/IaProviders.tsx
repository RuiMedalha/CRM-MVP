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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Edit,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Key,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { aiRouter, AIProviderMeta, AIProviderType, AICompletionResult } from "@/services/ai/router";

const PROVIDER_PRESETS: Record<
  AIProviderType,
  { label: string; defaultModel: string; defaultBaseUrl: string; placeholderKey: string }
> = {
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-3-5-sonnet-20241022",
    defaultBaseUrl: "https://api.anthropic.com/v1/messages",
    placeholderKey: "sk-ant-api03-...",
  },
  openai: {
    label: "OpenAI GPT",
    defaultModel: "gpt-4o",
    defaultBaseUrl: "https://api.openai.com/v1/chat/completions",
    placeholderKey: "sk-proj-...",
  },
  openrouter: {
    label: "OpenRouter Hub",
    defaultModel: "anthropic/claude-3.5-sonnet",
    defaultBaseUrl: "https://openrouter.ai/api/v1/chat/completions",
    placeholderKey: "sk-or-v1-...",
  },
  deepseek: {
    label: "DeepSeek AI",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1/chat/completions",
    placeholderKey: "sk-...",
  },
  opencode: {
    label: "OpenCode Engine",
    defaultModel: "opencode-coder",
    defaultBaseUrl: "https://opencode.ai/api/v1/chat/completions",
    placeholderKey: "sk-...",
  },
  minimax: {
    label: "MiniMax AI",
    defaultModel: "MiniMax-Text-01",
    defaultBaseUrl: "https://api.minimax.chat/v1/text/chatcompletion_v2",
    placeholderKey: "ey...",
  },
  openai_compatible: {
    label: "OpenAI Compatível (Ollama / vLLM / LM Studio)",
    defaultModel: "llama3.2",
    defaultBaseUrl: "http://localhost:11434/v1",
    placeholderKey: "Opcional para Ollama local",
  },
};

interface TestResultState {
  loading: boolean;
  success?: boolean;
  result?: AICompletionResult;
  error?: string;
}

export default function IaProviders() {
  const [providers, setProviders] = useState<AIProviderMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<AIProviderMeta> | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete Dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<AIProviderMeta | null>(null);

  // Test states by providerId
  const [testStates, setTestStates] = useState<Record<string, TestResultState>>({});

  const loadProviders = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const list = await aiRouter.listProviders(forceRefresh);
      setProviders(list);
    } catch (err: any) {
      toast({
        title: "Erro ao carregar provedores de IA",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleOpenAdd = () => {
    setEditingProvider({
      label: "",
      type: "anthropic",
      default_model: PROVIDER_PRESETS.anthropic.defaultModel,
      base_url: PROVIDER_PRESETS.anthropic.defaultBaseUrl,
      api_key: "",
      enabled: true,
      tenant_id: null,
    });
    setShowApiKey(false);
    setDialogOpen(true);
  };

  const handleOpenEdit = (provider: AIProviderMeta) => {
    setEditingProvider({ ...provider });
    setShowApiKey(false);
    setDialogOpen(true);
  };

  const handleTypeChange = (newType: AIProviderType) => {
    if (!editingProvider) return;
    const preset = PROVIDER_PRESETS[newType];
    setEditingProvider({
      ...editingProvider,
      type: newType,
      default_model: preset?.defaultModel || editingProvider.default_model,
      base_url: preset?.defaultBaseUrl || editingProvider.base_url,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    if (!editingProvider.label?.trim()) {
      toast({ title: "O nome do provedor é obrigatório.", variant: "destructive" });
      return;
    }
    if (!editingProvider.default_model?.trim()) {
      toast({ title: "O modelo predefinido é obrigatório.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const saved = await aiRouter.saveProvider(editingProvider);
      toast({
        title: "Provedor guardado com sucesso",
        description: `Provedor "${saved.label}" pronto para uso.`,
      });
      setDialogOpen(false);
      setEditingProvider(null);
      await loadProviders(true);
    } catch (err: any) {
      toast({
        title: "Erro ao guardar provedor",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (provider: AIProviderMeta, enabled: boolean) => {
    try {
      // Optimistic update
      setProviders((prev) =>
        prev.map((p) => (p.id === provider.id ? { ...p, enabled } : p))
      );
      await aiRouter.toggleProvider(provider.id, enabled);
      toast({
        title: enabled ? "Provedor ativado" : "Provedor desativado",
        description: `${provider.label} foi ${enabled ? "ativado" : "desativado"}.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao alterar estado",
        description: err.message,
        variant: "destructive",
      });
      await loadProviders(true);
    }
  };

  const handleDelete = async () => {
    if (!providerToDelete) return;
    try {
      await aiRouter.deleteProvider(providerToDelete.id);
      toast({
        title: "Provedor eliminado",
        description: `O provedor ${providerToDelete.label} foi removido.`,
      });
      setDeleteConfirmOpen(false);
      setProviderToDelete(null);
      await loadProviders(true);
    } catch (err: any) {
      toast({
        title: "Erro ao eliminar",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleTest = async (provider: AIProviderMeta) => {
    setTestStates((prev) => ({
      ...prev,
      [provider.id]: { loading: true },
    }));

    try {
      const result = await aiRouter.complete(
        provider.id,
        "Diz ola em PT em 1 frase",
        { maxTokens: 60 }
      );
      setTestStates((prev) => ({
        ...prev,
        [provider.id]: {
          loading: false,
          success: true,
          result,
        },
      }));
      toast({
        title: "Teste bem-sucedido!",
        description: `${provider.label}: resposta recebida em ${result.latency}ms (${result.tokens} tokens).`,
      });
    } catch (err: any) {
      const errorMsg = err.message || "Erro desconhecido ao contactar a API";
      setTestStates((prev) => ({
        ...prev,
        [provider.id]: {
          loading: false,
          success: false,
          error: errorMsg,
        },
      }));
      toast({
        title: "Falha no teste",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const filteredProviders = providers.filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      p.label.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.default_model.toLowerCase().includes(q)
    );
  });

  const getProviderIcon = (type: AIProviderType) => {
    switch (type) {
      case "anthropic":
        return <Sparkles className="h-5 w-5 text-amber-500" />;
      case "openai":
        return <Bot className="h-5 w-5 text-emerald-500" />;
      case "openrouter":
        return <Layers className="h-5 w-5 text-indigo-500" />;
      case "deepseek":
        return <Flame className="h-5 w-5 text-blue-500" />;
      case "opencode":
        return <BrainCircuit className="h-5 w-5 text-purple-500" />;
      case "minimax":
        return <Zap className="h-5 w-5 text-orange-500" />;
      case "openai_compatible":
      default:
        return <Cpu className="h-5 w-5 text-teal-500" />;
    }
  };

  const getProviderTypeBadge = (type: AIProviderType) => {
    const colors: Record<AIProviderType, string> = {
      anthropic: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border-amber-300",
      openai: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300",
      openrouter: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300",
      deepseek: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 border-blue-300",
      opencode: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 border-purple-300",
      minimax: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300 border-orange-300",
      openai_compatible: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300 border-teal-300",
    };
    return (
      <Badge variant="outline" className={`capitalize text-[11px] ${colors[type] || ""}`}>
        {type.replace("_", " ")}
      </Badge>
    );
  };

  const activeCount = providers.filter((p) => p.enabled).length;

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-7xl mx-auto px-2 sm:px-4">
        {/* Header Breadcrumbs & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link to="/definicoes" className="hover:underline">
                Definições
              </Link>
              <span>/</span>
              <span>Inteligência Artificial</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Sparkles className="h-7 w-7 text-primary" />
              Provedores de IA Plug-in
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure múltiplos provedores LLM unificados com fallback inteligente e chave segura no Directus.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to="/definicoes/ia-settings">
              <Button variant="outline" size="sm" className="gap-2">
                <Sliders className="h-4 w-4" />
                <span className="hidden sm:inline">Definições Globais</span>
                <span className="sm:hidden">Definições</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadProviders(true)}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>

            <Button onClick={handleOpenAdd} size="sm" className="gap-2 bg-primary">
              <Plus className="h-4 w-4" />
              Adicionar Provedor
            </Button>
          </div>
        </div>

        {/* Stats & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Provedores</p>
                <p className="text-2xl font-bold mt-0.5">{providers.length}</p>
              </div>
              <Bot className="h-7 w-7 text-muted-foreground/60" />
            </CardContent>
          </Card>

          <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 uppercase font-semibold">
                  Ativos no Router
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {activeCount}
                </p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-emerald-500/70" />
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardContent className="p-4 flex flex-col justify-center">
              <Label className="text-xs text-muted-foreground mb-1.5">Filtrar por nome ou modelo</Label>
              <Input
                placeholder="Pesquisar provedores..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 text-xs"
              />
            </CardContent>
          </Card>
        </div>

        {/* Provider Cards Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">A carregar catálogo de provedores...</p>
          </div>
        ) : filteredProviders.length === 0 ? (
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <Bot className="h-12 w-12 text-muted-foreground/50" />
              <div className="space-y-1">
                <p className="font-semibold text-base">Nenhum provedor encontrado</p>
                <p className="text-xs text-muted-foreground">
                  {filter ? "Tente limpar o filtro de pesquisa." : "Adicione o primeiro provedor para começar."}
                </p>
              </div>
              <Button onClick={handleOpenAdd} size="sm" className="mt-2 gap-1.5">
                <Plus className="h-4 w-4" /> Adicionar Provedor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProviders.map((provider) => {
              const testState = testStates[provider.id] || { loading: false };
              return (
                <Card
                  key={provider.id}
                  className={`flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                    provider.enabled
                      ? "border-primary/30 dark:border-primary/20 bg-card"
                      : "opacity-75 bg-muted/20 border-dashed"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-muted border">
                          {getProviderIcon(provider.type)}
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold leading-tight">
                            {provider.label}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 mt-1">
                            {getProviderTypeBadge(provider.type)}
                            {provider.enabled ? (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                Inativo
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Enable/Disable switch */}
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={provider.enabled}
                          onCheckedChange={(checked) => handleToggle(provider, checked)}
                          aria-label="Ativar/Desativar Provedor"
                        />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-xs flex-1">
                    <div className="rounded-md bg-muted/40 p-2.5 space-y-1.5 border">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-medium">Modelo Padrão:</span>
                        <span className="font-mono text-foreground font-semibold">
                          {provider.default_model}
                        </span>
                      </div>
                      {provider.base_url && (
                        <div className="flex items-center justify-between text-muted-foreground gap-2 overflow-hidden">
                          <span className="font-medium shrink-0">Endpoint:</span>
                          <span className="font-mono text-[11px] truncate text-foreground" title={provider.base_url}>
                            {provider.base_url}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-medium">Chave API:</span>
                        <span className="font-mono text-[11px] text-foreground">
                          {provider.api_key ? "••••••••••••••••" : <span className="text-amber-600">Não configurada</span>}
                        </span>
                      </div>
                    </div>

                    {/* Test Results Output Alert */}
                    {testState.loading && (
                      <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted text-xs text-muted-foreground animate-pulse border">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>A testar conexão e latência do modelo...</span>
                      </div>
                    )}

                    {testState.success && testState.result && (
                      <Alert className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-xs py-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <AlertTitle className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                          <span>Conectado com sucesso</span>
                          <span className="font-mono text-[10px] font-normal">
                            {testState.result.latency}ms · {testState.result.tokens} tokens
                          </span>
                        </AlertTitle>
                        <AlertDescription className="text-[11px] text-emerald-900 dark:text-emerald-200 mt-1 line-clamp-3 italic">
                          "{testState.result.text}"
                        </AlertDescription>
                      </Alert>
                    )}

                    {testState.success === false && testState.error && (
                      <Alert variant="destructive" className="text-xs py-2.5">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-xs font-semibold">Falha na Conexão</AlertTitle>
                        <AlertDescription className="text-[11px] mt-1 break-words">
                          {testState.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>

                  <CardFooter className="pt-2 pb-3 px-6 flex items-center justify-between gap-2 border-t bg-muted/10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(provider)}
                      disabled={testState.loading || !provider.enabled}
                      className="gap-1.5 text-xs h-8 flex-1"
                    >
                      {testState.loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      Testar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(provider)}
                      className="gap-1 text-xs h-8 px-2.5"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Editar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProviderToDelete(provider);
                        setDeleteConfirmOpen(true);
                      }}
                      className="gap-1 text-xs h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal Dialog Form: Add / Edit Provider */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-primary" />
                {editingProvider?.id ? "Editar Provedor de IA" : "Adicionar Novo Provedor de IA"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure os parâmetros de conexão e autenticação para o roteador de IA unificado.
              </DialogDescription>
            </DialogHeader>

            {editingProvider && (
              <form onSubmit={handleSave} className="space-y-4 py-2">
                {/* Provider Label */}
                <div className="space-y-1.5">
                  <Label htmlFor="provider-label" className="text-xs font-semibold">
                    Nome / Rótulo do Provedor *
                  </Label>
                  <Input
                    id="provider-label"
                    placeholder="ex: Anthropic Claude 3.5 Sonnet ou MiniMax Principal"
                    value={editingProvider.label || ""}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, label: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Provider Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="provider-type" className="text-xs font-semibold">
                    Tipo de Provedor / Arquitetura *
                  </Label>
                  <Select
                    value={editingProvider.type || "anthropic"}
                    onValueChange={(val: AIProviderType) => handleTypeChange(val)}
                  >
                    <SelectTrigger id="provider-type">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic Claude (Messages API)</SelectItem>
                      <SelectItem value="openai">OpenAI GPT (Chat Completions)</SelectItem>
                      <SelectItem value="openrouter">OpenRouter Hub (Multi-Model)</SelectItem>
                      <SelectItem value="deepseek">DeepSeek AI (DeepSeek API)</SelectItem>
                      <SelectItem value="opencode">OpenCode Engine</SelectItem>
                      <SelectItem value="minimax">MiniMax AI (Text Chat)</SelectItem>
                      <SelectItem value="openai_compatible">
                        OpenAI Compatível (Ollama / Local / vLLM)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Default Model */}
                <div className="space-y-1.5">
                  <Label htmlFor="provider-model" className="text-xs font-semibold">
                    Modelo Padrão *
                  </Label>
                  <Input
                    id="provider-model"
                    placeholder="ex: claude-3-5-sonnet-20241022, gpt-4o, deepseek-chat"
                    value={editingProvider.default_model || ""}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, default_model: e.target.value })
                    }
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Identificador oficial do modelo na API de destino.
                  </p>
                </div>

                {/* Base URL */}
                <div className="space-y-1.5">
                  <Label htmlFor="provider-url" className="text-xs font-semibold flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    URL Base / Endpoint
                  </Label>
                  <Input
                    id="provider-url"
                    placeholder={
                      editingProvider.type
                        ? PROVIDER_PRESETS[editingProvider.type]?.defaultBaseUrl
                        : "https://api..."
                    }
                    value={editingProvider.base_url || ""}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, base_url: e.target.value })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Opcional. Se vazio, será utilizado o endpoint padrão oficial do provedor.
                  </p>
                </div>

                {/* API Key with Show / Hide Toggle */}
                <div className="space-y-1.5">
                  <Label htmlFor="provider-key" className="text-xs font-semibold flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5" />
                    Chave de API (Secret Key)
                  </Label>
                  <div className="relative">
                    <Input
                      id="provider-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder={
                        editingProvider.type
                          ? PROVIDER_PRESETS[editingProvider.type]?.placeholderKey
                          : "sk-..."
                      }
                      value={editingProvider.api_key || ""}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, api_key: e.target.value })
                      }
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A chave é enviada de forma segura e armazenada com restrição de visualização.
                  </p>
                </div>

                {/* Enabled Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Ativar Provedor no Roteador</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Provedores desativados são ignorados no fallback automático.
                    </p>
                  </div>
                  <Switch
                    checked={editingProvider.enabled ?? true}
                    onCheckedChange={(checked) =>
                      setEditingProvider({ ...editingProvider, enabled: checked })
                    }
                  />
                </div>

                <DialogFooter className="pt-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="gap-1.5">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar Provedor
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem a certeza que deseja eliminar?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação vai remover permanentemente o provedor{" "}
                <strong>{providerToDelete?.label}</strong> do Directus e do roteador de IA.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar Provedor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
