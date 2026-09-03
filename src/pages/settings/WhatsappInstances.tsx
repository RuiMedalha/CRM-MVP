import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  MoreVertical,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  Edit,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  fetchWhatsAppInstances,
  createWhatsAppInstance,
  updateWhatsAppInstance,
  deleteWhatsAppInstance,
  testWhatsAppInstanceConnection,
} from "@/integrations/directus/whatsapp-instances";
import { getWhatsAppQRCode, getAdapter } from "@/services/whatsapp";
import type { WhatsAppInstance, WhatsAppProvider } from "@/services/whatsapp/types";
import { MessageBadge } from "@/components/MessageBadge";

export default function WhatsappInstances() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<WhatsAppInstance | null>(null);
  const [formProvider, setFormProvider] = useState<WhatsAppProvider>("evolution");
  const [formData, setFormData] = useState({
    displayName: "",
    phoneNumber: "",
    instanceId: "",
    phoneNumberId: "",
    accessToken: "",
    businessAccountId: "",
    webhookUrl: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [activeQrInstance, setActiveQrInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrStatusText, setQrStatusText] = useState<string>("");

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [activeTestInstance, setActiveTestInstance] = useState<WhatsAppInstance | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testSending, setTestSending] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchWhatsAppInstances();
      setInstances(data);
    } catch {
      toast({
        title: "Erro ao carregar instâncias",
        description: "Não foi possível carregar as instâncias WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingInstance(null);
    setFormProvider("evolution");
    setFormData({
      displayName: "",
      phoneNumber: "",
      instanceId: "",
      phoneNumberId: "",
      accessToken: "",
      businessAccountId: "",
      webhookUrl: "",
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (inst: WhatsAppInstance) => {
    setEditingInstance(inst);
    setFormProvider(inst.provider);
    setFormData({
      displayName: inst.display_name || "",
      phoneNumber: inst.phone_number || "",
      instanceId: inst.instance_id || "",
      phoneNumberId: inst.phone_number_id || "",
      accessToken: inst.access_token || "",
      businessAccountId: inst.business_account_id || "",
      webhookUrl: inst.webhook_url || "",
    });
    setIsAddOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName.trim() || !formData.phoneNumber.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Indique o nome de apresentação e o número de telefone.",
        variant: "destructive",
      });
      return;
    }

    if (formProvider === "evolution" && !formData.instanceId.trim()) {
      toast({
        title: "Instance ID obrigatório",
        description: "Para Evolution API, especifique o identificador da instância.",
        variant: "destructive",
      });
      return;
    }

    if (formProvider === "meta" && (!formData.phoneNumberId.trim() || !formData.accessToken.trim())) {
      toast({
        title: "Campos Meta obrigatórios",
        description: "Para Meta Cloud API, especifique o Phone Number ID e o Access Token permanente.",
        variant: "destructive",
      });
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingInstance) {
        await updateWhatsAppInstance(editingInstance.id, {
          provider: formProvider,
          display_name: formData.displayName,
          phone_number: formData.phoneNumber,
          instance_id: formProvider === "evolution" ? formData.instanceId : null,
          phone_number_id: formProvider === "meta" ? formData.phoneNumberId : null,
          access_token: formData.accessToken || null,
          business_account_id: formProvider === "meta" ? formData.businessAccountId : null,
          webhook_url: formData.webhookUrl || null,
        });
        toast({
          title: "Instância atualizada",
          description: `Configurações de ${formData.displayName} guardadas.`,
        });
      } else {
        const created = await createWhatsAppInstance({
          provider: formProvider,
          display_name: formData.displayName,
          phone_number: formData.phoneNumber,
          instance_id: formProvider === "evolution" ? formData.instanceId : null,
          phone_number_id: formProvider === "meta" ? formData.phoneNumberId : null,
          access_token: formData.accessToken || null,
          business_account_id: formProvider === "meta" ? formData.businessAccountId : null,
          webhook_url: formData.webhookUrl || null,
          status: formProvider === "meta" ? "connected" : "qr_pending",
        });
        toast({
          title: "Instância adicionada",
          description: `Linha ${formData.displayName} registada com sucesso.`,
        });

        if (formProvider === "evolution") {
          setIsAddOpen(false);
          handleOpenQRCode(created);
          loadData();
          return;
        }
      }
      setIsAddOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: "Erro ao guardar",
        description: err.message || "Ocorreu um erro ao salvar a instância.",
        variant: "destructive",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleEnable = async (inst: WhatsAppInstance, checked: boolean) => {
    try {
      await updateWhatsAppInstance(inst.id, {
        enabled: checked,
        status: checked ? (inst.status === "disconnected" ? "connected" : inst.status) : "disconnected",
      });
      setInstances((prev) =>
        prev.map((i) =>
          i.id === inst.id
            ? {
                ...i,
                enabled: checked,
                status: checked ? (i.status === "disconnected" ? "connected" : i.status) : "disconnected",
              }
            : i,
        ),
      );
      toast({
        title: checked ? "Linha ativada" : "Linha desativada",
        description: `${inst.display_name} está agora ${checked ? "ativa" : "inativa"}.`,
      });
    } catch {
      toast({
        title: "Erro ao alterar estado",
        description: "Não foi possível atualizar a instância.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (inst: WhatsAppInstance) => {
    if (!confirm(`Tem a certeza que deseja remover a instância "${inst.display_name}"?`)) return;
    try {
      await deleteWhatsAppInstance(inst.id);
      setInstances((prev) => prev.filter((i) => i.id !== inst.id));
      toast({
        title: "Instância removida",
        description: `${inst.display_name} foi eliminada com sucesso.`,
      });
    } catch {
      toast({
        title: "Erro ao eliminar",
        description: "Não foi possível remover a instância.",
        variant: "destructive",
      });
    }
  };

  const handleOpenQRCode = async (inst: WhatsAppInstance) => {
    setActiveQrInstance(inst);
    setQrDialogOpen(true);
    setQrLoading(true);
    setQrCodeData(null);
    setQrBase64(null);
    setPairingCode(null);
    setQrStatusText("A obter código QR do servidor...");

    try {
      const res = await getWhatsAppQRCode(inst);
      if (res.status === "connected") {
        setQrStatusText(res.message || "Instância conectada e pronta a usar!");
        await updateWhatsAppInstance(inst.id, { status: "connected" });
        loadData();
      } else {
        setQrCodeData(res.qrCode || null);
        setQrBase64(res.qrCodeBase64 || null);
        setPairingCode(res.pairingCode || null);
        setQrStatusText(res.message || "Aponte a câmara do WhatsApp para o código QR.");
      }
    } catch {
      setQrStatusText("Erro ao obter código QR.");
    } finally {
      setQrLoading(false);
    }
  };

  const handleOpenTest = (inst: WhatsAppInstance) => {
    setActiveTestInstance(inst);
    setTestPhone(inst.phone_number || "");
    setTestMessage(
      `Teste de conexão CRM — Linha ${inst.display_name} (${inst.provider === "meta" ? "Meta Cloud Oficial" : "Evolution API"}) às ${new Date().toLocaleTimeString("pt-PT")}.`,
    );
    setTestDialogOpen(true);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTestInstance || !testPhone.trim() || !testMessage.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Introduza o número de destino e o texto de teste.",
        variant: "destructive",
      });
      return;
    }

    setTestSending(true);
    try {
      const res = await testWhatsAppInstanceConnection(activeTestInstance, testPhone, testMessage);
      if (res.success) {
        toast({
          title: "Mensagem de teste enviada!",
          description: res.message,
        });
        setTestDialogOpen(false);
        loadData();
      } else {
        toast({
          title: "Falha no envio do teste",
          description: res.message,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro no envio",
        description: err.message || "Ocorreu um erro ao enviar a mensagem de teste.",
        variant: "destructive",
      });
    } finally {
      setTestSending(false);
    }
  };

  const handleCheckStatus = async (inst: WhatsAppInstance) => {
    try {
      const adapter = getAdapter(inst.provider);
      if (adapter.checkStatus) {
        const check = await adapter.checkStatus(inst);
        await updateWhatsAppInstance(inst.id, {
          status: check.status,
          last_seen_at: check.lastSeenAt || new Date().toISOString(),
        });
        toast({
          title: `Estado: ${check.status.toUpperCase()}`,
          description: check.status === "connected" ? "Conectado e operacional." : "Offline ou a aguardar QR.",
        });
      } else {
        toast({
          title: "Estado verificado",
          description: `Status atual: ${inst.status}.`,
        });
      }
      loadData();
    } catch (err: any) {
      toast({
        title: "Erro na verificação",
        description: err.message || "Não foi possível verificar status.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copiado!`,
      description: "Copiado para a área de transferência.",
    });
  };

  const filteredInstances = instances.filter((inst) => {
    if (activeTab === "all") return true;
    if (activeTab === "evolution") return inst.provider === "evolution";
    if (activeTab === "meta") return inst.provider === "meta";
    if (activeTab === "connected") return inst.status === "connected" && inst.enabled !== false;
    return true;
  });

  const countTotal = instances.length;
  const countConnected = instances.filter((i) => i.status === "connected" && i.enabled !== false).length;
  const countEvolution = instances.filter((i) => i.provider === "evolution").length;
  const countMeta = instances.filter((i) => i.provider === "meta").length;

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Números WhatsApp (Dual API)</h1>
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400">
                Multi-Número Ativo
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Gestão unificada de canais WhatsApp via <strong>Evolution API</strong> e <strong>Meta Cloud API Oficial</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Número
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Total de Linhas</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold">{countTotal}</span>
              <Smartphone className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Conectadas</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{countConnected}</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Evolution API</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold">{countEvolution}</span>
              <Radio className="h-5 w-5 text-emerald-600" />
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">Meta Cloud WABA</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold">{countMeta}</span>
              <ShieldCheck className="h-5 w-5 text-sky-600" />
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="all">Todas ({countTotal})</TabsTrigger>
            <TabsTrigger value="evolution">Evolution ({countEvolution})</TabsTrigger>
            <TabsTrigger value="meta">Meta Cloud ({countMeta})</TabsTrigger>
            <TabsTrigger value="connected">Ativas ({countConnected})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">A carregar números WhatsApp configurados...</p>
              </div>
            ) : filteredInstances.length === 0 ? (
              <Card className="p-12 text-center">
                <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                <h3 className="text-lg font-semibold">Nenhum número encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Clique em 'Adicionar Número' para configurar uma nova linha.
                </p>
                <Button onClick={handleOpenAdd} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeira Instância
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInstances.map((inst) => {
                  const isEvo = inst.provider === "evolution";
                  const isConnected = inst.status === "connected" && inst.enabled !== false;
                  const isQrPending = inst.status === "qr_pending";

                  return (
                    <Card
                      key={inst.id}
                      className={`relative flex flex-col justify-between transition-all border shadow-sm hover:shadow-md ${
                        !inst.enabled ? "opacity-60 bg-muted/30" : ""
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                              <span>{inst.display_name}</span>
                            </CardTitle>
                            <CardDescription className="font-mono text-sm font-semibold text-foreground">
                              {inst.phone_number}
                            </CardDescription>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={inst.enabled !== false}
                              onCheckedChange={(checked) => handleToggleEnable(inst, checked)}
                              title={inst.enabled ? "Desativar linha" : "Ativar linha"}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleOpenTest(inst)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Testar Envio
                                </DropdownMenuItem>
                                {isEvo && (
                                  <DropdownMenuItem onClick={() => handleOpenQRCode(inst)}>
                                    <QrCode className="h-4 w-4 mr-2" />
                                    Obter QR Code
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleCheckStatus(inst)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Verificar Conexão
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEdit(inst)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar Configurações
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(inst)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar Linha
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <MessageBadge
                            provider={inst.provider}
                            instanceName={inst.instance_id || inst.display_name}
                            phoneNumber={inst.phone_number}
                            size="sm"
                          />

                          {isConnected ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                              Conectado
                            </Badge>
                          ) : isQrPending ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 text-xs">
                              <QrCode className="h-3 w-3 mr-1 text-amber-500 animate-pulse" />
                              Aguardando QR
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 text-xs">
                              <AlertCircle className="h-3 w-3 mr-1 text-rose-500" />
                              Desconectado
                            </Badge>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 text-xs text-muted-foreground pb-4">
                        {isEvo ? (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-medium text-foreground/80">Instance ID:</span>
                              <span className="font-mono">{inst.instance_id || "default"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium text-foreground/80">Motor:</span>
                              <span>Evolution API (Baileys)</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-medium text-foreground/80">Phone Number ID:</span>
                              <span className="font-mono">{inst.phone_number_id || "-"}</span>
                            </div>
                            {inst.business_account_id && (
                              <div className="flex justify-between">
                                <span className="font-medium text-foreground/80">WABA ID:</span>
                                <span className="font-mono">{inst.business_account_id}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="font-medium text-foreground/80">Motor:</span>
                              <span>Meta Graph API v18.0</span>
                            </div>
                          </div>
                        )}

                        {inst.webhook_url && (
                          <div className="pt-2 border-t">
                            <span className="font-medium text-foreground/80 block mb-1">Webhook URL:</span>
                            <div className="flex items-center justify-between gap-1 bg-muted/60 p-1.5 rounded font-mono text-[11px] break-all">
                              <span className="truncate">{inst.webhook_url}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => copyToClipboard(inst.webhook_url!, "Webhook URL")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {inst.last_seen_at && (
                          <div className="flex justify-between pt-1 text-[11px] text-muted-foreground/70">
                            <span>Última atividade:</span>
                            <span>{new Date(inst.last_seen_at).toLocaleString("pt-PT")}</span>
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="pt-2 border-t flex items-center justify-between gap-2 bg-muted/10">
                        {isEvo && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => handleOpenQRCode(inst)}
                          >
                            <QrCode className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                            {isConnected ? "Ver QR" : "Obter QR"}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          className={`text-xs ${isEvo ? "flex-1" : "w-full"}`}
                          onClick={() => handleOpenTest(inst)}
                        >
                          <Send className="h-3.5 w-3.5 mr-1 text-sky-600" />
                          Testar Envio
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Card className="border-dashed bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Como funciona o Multi-Número Dual no CRM
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              • <strong>Evolution API (918/916):</strong> Conecta via emulação de sessão WhatsApp (QR Code). Ideal para múltiplos números de equipa comercial.
            </p>
            <p>
              • <strong>Meta Cloud API Oficial (913 WABA):</strong> Conexão corporativa direta com a infraestrutura oficial da Meta com selo de verificação e templates aprovados.
            </p>
            <p>
              • <strong>Normalização Automática:</strong> Todas as mensagens recebidas são unificadas e associadas aos contactos na coleção <code>whatsapp_messages</code>.
            </p>
          </CardContent>
        </Card>

        {/* DIALOG: Adicionar / Editar */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveForm}>
              <DialogHeader>
                <DialogTitle>
                  {editingInstance ? "Editar Linha WhatsApp" : "Adicionar Número WhatsApp"}
                </DialogTitle>
                <DialogDescription>
                  Configure uma nova linha telefónica para envio e receção unificada no CRM.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Provedor WhatsApp</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => setFormProvider("evolution")}
                      className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 text-center transition-all ${
                        formProvider === "evolution"
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                          : "hover:border-foreground/30"
                      }`}
                    >
                      <Radio className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-xs">Evolution API</p>
                        <p className="text-[10px] text-muted-foreground">Conexão via QR Code</p>
                      </div>
                    </div>

                    <div
                      onClick={() => setFormProvider("meta")}
                      className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 text-center transition-all ${
                        formProvider === "meta"
                          ? "border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 text-sky-950 dark:text-sky-200 ring-2 ring-sky-500/20"
                          : "hover:border-foreground/30"
                      }`}
                    >
                      <ShieldCheck className="h-5 w-5 text-sky-600" />
                      <div>
                        <p className="font-semibold text-xs">Meta Cloud Oficial</p>
                        <p className="text-[10px] text-muted-foreground">WABA Graph API v18.0</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome de Apresentação *</Label>
                  <Input
                    id="displayName"
                    placeholder="Ex: Comercial 913, Suporte 916"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de Telefone *</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="+351913866565"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    required
                  />
                </div>

                {formProvider === "evolution" && (
                  <div className="space-y-3 p-3 bg-muted/40 rounded-lg border">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Definições Evolution API
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="instanceId">Instance ID *</Label>
                      <Input
                        id="instanceId"
                        placeholder="hotelequip-918"
                        value={formData.instanceId}
                        onChange={(e) => setFormData({ ...formData, instanceId: e.target.value })}
                        required={formProvider === "evolution"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="evoToken">API Key / Token (Opcional)</Label>
                      <Input
                        id="evoToken"
                        type="password"
                        placeholder="Chave de autenticação opcional"
                        value={formData.accessToken}
                        onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {formProvider === "meta" && (
                  <div className="space-y-3 p-3 bg-muted/40 rounded-lg border">
                    <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                      Definições Meta Cloud API (Graph v18.0)
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                      <Input
                        id="phoneNumberId"
                        placeholder="943101945557713"
                        value={formData.phoneNumberId}
                        onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                        required={formProvider === "meta"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessAccountId">WhatsApp Business Account ID (WABA)</Label>
                      <Input
                        id="businessAccountId"
                        placeholder="109384920492819"
                        value={formData.businessAccountId}
                        onChange={(e) => setFormData({ ...formData, businessAccountId: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accessToken">Permanent System User Access Token *</Label>
                      <Input
                        id="accessToken"
                        type="password"
                        placeholder="EAABw..."
                        value={formData.accessToken}
                        onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                        required={formProvider === "meta"}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL (Opcional)</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://api.hotelequip.pt/webhook/..."
                    value={formData.webhookUrl}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={formSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {formSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingInstance ? "Guardar Alterações" : "Adicionar Instância"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOG: QR Code */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md text-center">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2 text-lg">
                <QrCode className="h-5 w-5 text-emerald-600" />
                Emparelhar WhatsApp
              </DialogTitle>
              <DialogDescription>
                {activeQrInstance?.display_name} ({activeQrInstance?.phone_number})
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 flex flex-col items-center justify-center min-h-[260px]">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                  <p className="text-sm text-muted-foreground">A gerar código QR de autenticação...</p>
                </div>
              ) : qrBase64 ? (
                <div className="p-3 bg-white rounded-xl shadow-inner border">
                  <img
                    src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                    alt="QR Code WhatsApp"
                    className="h-56 w-56 object-contain"
                  />
                </div>
              ) : qrCodeData ? (
                <div className="p-4 bg-white rounded-xl shadow-inner border">
                  <QRCodeSVG value={qrCodeData} size={220} level="M" />
                </div>
              ) : (
                <div className="p-6 bg-muted/40 rounded-lg text-center space-y-2 max-w-xs">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">Instância Conectada!</p>
                  <p className="text-xs text-muted-foreground">{qrStatusText}</p>
                </div>
              )}

              {pairingCode && (
                <div className="mt-4 p-2 bg-muted rounded-md text-xs font-mono">
                  Código de Emparelhamento: <span className="font-bold text-foreground">{pairingCode}</span>
                </div>
              )}

              <p className="mt-4 text-xs text-muted-foreground max-w-xs">{qrStatusText}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => activeQrInstance && handleOpenQRCode(activeQrInstance)}
                disabled={qrLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${qrLoading ? "animate-spin" : ""}`} />
                Atualizar QR Code
              </Button>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setQrDialogOpen(false)}>
                Concluído
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* DIALOG: Teste */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSendTest}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-sky-600" />
                  Testar Envio de Mensagem
                </DialogTitle>
                <DialogDescription>
                  Envia uma mensagem de teste através da linha{" "}
                  <strong>{activeTestInstance?.display_name}</strong> ({activeTestInstance?.provider === "meta" ? "Meta Cloud" : "Evolution API"}).
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="testPhone">Número de Destino *</Label>
                  <Input
                    id="testPhone"
                    placeholder="+351913866565"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="testMsg">Texto da Mensagem *</Label>
                  <Input
                    id="testMsg"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="outline" onClick={() => setTestDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={testSending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {testSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      A enviar...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Teste
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
