import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useCompanySettings,
  useUpdateCompanySettings,
  getWebhookSettings,
  saveWebhookSettings,
  WebhookSettings,
  getMeilisearchSettings,
  saveMeilisearchSettings,
  MeilisearchSettings,
} from "@/hooks/useSettings";
import { DIRECTUS_URL, getDirectusTokenForRequest } from "@/integrations/directus/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Building2, Webhook, FileText, RefreshCw, ShoppingCart, Search, Database, Copy, ArrowDownToLine, MessageCircle, Upload, Trash2, Loader2, Sparkles, Cpu } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PushNotificationsCard } from "@/components/PushNotificationsCard";
import { useMessageTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, type MessageTemplate } from "@/hooks/useMessageTemplates";

export default function Definicoes() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const COMPANY_DRAFT_KEY = useMemo(() => "crm_company_settings_draft_v1", []);

  const [companyData, setCompanyData] = useState({
    name: "",
    vat_number: "",
    phone: "",
    email: "",
    logo_url: "",
    address: "",
    postal_code: "",
    city: "",
    iban: "",
    payment_instructions: "",
    multibanco_entity: "",
    multibanco_reference: "",
    mbway_phone: "",
  });

  const [uploading, setUploading] = useState(false);

  const [webhooks, setWebhooks] = useState<WebhookSettings>({
    webhook_proposta_pdf: "",
    webhook_moloni_sync: "",
    webhook_woo_checkout: "",
  });

  const [meilisearch, setMeilisearch] = useState<MeilisearchSettings>({
    meilisearch_host: "",
    meilisearch_api_key: "",
    meilisearch_index: "products_stage",
  });

  const [integrations, setIntegrations] = useState({
    chatwoot_url: "",
    chatwoot_token: "",
    chatwoot_account_id: "",
    whatsapp_api_url: "",
    typebot_url: "",
    typebot_token: "",
  });

  useEffect(() => {
    if (settings) {
      setCompanyData({
        name: settings.name || "",
        vat_number: settings.vat_number || "",
        phone: settings.phone || "",
        email: settings.email || "",
        logo_url: settings.logo_url || "",
        address: (settings as any).address || "",
        postal_code: (settings as any).postal_code || "",
        city: (settings as any).city || "",
        iban: (settings as any).iban || "",
        payment_instructions: (settings as any).payment_instructions || "",
        multibanco_entity: (settings as any).multibanco_entity || "",
        multibanco_reference: (settings as any).multibanco_reference || "",
        mbway_phone: (settings as any).mbway_phone || "",
      });
      setIntegrations({
        chatwoot_url: settings.chatwoot_url || "",
        chatwoot_token: settings.chatwoot_token || "",
        chatwoot_account_id: (settings as any).chatwoot_account_id || "",
        whatsapp_api_url: settings.whatsapp_api_url || "",
        typebot_url: settings.typebot_url || "",
        typebot_token: settings.typebot_token || "",
      });
    }
    setWebhooks(getWebhookSettings());
    setMeilisearch(getMeilisearchSettings());
  }, [settings]);

  // Restore local draft (prevents losing work on session expiry/navigation)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMPANY_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== "object") return;
      setCompanyData((prev) => ({ ...prev, ...(draft.companyData || {}) }));
      toast({ title: "Rascunho recuperado", description: "Recuperámos alterações não guardadas das Definições." });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft with debounce
  const draftTimer = useRef<number | null>(null);
  useEffect(() => {
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(COMPANY_DRAFT_KEY, JSON.stringify({ companyData }));
      } catch {
        // ignore
      }
    }, 400);
    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
    };
  }, [COMPANY_DRAFT_KEY, companyData]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Por favor selecione uma imagem", variant: "destructive" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "A imagem deve ter menos de 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      const token = getDirectusTokenForRequest();
      if (!token) throw new Error("Sem sessão. Faça login para continuar.");

      const fd = new FormData();
      fd.append("file", file, file.name);

      const res = await fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json?.errors?.[0]?.message ||
          json?.message ||
          json?.error ||
          `Upload failed (${res.status})`;
        throw new Error(msg);
      }

      const fileId = json?.data?.id;
      if (!fileId) throw new Error("Upload completed but file id missing.");

      const assetUrl = `${DIRECTUS_URL.replace(/\/+$/, "")}/assets/${encodeURIComponent(String(fileId))}`;

      // Update company settings with new logo URL
      await updateSettings.mutateAsync({ logo_url: assetUrl });
      setCompanyData(prev => ({ ...prev, logo_url: assetUrl }));

      toast({ title: "Logótipo carregado com sucesso" });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Erro ao carregar logótipo", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateSettings.mutateAsync({ logo_url: null });
      setCompanyData(prev => ({ ...prev, logo_url: "" }));
      toast({ title: "Logótipo removido" });
    } catch (error) {
      toast({ title: "Erro ao remover logótipo", variant: "destructive" });
    }
  };

  const handleSaveCompany = async () => {
    try {
      const { logo_url, ...dataToSave } = companyData;
      await updateSettings.mutateAsync(dataToSave);
      try {
        localStorage.removeItem(COMPANY_DRAFT_KEY);
      } catch {
        // ignore
      }
      toast({ title: "Definições da empresa guardadas" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error || "");
      toast({ title: "Erro ao guardar definições", description: msg || undefined, variant: "destructive" });
    }
  };

  const handleSaveWebhooks = () => {
    saveWebhookSettings(webhooks);
    toast({ title: "Webhooks guardados" });
  };

  const handleSaveMeilisearch = () => {
    saveMeilisearchSettings(meilisearch);
    toast({ title: "Configurações Meilisearch guardadas" });
  };

  const handleSaveIntegrations = async () => {
    try {
      await updateSettings.mutateAsync(integrations);
      toast({ title: "Integrações guardadas" });
    } catch (error) {
      toast({ title: "Erro ao guardar integrações", variant: "destructive" });
    }
  };

  const handleTestMeilisearch = async () => {
    if (!meilisearch.meilisearch_host) {
      toast({ title: "Configure o URL do Meilisearch", variant: "destructive" });
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (meilisearch.meilisearch_api_key) {
        headers["Authorization"] = `Bearer ${meilisearch.meilisearch_api_key}`;
      }

      const response = await fetch(`${meilisearch.meilisearch_host}/health`, { headers });
      
      if (response.ok) {
        toast({ title: "Conexão Meilisearch OK", description: "Servidor a responder corretamente" });
      } else {
        throw new Error(`Status: ${response.status}`);
      }
    } catch (error) {
      toast({ 
        title: "Erro na conexão Meilisearch", 
        description: error instanceof Error ? error.message : "Verifique as configurações",
        variant: "destructive" 
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Definições</h1>
          <p className="text-muted-foreground">Configurações do sistema</p>
        </div>

        {/* Push Notifications */}
        <PushNotificationsCard />

        {/* Ficha de Cliente — editor de campos/dropdowns (página própria) */}
        <Link to="/definicoes/ficha-cliente">
          <Card className="transition-colors hover:bg-muted/40 cursor-pointer">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">Ficha de Cliente</p>
                <p className="text-sm text-muted-foreground">
                  Escolhe que campos aparecem por tipo de cliente e edita os dropdowns
                </p>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {/* WhatsApp Dual — Gestão Multi-Número Evolution + Meta */}
        <Link to="/definicoes/whatsapp">
          <Card className="transition-colors hover:bg-muted/40 cursor-pointer border-emerald-500/30 dark:border-emerald-500/20">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">WhatsApp Dual (Multi-Número)</p>
                  <span className="text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    Evolution + Meta WABA
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gestão de números, QR code, tokens oficiais Meta Cloud e rotas de webhooks
                </p>
              </div>
              <MessageCircle className="h-5 w-5 text-emerald-600" />
            </CardContent>
          </Card>
        </Link>

        {/* Provedores de IA Plug-in */}
        <Link to="/definicoes/ia-providers">
          <Card className="transition-colors hover:bg-muted/40 cursor-pointer border-amber-500/30 dark:border-amber-500/20">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Provedores de Inteligência Artificial</p>
                  <span className="text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    7 Provedores Plug-in
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Anthropic Claude, OpenAI, OpenRouter, DeepSeek, MiniMax, OpenCode e Local LLM
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-amber-500" />
            </CardContent>
          </Card>
        </Link>

        {/* Configurações Globais de IA */}
        <Link to="/definicoes/ia-settings">
          <Card className="transition-colors hover:bg-muted/40 cursor-pointer border-primary/30 dark:border-primary/20">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Configurações & Fallback de IA</p>
                  <span className="text-[10px] font-semibold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Roteamento Unificado
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Provedor padrão, tolerância a falhas (fallback), tokens e system prompts globais
                </p>
              </div>
              <Cpu className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        </Link>

        {/* Company Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>
              Informações gerais da empresa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Upload Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Logótipo da Empresa
              </Label>
              <div className="flex items-start gap-4">
                {/* Logo Preview */}
                <div className="shrink-0 w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 flex items-center justify-center overflow-hidden">
                  {companyData.logo_url ? (
                    <img 
                      src={companyData.logo_url} 
                      alt="Logo" 
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-1 opacity-50" />
                      <span className="text-xs">Sem logo</span>
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          A carregar...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Carregar Logo
                        </>
                      )}
                    </Button>
                    {companyData.logo_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveLogo}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formatos suportados: JPG, PNG, SVG, WebP. Tamanho máximo: 2MB
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company_address">Morada</Label>
                <Input
                  id="company_address"
                  value={companyData.address}
                  onChange={(e) => setCompanyData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua, nº, andar..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_postal_code">Código Postal</Label>
                <Input
                  id="company_postal_code"
                  value={companyData.postal_code}
                  onChange={(e) => setCompanyData((prev) => ({ ...prev, postal_code: e.target.value }))}
                  placeholder="0000-000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_city">Localidade</Label>
                <Input
                  id="company_city"
                  value={companyData.city}
                  onChange={(e) => setCompanyData((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome</Label>
                <Input
                  id="company_name"
                  value={companyData.name}
                  onChange={(e) =>
                    setCompanyData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_number">Contribuinte (NIF)</Label>
                <Input
                  id="vat_number"
                  value={companyData.vat_number}
                  onChange={(e) =>
                    setCompanyData((prev) => ({ ...prev, vat_number: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_phone">Telemóvel</Label>
                <Input
                  id="company_phone"
                  value={companyData.phone}
                  onChange={(e) =>
                    setCompanyData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">Email</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={companyData.email}
                  onChange={(e) =>
                    setCompanyData((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company_iban">IBAN / NIB</Label>
                <Input
                  id="company_iban"
                  value={companyData.iban}
                  onChange={(e) => setCompanyData((prev) => ({ ...prev, iban: e.target.value }))}
                  placeholder="PT50 ...."
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company_payment_instructions">Instruções de pagamento (ex: Eu Pago)</Label>
                <Input
                  id="company_payment_instructions"
                  value={companyData.payment_instructions}
                  onChange={(e) => setCompanyData((prev) => ({ ...prev, payment_instructions: e.target.value }))}
                  placeholder="ex: Pagamento via Eu Pago / referência ..."
                />
              </div>
              <Separator className="sm:col-span-2" />
              <div className="sm:col-span-2">
                <p className="text-sm font-medium mb-3">Pagamentos — Multibanco & MBWay</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_mb_entity">Entidade Multibanco</Label>
                <Input
                  id="company_mb_entity"
                  value={companyData.multibanco_entity}
                  onChange={(e) => setCompanyData((prev) => ({ ...prev, multibanco_entity: e.target.value }))}
                  placeholder="ex: 21312"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_mb_reference">Referência Multibanco</Label>
                <Input
                  id="company_mb_reference"
                  value={companyData.multibanco_reference}
                  onChange={(e) => setCompanyData((prev) => ({ ...prev, multibanco_reference: e.target.value }))}
                  placeholder="Referência base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_mbway_phone">Número MBWay</Label>
                <Input
                  id="company_mbway_phone"
                  value={companyData.mbway_phone}
                  onChange={(e) => setCompanyData((prev) => ({ ...prev, mbway_phone: e.target.value }))}
                  placeholder="ex: 916542271"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveCompany} disabled={updateSettings.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Meilisearch Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Meilisearch
            </CardTitle>
            <CardDescription>
              Configuração da pesquisa de produtos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meili_host" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                URL do Servidor
              </Label>
              <Input
                id="meili_host"
                value={meilisearch.meilisearch_host || ""}
                onChange={(e) =>
                  setMeilisearch((prev) => ({ ...prev, meilisearch_host: e.target.value }))
                }
                placeholder="https://meilisearch.seudominio.com"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meili_key">Chave API (opcional)</Label>
                <Input
                  id="meili_key"
                  type="password"
                  value={meilisearch.meilisearch_api_key || ""}
                  onChange={(e) =>
                    setMeilisearch((prev) => ({ ...prev, meilisearch_api_key: e.target.value }))
                  }
                  placeholder="Chave de pesquisa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meili_index">Índice</Label>
                <Input
                  id="meili_index"
                  value={meilisearch.meilisearch_index || "products_stage"}
                  onChange={(e) =>
                    setMeilisearch((prev) => ({ ...prev, meilisearch_index: e.target.value }))
                  }
                  placeholder="products_stage"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleTestMeilisearch}>
                Testar Conexão
              </Button>
              <Button onClick={handleSaveMeilisearch}>
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhooks Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Integrações n8n
            </CardTitle>
            <CardDescription>
              Configure os URLs dos webhooks para integrações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook_pdf" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Webhook Gerar Proposta PDF
              </Label>
              <Input
                id="webhook_pdf"
                value={webhooks.webhook_proposta_pdf || ""}
                onChange={(e) =>
                  setWebhooks((prev) => ({ ...prev, webhook_proposta_pdf: e.target.value }))
                }
                placeholder="https://n8n.seudominio.com/webhook/..."
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="webhook_moloni" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Webhook Sincronizar Moloni
              </Label>
              <Input
                id="webhook_moloni"
                value={webhooks.webhook_moloni_sync || ""}
                onChange={(e) =>
                  setWebhooks((prev) => ({ ...prev, webhook_moloni_sync: e.target.value }))
                }
                placeholder="https://n8n.seudominio.com/webhook/..."
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="webhook_woo" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Webhook Checkout WooCommerce
              </Label>
              <Input
                id="webhook_woo"
                value={webhooks.webhook_woo_checkout || ""}
                onChange={(e) =>
                  setWebhooks((prev) => ({ ...prev, webhook_woo_checkout: e.target.value }))
                }
                placeholder="https://n8n.seudominio.com/webhook/..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveWebhooks}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Webhooks
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Inbound Webhooks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5" />
              Webhooks de Entrada (Leads)
            </CardTitle>
            <CardDescription>
              URL para receber leads de sistemas externos (n8n, WhatsApp, Typebot)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                URL do Webhook
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${DIRECTUS_URL.replace(/\/+$/, "")}/items/leads`}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(`${DIRECTUS_URL.replace(/\/+$/, "")}/items/leads`);
                    toast({ title: "URL copiado" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use este URL no n8n/Typebot/Chatwoot com header <code>Authorization: Bearer TOKEN</code> para criar leads.
              </p>
            </div>

            <Separator />

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Exemplo de Payload (POST):</p>
              <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
{`{
  "phone": "+351912345678",
  "name": "João Silva",
  "source": "whatsapp",
  "notes": "Interessado em equipamento"
}`}
              </pre>
              <p className="text-xs text-muted-foreground">
                Sources válidos: whatsapp, typebot, n8n, chatwoot, web, email, phone
              </p>
            </div>
          </CardContent>
        </Card>

        {/* External Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Integrações Externas
            </CardTitle>
            <CardDescription>
              Configurações de Chatwoot, WhatsApp e Typebot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Chatwoot URL</Label>
                <Input
                  value={integrations.chatwoot_url}
                  onChange={(e) => setIntegrations(prev => ({ ...prev, chatwoot_url: e.target.value }))}
                  placeholder="https://app.chatwoot.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Chatwoot Token</Label>
                <Input
                  type="password"
                  value={integrations.chatwoot_token}
                  onChange={(e) => setIntegrations(prev => ({ ...prev, chatwoot_token: e.target.value }))}
                  placeholder="Token de acesso"
                />
              </div>
              <div className="space-y-2">
                <Label>Chatwoot Account ID</Label>
                <Input
                  value={integrations.chatwoot_account_id}
                  onChange={(e) => setIntegrations(prev => ({ ...prev, chatwoot_account_id: e.target.value }))}
                  placeholder="ex: 1"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp API URL</Label>
                <Input
                  value={integrations.whatsapp_api_url}
                  onChange={(e) => setIntegrations(prev => ({ ...prev, whatsapp_api_url: e.target.value }))}
                  placeholder="https://api.whatsapp.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Typebot URL</Label>
                <Input
                  value={integrations.typebot_url}
                  onChange={(e) => setIntegrations(prev => ({ ...prev, typebot_url: e.target.value }))}
                  placeholder="https://typebot.io"
                />
              </div>
              <div className="space-y-2">
                <Label>Typebot Token</Label>
                <Input
                  type="password"
                  value={integrations.typebot_token}
                  onChange={(e) => setIntegrations(prev => ({ ...prev, typebot_token: e.target.value }))}
                  placeholder="Token de acesso"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveIntegrations} disabled={updateSettings.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Integrações
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* AI Settings */}
        <AISettingsSection />

        {/* Message Templates CRUD */}
        <MessageTemplatesSection />

        {/* AI Model Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">🧠 Modelo de IA</CardTitle>
            <CardDescription>Escolhe o modelo para sugestões de email, classificação e geração de texto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              defaultValue={(settings as any)?.ai_model || "claude-haiku-4-5"}
              onChange={(e) => updateSettings.mutate({ ai_model: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <optgroup label="Claude (Anthropic)">
                <option value="claude-sonnet-5">Claude Sonnet 5 (mais capaz, mais lento)</option>
                <option value="claude-opus-4-8">Claude Opus 4.8 (máximo, premium)</option>
                <option value="claude-haiku-4-5">Claude Haiku 4.5 (rápido, económico)</option>
              </optgroup>
            </select>
            <p className="text-xs text-muted-foreground">Haiku: rápido e barato (classificação, resumos). Sonnet: melhor qualidade (rascunhos, traduções). Opus: máxima qualidade.</p>
          </CardContent>
        </Card>

        {/* Email Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">✉️ Assinatura de Email</CardTitle>
            <CardDescription>Assinatura HTML aplicada a todos os emails enviados pelo CRM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Assinatura global (empresa)</Label>
              <p className="text-xs text-muted-foreground mb-2">Usa o editor visual abaixo. Podes adicionar imagens (logo, prémios) arrastando ou colando.</p>
              {/* Rich signature editor toolbar */}
              <div className="flex gap-1 border rounded-t-md bg-muted/30 px-2 py-1 mt-1">
                <button type="button" onClick={() => document.execCommand("bold")} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs font-bold" title="Negrito">B</button>
                <button type="button" onClick={() => document.execCommand("italic")} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs italic" title="Itálico">I</button>
                <button type="button" onClick={() => { const url = prompt("URL da imagem (logo, prémio):"); if (url) document.execCommand("insertImage", false, url); }} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs" title="Inserir imagem">🖼</button>
                <button type="button" onClick={() => { const url = prompt("URL do link:"); if (url) document.execCommand("createLink", false, url); }} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-xs text-blue-600" title="Link">🔗</button>
              </div>
              <div
                contentEditable
                dangerouslySetInnerHTML={{ __html: (settings as any)?.email_signature_html || "<p>Atentamente,<br><strong>Equipa HotelEquip</strong></p>" }}
                onBlur={(e) => updateSettings.mutate({ email_signature_html: (e.target as HTMLElement).innerHTML })}
                className="min-h-[150px] w-full rounded-b-md border border-t-0 border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring email-content"
              />
              <p className="text-xs text-muted-foreground mt-1">Dica: cola imagens do logo ou prémios directamente no editor. Grava ao sair.</p>
            </div>

            {/* Signature Preview */}
            <div>
              <Label className="text-sm font-medium">Pré-visualização</Label>
              <p className="text-xs text-muted-foreground mb-2">Assim ficará no rodapé dos emails enviados:</p>
              <div className="rounded-md border border-border bg-card p-4">
                <div className="border-t border-border pt-3 mt-2">
                  <div
                    className="text-sm email-content"
                    dangerouslySetInnerHTML={{ __html: (settings as any)?.email_signature_html || "<p>Atentamente,<br><strong>Equipa HotelEquip</strong></p>" }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Email Prompts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">🤖 Prompts da IA (Email)</CardTitle>
            <CardDescription>Personaliza como a IA redige respostas. Deixa vazio para usar o padrão.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Prompt de sugestão de resposta</Label>
              <textarea rows={4} defaultValue={((settings as any)?.ai_email_prompts)?.suggest || ""} onBlur={(e) => { const c = (settings as any)?.ai_email_prompts || {}; updateSettings.mutate({ ai_email_prompts: { ...c, suggest: e.target.value } }); }} className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ex: Redige uma resposta profissional..." />
            </div>
            <div>
              <Label className="text-sm font-medium">Prompt de melhoria</Label>
              <textarea rows={3} defaultValue={((settings as any)?.ai_email_prompts)?.improve || ""} onBlur={(e) => { const c = (settings as any)?.ai_email_prompts || {}; updateSettings.mutate({ ai_email_prompts: { ...c, improve: e.target.value } }); }} className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ex: Melhora clareza e tom..." />
            </div>
            <div>
              <Label className="text-sm font-medium">Prompt de tradução</Label>
              <textarea rows={3} defaultValue={((settings as any)?.ai_email_prompts)?.translate || ""} onBlur={(e) => { const c = (settings as any)?.ai_email_prompts || {}; updateSettings.mutate({ ai_email_prompts: { ...c, translate: e.target.value } }); }} className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ex: Traduz mantendo tom profissional..." />
            </div>
            <p className="text-xs text-muted-foreground">Grava automaticamente ao sair do campo.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// ─── AI Settings Section ──────────────────────────────────────────────────

function AISettingsSection() {
  const [aiModel, setAiModel] = useState("claude-haiku-4-5");
  const [prompts, setPrompts] = useState({
    ai_prompt_product: "",
    ai_prompt_welcome: "",
    ai_prompt_terms: "",
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = getDirectusTokenForRequest();
    if (!token) return;
    fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/items/company_settings/1?fields=ai_model,ai_prompt_product,ai_prompt_welcome,ai_prompt_terms`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        const d = json?.data;
        if (d) {
          setAiModel(d.ai_model || "claude-haiku-4-5");
          setPrompts({
            ai_prompt_product: d.ai_prompt_product || "",
            ai_prompt_welcome: d.ai_prompt_welcome || "",
            ai_prompt_terms: d.ai_prompt_terms || "",
          });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getDirectusTokenForRequest();
      await fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/items/company_settings/1`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ai_model: aiModel, ...prompts }),
      });
      toast({ title: "Definições de IA guardadas" });
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ✨ Inteligência Artificial
        </CardTitle>
        <CardDescription>
          Configuração do modelo e prompts de IA usados nas propostas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model selector */}
        <div className="space-y-2">
          <Label>Modelo de IA</Label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="claude-haiku-4-5">Claude Haiku 4.5 — rápido e económico (recomendado)</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 — mais capaz, custo médio</option>
          </select>
        </div>

        <Separator />

        {/* Prompts */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Prompts de IA</h4>
          <p className="text-xs text-muted-foreground">
            Se vazios, são usados os prompts padrão do sistema.
          </p>
          <div className="space-y-2">
            <Label className="text-xs">Prompt — Descrição de produto</Label>
            <textarea
              value={prompts.ai_prompt_product}
              onChange={(e) => setPrompts((p) => ({ ...p, ai_prompt_product: e.target.value }))}
              placeholder="Ex: Escreve uma descrição comercial em português em 2 frases para {produto}..."
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Prompt — Mensagem de boas-vindas</Label>
            <textarea
              value={prompts.ai_prompt_welcome}
              onChange={(e) => setPrompts((p) => ({ ...p, ai_prompt_welcome: e.target.value }))}
              placeholder="Ex: Escreve uma mensagem de boas-vindas para {cliente}..."
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Prompt — Termos e condições</Label>
            <textarea
              value={prompts.ai_prompt_terms}
              onChange={(e) => setPrompts((p) => ({ ...p, ai_prompt_terms: e.target.value }))}
              placeholder="Ex: Gera termos e condições para {produtos} com sinal de {pct}%..."
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Guardar definições IA
          </Button>
        </div>

        <Separator />

        {/* Proxy info */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Proxy AI</p>
            <p className="text-xs text-muted-foreground">
              As chamadas de IA passam pelo proxy seguro n8n. A chave API nunca é exposta no browser.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            ✓ Seguro
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Message Templates CRUD ──────────────────────────────────────────────

function MessageTemplatesSection() {
  const { data: templates, isLoading } = useMessageTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ name: "", key: "", channel: "all", content: "", enabled: true });

  const startNew = () => {
    setForm({ name: "", key: "", channel: "all", content: "", enabled: true });
    setEditing("new");
  };

  const startEdit = (t: MessageTemplate) => {
    setForm({ name: t.name, key: t.key, channel: t.channel, content: t.content, enabled: t.enabled });
    setEditing(t.id);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast({ title: "Nome e conteúdo são obrigatórios", variant: "destructive" });
      return;
    }
    try {
      if (editing === "new") {
        await createTemplate.mutateAsync({ ...form, key: form.key || form.name.toLowerCase().replace(/\s+/g, "_") });
        toast({ title: "Template criado" });
      } else if (editing) {
        await updateTemplate.mutateAsync({ id: editing, ...form });
        toast({ title: "Template actualizado" });
      }
      setEditing(null);
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apagar este template?")) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast({ title: "Template apagado" });
      if (editing === id) setEditing(null);
    } catch {
      toast({ title: "Erro ao apagar", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">📋 Templates de Mensagem</CardTitle>
            <CardDescription>Templates reutilizáveis para email e WhatsApp. Variáveis: {'{nome}'}, {'{empresa}'}</CardDescription>
          </div>
          <Button size="sm" onClick={startNew} className="gap-1.5">
            + Novo template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !templates?.length && !editing ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum template. Cria o primeiro!</p>
        ) : (
          <div className="space-y-2">
            {templates?.map((t) => (
              editing === t.id ? (
                <TemplateForm key={t.id} form={form} setForm={setForm} onSave={handleSave} onCancel={() => setEditing(null)} saving={updateTemplate.isPending} />
              ) : (
                <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t.channel}</span>
                      {!t.enabled && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">desactivado</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.content}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEdit(t)}>Editar</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {editing === "new" && (
          <TemplateForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setEditing(null)} saving={createTemplate.isPending} />
        )}
      </CardContent>
    </Card>
  );
}

function TemplateForm({ form, setForm, onSave, onCancel, saving }: {
  form: { name: string; key: string; channel: string; content: string; enabled: boolean };
  setForm: (fn: (f: typeof form) => typeof form) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nome</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Resposta a orçamento" className="h-8 mt-1" />
        </div>
        <div>
          <Label className="text-xs">Canal</Label>
          <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="all">Todos</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Conteúdo</Label>
        <textarea
          rows={4}
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          placeholder="Olá {nome}, obrigado pelo contacto..."
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} className="rounded" />
          Activo
        </label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
