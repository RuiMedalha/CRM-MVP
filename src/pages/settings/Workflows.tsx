/**
 * Visual Workflow Automation (if-this-then-that)
 * Directus Workflows & Workflow Executions
 */

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useWorkflows,
  useWorkflowExecutions,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useToggleWorkflowActive,
  useExecuteWorkflowTest,
} from "@/hooks/useWorkflows";
import {
  WorkflowRow,
  WorkflowCondition,
  WorkflowAction,
  WorkflowExecutionRow,
  ActionType,
  TriggerEventType,
} from "@/integrations/directus/workflows";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  ArrowRight,
  GripVertical,
  Mail,
  MessageSquare,
  UserCheck,
  CalendarCheck,
  Bell,
  Activity,
  Globe,
  Layers,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Sliders,
  FileCode,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { formatDistanceToNow, format } from "date-fns";
import { pt } from "date-fns/locale";

// ─── Constants & Metadata ───

const TRIGGER_COLLECTIONS = [
  { value: "leads", label: "Leads", description: "Potenciais clientes em prospeção" },
  { value: "deals", label: "Oportunidades (Deals)", description: "Negócios no pipeline de vendas" },
  { value: "contacts", label: "Contactos / Clientes", description: "Base de contactos e empresas" },
  { value: "quotations", label: "Orçamentos / Propostas", description: "Propostas comerciais e cotações" },
  { value: "follow_ups", label: "Follow-ups", description: "Tarefas e agendamentos de acompanhamento" },
  { value: "activity", label: "Atividades (Activity Ledger)", description: "Registo histórico de comunicações e ações" },
];

const TRIGGER_EVENTS: Array<{ value: TriggerEventType; label: string; description: string }> = [
  { value: "create", label: "Item Criado", description: "Dispara quando um novo registo é inserido" },
  { value: "update", label: "Item Atualizado", description: "Dispara quando um registo existente é modificado" },
  { value: "stage_changed", label: "Etapa / Estado Alterado", description: "Dispara quando o pipeline stage ou status muda" },
  { value: "no_followup_days", label: "Sem Follow-up X Dias", description: "Dispara quando o registo fica inativo sem acompanhamento" },
  { value: "delete", label: "Item Apagado", description: "Dispara antes ou após eliminação do registo" },
];

const CONDITION_OPERATORS = [
  { value: "_eq", label: "É igual a (==)" },
  { value: "_neq", label: "Não é igual a (!=)" },
  { value: "_gt", label: "Maior que (>)" },
  { value: "_gte", label: "Maior ou igual a (>=)" },
  { value: "_lt", label: "Menor que (<)" },
  { value: "_lte", label: "Menor ou igual a (<=)" },
  { value: "_contains", label: "Contém texto" },
  { value: "_null", label: "Está vazio / nulo" },
  { value: "_nnull", label: "Não está vazio" },
  { value: "_in", label: "Está na lista (A, B, C)" },
];

const ACTION_DEFINITIONS: Array<{
  type: ActionType;
  label: string;
  description: string;
  icon: typeof Mail;
  color: string;
  defaultParams: Record<string, any>;
}> = [
  {
    type: "send_email",
    label: "Enviar Email",
    description: "Envia um email formatado via SMTP / Directus Mail",
    icon: Mail,
    color: "text-blue-500 bg-blue-500/10 border-blue-200 dark:border-blue-800",
    defaultParams: {
      to: "{{email}}",
      subject: "Acompanhamento HotelEquip",
      body: "Olá {{contact_name}},\n\nObrigado pelo seu interesse nos nossos equipamentos.",
    },
  },
  {
    type: "send_whatsapp",
    label: "Enviar WhatsApp",
    description: "Dispara mensagem WhatsApp via Evolution / Meta Cloud",
    icon: MessageSquare,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-200 dark:border-emerald-800",
    defaultParams: {
      to: "{{phone}}",
      message: "Olá {{contact_name}}! Recebemos a sua solicitação e entraremos em contacto brevemente.",
    },
  },
  {
    type: "assign_to_employee",
    label: "Atribuir a Colaborador",
    description: "Reatribui o registo ao gestor comercial ou equipa",
    icon: UserCheck,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-200 dark:border-indigo-800",
    defaultParams: {
      employee_id: "Gestor Comercial",
    },
  },
  {
    type: "create_follow_up",
    label: "Criar Follow-up",
    description: "Agenda uma chamada ou tarefa com data de vencimento",
    icon: CalendarCheck,
    color: "text-amber-500 bg-amber-500/10 border-amber-200 dark:border-amber-800",
    defaultParams: {
      title: "Contactar cliente após 7 dias de inatividade",
      type: "call",
      due_in_days: 1,
      notes: "Verificar interesse na proposta enviada.",
    },
  },
  {
    type: "notify_user",
    label: "Notificação In-App",
    description: "Cria notificação no sino e alerta aos utilizadores",
    icon: Bell,
    color: "text-purple-500 bg-purple-500/10 border-purple-200 dark:border-purple-800",
    defaultParams: {
      title: "Alerta de Workflow",
      message: "Lead sem follow-up há 7 dias: {{company_name}}",
      user_id: "manager",
    },
  },
  {
    type: "create_activity",
    label: "Registar no Activity Ledger",
    description: "Guarda um evento unificado na timeline do cliente",
    icon: Activity,
    color: "text-teal-500 bg-teal-500/10 border-teal-200 dark:border-teal-800",
    defaultParams: {
      activity_type: "task",
      channel: "system",
      summary: "Automação acionada: verificação de follow-up concluída.",
    },
  },
  {
    type: "webhook",
    label: "Chamar Webhook HTTP",
    description: "Envia payload JSON para n8n, Zapier ou API externa",
    icon: Globe,
    color: "text-orange-500 bg-orange-500/10 border-orange-200 dark:border-orange-800",
    defaultParams: {
      url: "https://api.hotelequip.pt/webhook/crm-events",
      method: "POST",
      payload: { event: "workflow_triggered", item_id: "{{id}}" },
    },
  },
];

const AVAILABLE_VARIABLES = [
  "{{id}}",
  "{{company_name}}",
  "{{contact_name}}",
  "{{first_name}}",
  "{{last_name}}",
  "{{email}}",
  "{{phone}}",
  "{{status}}",
  "{{stage}}",
  "{{total_amount}}",
  "{{assigned_employee_id}}",
];

export interface WorkflowRecipe {
  id: string;
  title: string;
  description: string;
  badge: string;
  trigger_collection: string;
  trigger_event: TriggerEventType;
  trigger_conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

export const WORKFLOW_RECIPES: WorkflowRecipe[] = [
  {
    id: "recipe-lead-no-contact-24h",
    title: "Lead sem resposta há 24 horas",
    description: "Cria automaticamente tarefa de follow-up prioritário e notifica a equipa comercial se um lead não tiver seguimento.",
    badge: "Leads · Tempo",
    trigger_collection: "leads",
    trigger_event: "no_followup_days",
    trigger_conditions: [{ field: "status", op: "_eq", value: "incoming" }],
    actions: [
      {
        id: "act-fu-1",
        type: "create_follow_up",
        params: {
          title: "Urgente: Contactar lead parado (24h) - {{company_name}}",
          type: "call",
          due_in_days: 1,
          notes: "Lead sem resposta há mais de 24h. Ligar para qualificar necessidade e agendar demonstração.",
        },
      },
      {
        id: "act-notif-1",
        type: "notify_user",
        params: {
          title: "Alerta de Lead Parado",
          message: "O lead {{company_name}} aguarda contacto há 24 horas.",
          user_id: "commercial",
        },
      },
    ],
  },
  {
    id: "recipe-telecof-missed-call",
    title: "Chamada Perdida Telecof -> Rechamada Rápida",
    description: "Gera tarefa imediata de rechamada no CRM quando uma ligação entra e não é atendida pela equipa.",
    badge: "Telecof · Voz",
    trigger_collection: "activity",
    trigger_event: "create",
    trigger_conditions: [
      { field: "type", op: "_eq", value: "call" },
      { field: "status", op: "_in", value: "missed,unhandled" },
    ],
    actions: [
      {
        id: "act-fu-2",
        type: "create_follow_up",
        params: {
          title: "Rechamar chamada perdida: {{phone}}",
          type: "call",
          due_in_days: 1,
          notes: "Chamada perdida no Telecof. Retornar no prazo máximo de 1 hora.",
        },
      },
      {
        id: "act-notif-2",
        type: "notify_user",
        params: {
          title: "Chamada Não Atendida",
          message: "Chamada não atendida do número {{phone}}.",
          user_id: "commercial",
        },
      },
    ],
  },
  {
    id: "recipe-deal-won-moloni",
    title: "Negócio Ganho -> Atividade & Faturação",
    description: "Quando um negócio é fechado com sucesso, regista no Activity Ledger e aciona webhook para faturação.",
    badge: "Vendas · Deals",
    trigger_collection: "deals",
    trigger_event: "stage_changed",
    trigger_conditions: [{ field: "status", op: "_eq", value: "ganho" }],
    actions: [
      {
        id: "act-act-3",
        type: "create_activity",
        params: {
          activity_type: "deal_won",
          channel: "system",
          summary: "🎉 Negócio Ganho: {{title}} (Valor: {{total_amount}}€). Cliente promovido para faturação.",
        },
      },
      {
        id: "act-notif-3",
        type: "notify_user",
        params: {
          title: "🎉 Negócio Fechado!",
          message: "Parabéns! Negócio ganho: {{title}} ({{total_amount}}€).",
          user_id: "team",
        },
      },
      {
        id: "act-web-3",
        type: "webhook",
        params: {
          url: "https://api.hotelequip.pt/webhook/crm-deal-won",
          method: "POST",
          payload: { deal_id: "{{id}}", event: "deal_won" },
        },
      },
    ],
  },
  {
    id: "recipe-quotation-followup-3d",
    title: "Proposta Enviada -> Follow-up em 3 Dias",
    description: "Agenda chamada de acompanhamento 3 dias após envio do orçamento para verificar dúvidas do cliente.",
    badge: "Orçamentos",
    trigger_collection: "quotations",
    trigger_event: "update",
    trigger_conditions: [{ field: "status", op: "_eq", value: "sent" }],
    actions: [
      {
        id: "act-fu-4",
        type: "create_follow_up",
        params: {
          title: "Follow-up Proposta #{{quotation_number}} - {{company_name}}",
          type: "call",
          due_in_days: 3,
          notes: "Acompanhamento pós-envio de proposta. Esclarecer condições de pagamento e prazos de entrega.",
        },
      },
      {
        id: "act-act-4",
        type: "create_activity",
        params: {
          activity_type: "quotation_sent",
          channel: "crm",
          summary: "Orçamento #{{quotation_number}} enviado ao cliente. Follow-up agendado para D+3.",
        },
      },
    ],
  },
  {
    id: "recipe-new-contact-welcome",
    title: "Novo Cliente Registado -> Boas-Vindas WhatsApp",
    description: "Quando um novo cliente é adicionado, envia mensagem automática WhatsApp de boas-vindas da HotelEquip.",
    badge: "Comunicação",
    trigger_collection: "contacts",
    trigger_event: "create",
    trigger_conditions: [{ field: "phone", op: "_nnull", value: "" }],
    actions: [
      {
        id: "act-wa-5",
        type: "send_whatsapp",
        params: {
          to: "{{phone}}",
          message: "Olá {{contact_name}}! Bem-vindo à HotelEquip. Estamos disponíveis para o apoiar na escolha de equipamentos hoteleiros.",
        },
      },
      {
        id: "act-act-5",
        type: "create_activity",
        params: {
          activity_type: "welcome_sent",
          channel: "whatsapp",
          summary: "Mensagem de boas-vindas enviada ao novo cliente {{company_name}}.",
        },
      },
    ],
  },
];

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<"workflows" | "executions">("workflows");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCollection, setFilterCollection] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Queries & Mutations
  const { data: workflows = [], isLoading: loadingWorkflows, refetch: refetchWorkflows } = useWorkflows();
  const [selectedWorkflowForLogs, setSelectedWorkflowForLogs] = useState<string | undefined>(undefined);
  const { data: executions = [], isLoading: loadingExecutions, refetch: refetchExecutions } = useWorkflowExecutions(selectedWorkflowForLogs);

  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();
  const deleteMutation = useDeleteWorkflow();
  const toggleActiveMutation = useToggleWorkflowActive();
  const testExecutionMutation = useExecuteWorkflowTest();

  // Wizard Dialog State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  // Wizard Form State
  const [wfName, setWfName] = useState("");
  const [wfDescription, setWfDescription] = useState("");
  const [wfTriggerCollection, setWfTriggerCollection] = useState("leads");
  const [wfTriggerEvent, setWfTriggerEvent] = useState<TriggerEventType>("create");
  const [wfConditions, setWfConditions] = useState<WorkflowCondition[]>([]);
  const [wfActions, setWfActions] = useState<WorkflowAction[]>([]);
  const [wfIsActive, setWfIsActive] = useState(true);

  // Test Runner in Wizard
  const [testSampleData, setTestSampleData] = useState<string>(
    JSON.stringify(
      {
        id: "lead-test-001",
        first_name: "João",
        last_name: "Silva",
        company_name: "Hotel Sol & Mar",
        email: "joao.silva@hotelsolmar.pt",
        phone: "+351912345678",
        status: "new",
        total_amount: "2500.00",
      },
      null,
      2
    )
  );
  const [lastTestResult, setLastTestResult] = useState<WorkflowExecutionRow | null>(null);

  // Quick Test Dialog for cards in list
  const [quickTestWorkflow, setQuickTestWorkflow] = useState<WorkflowRow | null>(null);
  const [quickTestResult, setQuickTestResult] = useState<WorkflowExecutionRow | null>(null);

  // Filtered workflows list
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((w) => {
      const matchSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchCollection = filterCollection === "all" || w.trigger_collection === filterCollection;
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && w.is_active) ||
        (filterStatus === "paused" && !w.is_active);
      return matchSearch && matchCollection && matchStatus;
    });
  }, [workflows, searchQuery, filterCollection, filterStatus]);

  // Open Wizard for New Workflow
  const handleOpenNewWizard = () => {
    setEditingWorkflowId(null);
    setWfName("");
    setWfDescription("");
    setWfTriggerCollection("leads");
    setWfTriggerEvent("create");
    setWfConditions([]);
    setWfActions([
      {
        id: `act-${Date.now()}`,
        type: "notify_user",
        params: {
          title: "Novo registo no CRM",
          message: "Um novo item foi criado: {{company_name}}",
        },
      },
    ]);
    setWfIsActive(true);
    setLastTestResult(null);
    setWizardStep(1);
    setWizardOpen(true);
  };

  // Open Wizard for Edit
  const handleOpenEditWizard = (wf: WorkflowRow) => {
    setEditingWorkflowId(wf.id);
    setWfName(wf.name);
    setWfDescription(wf.description || "");
    setWfTriggerCollection(wf.trigger_collection);
    setWfTriggerEvent((wf.trigger_event as TriggerEventType) || "create");
    setWfConditions(wf.trigger_conditions || []);
    setWfActions(wf.actions || []);
    setWfIsActive(wf.is_active);
    setLastTestResult(null);
    setWizardStep(1);
    setWizardOpen(true);
  };

  // Save Wizard
  const handleSaveWorkflow = async () => {
    if (!wfName.trim()) return;

    const payload: Partial<WorkflowRow> = {
      name: wfName.trim(),
      description: wfDescription.trim() || null,
      trigger_collection: wfTriggerCollection,
      trigger_event: wfTriggerEvent,
      trigger_conditions: wfConditions,
      actions: wfActions,
      is_active: wfIsActive,
    };

    if (editingWorkflowId) {
      await updateMutation.mutateAsync({ id: editingWorkflowId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    setWizardOpen(false);
  };

  const [showRecipes, setShowRecipes] = useState(true);

  // Activate pre-built recipe directly (1-click)
  const handleActivateRecipe = async (recipe: WorkflowRecipe) => {
    await createMutation.mutateAsync({
      name: recipe.title,
      description: recipe.description,
      trigger_collection: recipe.trigger_collection,
      trigger_event: recipe.trigger_event,
      trigger_conditions: recipe.trigger_conditions,
      actions: recipe.actions,
      is_active: true,
    });
  };

  // Customize recipe in Wizard
  const handleCustomizeRecipe = (recipe: WorkflowRecipe) => {
    setEditingWorkflowId(null);
    setWfName(recipe.title);
    setWfDescription(recipe.description);
    setWfTriggerCollection(recipe.trigger_collection);
    setWfTriggerEvent(recipe.trigger_event);
    setWfConditions(recipe.trigger_conditions);
    setWfActions(recipe.actions);
    setWfIsActive(true);
    setLastTestResult(null);
    setWizardStep(1);
    setWizardOpen(true);
  };

  // Drag and drop reordering for actions
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(wfActions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setWfActions(items);
  };

  // Run Test in Step 3
  const handleRunWizardTest = async () => {
    let parsedData = {};
    try {
      parsedData = JSON.parse(testSampleData);
    } catch {
      parsedData = { id: "test-123", company_name: "Teste Demo" };
    }

    const currentWf: WorkflowRow = {
      id: editingWorkflowId || "temp-test-id",
      name: wfName || "Workflow em Teste",
      trigger_collection: wfTriggerCollection,
      trigger_event: wfTriggerEvent,
      trigger_conditions: wfConditions,
      actions: wfActions,
      is_active: true,
    };

    const result = await testExecutionMutation.mutateAsync({
      workflow: currentWf,
      sampleItem: parsedData,
    });
    setLastTestResult(result);
  };

  // Run Quick Test from card
  const handleRunQuickTest = async (wf: WorkflowRow) => {
    setQuickTestWorkflow(wf);
    setQuickTestResult(null);
    const sample = {
      id: "demo-sample-01",
      company_name: "Hotel Algarve Palace",
      contact_name: "Manuel Fernandes",
      first_name: "Manuel",
      email: "manuel@algarvepalace.pt",
      phone: "+351919888777",
      status: "lead",
      total_amount: "4800.00",
    };
    const res = await testExecutionMutation.mutateAsync({
      workflow: wf,
      sampleItem: sample,
    });
    setQuickTestResult(res);
  };

  return (
    <AppLayout>
      <div className="flex-1 space-y-6 p-6 max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Automação de Workflows</h1>
                <p className="text-sm text-muted-foreground">
                  Motor visual de regras "If-This-Then-That" com triggers em tempo real e auditoria de execuções.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchWorkflows();
                refetchExecutions();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={handleOpenNewWizard} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Workflow
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total de Workflows</p>
                <p className="text-2xl font-bold">{workflows.length}</p>
              </div>
              <Layers className="h-8 w-8 text-muted-foreground/30" />
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Workflows Ativos</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {workflows.filter((w) => w.is_active).length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Execuções Registadas</p>
                <p className="text-2xl font-bold">{executions.length}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500/30" />
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-primary">
                  {executions.length > 0
                    ? Math.round(
                        (executions.filter((e) => e.status === "completed").length / executions.length) * 100
                      )
                    : 100}
                  %
                </p>
              </div>
              <Sparkles className="h-8 w-8 text-primary/30" />
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
            <TabsList>
              <TabsTrigger value="workflows" className="gap-2">
                <Sliders className="h-4 w-4" />
                Workflows ({filteredWorkflows.length})
              </TabsTrigger>
              <TabsTrigger value="executions" className="gap-2">
                <Activity className="h-4 w-4" />
                Logs de Execuções ({executions.length})
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            {activeTab === "workflows" ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar automações..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 w-[180px] sm:w-[220px]"
                  />
                </div>
                <Select value={filterCollection} onValueChange={setFilterCollection}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Coleção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Coleções</SelectItem>
                    {TRIGGER_COLLECTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="paused">Pausados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedWorkflowForLogs || "all"}
                  onValueChange={(v) => setSelectedWorkflowForLogs(v === "all" ? undefined : v)}
                >
                  <SelectTrigger className="h-9 w-[220px]">
                    <SelectValue placeholder="Filtrar por Workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Workflows</SelectItem>
                    {workflows.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* TAB 1: WORKFLOWS LIST */}
          <TabsContent value="workflows" className="space-y-6">
            {/* Secção de Modelos / Receitas Recomendadas */}
            <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Modelos e Receitas Recomendadas (1-Click)
                  </h2>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    Pronto a Ativar
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRecipes(!showRecipes)}
                  className="text-xs h-7 text-muted-foreground hover:text-foreground"
                >
                  {showRecipes ? "Ocultar Modelos" : "Ver Todos os Modelos"}
                </Button>
              </div>

              {showRecipes && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {WORKFLOW_RECIPES.map((recipe) => (
                    <Card
                      key={recipe.id}
                      className="bg-card/90 border shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <CardHeader className="p-3 pb-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            {recipe.badge}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {recipe.actions.length} ação(ões)
                          </span>
                        </div>
                        <CardTitle className="text-sm font-semibold leading-tight">
                          {recipe.title}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-2">
                          {recipe.description}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="p-3 pt-2 border-t flex items-center justify-between gap-2 bg-muted/20">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCustomizeRecipe(recipe)}
                        >
                          Personalizar
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2.5 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={() => void handleActivateRecipe(recipe)}
                        >
                          <Zap className="h-3 w-3" />
                          Ativar
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de Workflows Configurados */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-muted-foreground" />
                  Os Seus Workflows ({filteredWorkflows.length})
                </h2>
              </div>

              {filteredWorkflows.length === 0 ? (
                <Card className="border-dashed p-8 text-center bg-card/40">
                  <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">Nenhum workflow personalizado criado</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Ative uma das receitas acima com 1-click ou crie um workflow personalizado do zero.
                  </p>
                  <Button onClick={handleOpenNewWizard} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Workflow do Zero
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWorkflows.map((wf) => {
                    const triggerInfo = TRIGGER_COLLECTIONS.find((c) => c.value === wf.trigger_collection);
                    const eventInfo = TRIGGER_EVENTS.find((e) => e.value === wf.trigger_event);

                    return (
                      <Card
                        key={wf.id}
                        className={cn(
                          "relative flex flex-col justify-between transition-all hover:shadow-md border",
                          wf.is_active ? "border-border" : "border-border/60 bg-muted/20 opacity-80"
                        )}
                      >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <Badge
                              variant={wf.is_active ? "default" : "secondary"}
                              className={cn(
                                "text-xs mb-1",
                                wf.is_active ? "bg-emerald-600 hover:bg-emerald-700" : ""
                              )}
                            >
                              {wf.is_active ? "Ativo" : "Pausado"}
                            </Badge>
                            <CardTitle className="text-base font-semibold leading-snug">
                              {wf.name}
                            </CardTitle>
                          </div>
                          <Switch
                            checked={wf.is_active}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ id: wf.id, is_active: checked })
                            }
                          />
                        </div>
                        {wf.description && (
                          <CardDescription className="text-xs line-clamp-2 mt-1">
                            {wf.description}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-3 pb-3 text-xs">
                        {/* Trigger Banner */}
                        <div className="p-2.5 rounded-md bg-secondary/50 border flex items-center gap-2">
                          <div className="p-1 rounded bg-background text-primary font-mono text-[10px] font-bold uppercase">
                            IF
                          </div>
                          <div className="flex-1 truncate">
                            <span className="font-medium text-foreground">
                              {triggerInfo?.label || wf.trigger_collection}
                            </span>
                            <span className="text-muted-foreground"> &rarr; {eventInfo?.label || wf.trigger_event}</span>
                          </div>
                        </div>

                        {/* Conditions summary */}
                        {wf.trigger_conditions && wf.trigger_conditions.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-medium text-muted-foreground">Condições:</span>
                            <div className="flex flex-wrap gap-1">
                              {wf.trigger_conditions.map((c, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] font-normal py-0">
                                  {c.field} {c.op} {String(c.value ?? "")}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions Chain */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Ações Sequenciais ({wf.actions?.length || 0}):
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {(wf.actions || []).map((act, i) => {
                              const actDef = ACTION_DEFINITIONS.find((a) => a.type === act.type);
                              const IconComponent = actDef?.icon || Zap;
                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 p-1.5 rounded bg-muted/60 text-[11px]"
                                >
                                  <span className="text-muted-foreground font-mono text-[10px] w-4">
                                    {i + 1}.
                                  </span>
                                  <IconComponent className="h-3.5 w-3.5 text-primary" />
                                  <span className="font-medium truncate">{actDef?.label || act.type}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2 border-t flex items-center justify-between bg-muted/10">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleRunQuickTest(wf)}
                          >
                            <Play className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                            Testar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSelectedWorkflowForLogs(wf.id);
                              setActiveTab("executions");
                            }}
                          >
                            <Activity className="h-3.5 w-3.5 mr-1" />
                            Logs
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => handleOpenEditWizard(wf)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Tem a certeza que deseja eliminar o workflow "${wf.name}"?`)) {
                                deleteMutation.mutate(wf.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: EXECUTIONS & AUDIT LOGS */}
          <TabsContent value="executions" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Histórico de Execuções e Auditoria</CardTitle>
                    <CardDescription className="text-xs">
                      Registo em tempo real das ações disparadas automaticamente pelo Directus Hook (atualização a cada 30s).
                    </CardDescription>
                  </div>
                  {selectedWorkflowForLogs && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedWorkflowForLogs(undefined)}
                      className="text-xs"
                    >
                      Limpar filtro de workflow
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {executions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Nenhuma execução registada até ao momento. Teste um workflow para gerar logs.
                  </div>
                ) : (
                  <div className="divide-y border-t">
                    {executions.map((exec) => {
                      const isSuccess = exec.status === "completed";
                      const isFailed = exec.status === "failed";
                      const isRunning = exec.status === "running";

                      return (
                        <div key={exec.id} className="p-4 hover:bg-muted/20 transition-colors space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isSuccess && (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Concluído
                                </Badge>
                              )}
                              {isFailed && (
                                <Badge variant="destructive" className="text-xs">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Falhou
                                </Badge>
                              )}
                              {isRunning && (
                                <Badge variant="secondary" className="text-xs animate-pulse bg-blue-500/20 text-blue-600">
                                  <Clock className="h-3 w-3 mr-1" />
                                  A Executar
                                </Badge>
                              )}

                              <span className="font-semibold text-sm">
                                {exec.workflow?.name || `Workflow (${exec.workflow_id})`}
                              </span>
                              {exec.trigger_item_id && (
                                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                  Item #{exec.trigger_item_id}
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {exec.started_at && (
                                <span>
                                  {format(new Date(exec.started_at), "dd/MM/yyyy HH:mm:ss", { locale: pt })} (
                                  {formatDistanceToNow(new Date(exec.started_at), { addSuffix: true, locale: pt })})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Error Banner */}
                          {exec.error && (
                            <div className="p-2 rounded bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>{exec.error}</span>
                            </div>
                          )}

                          {/* Steps Log */}
                          {exec.log && Array.isArray(exec.log) && exec.log.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <span className="text-[11px] font-semibold text-muted-foreground">Passos Executados:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {exec.log.map((step, idx) => (
                                  <div
                                    key={idx}
                                    className={cn(
                                      "p-2 rounded border text-xs flex flex-col justify-between",
                                      step.status === "success"
                                        ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                                        : step.status === "failed"
                                        ? "bg-destructive/10 border-destructive/30"
                                        : "bg-muted/40 border-border"
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium text-[11px]">
                                        Passo {step.step}: {step.action_type}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[9px] py-0",
                                          step.status === "success"
                                            ? "text-emerald-600 border-emerald-300"
                                            : "text-destructive border-destructive"
                                        )}
                                      >
                                        {step.status}
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                                      {step.message}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ─── WIZARD MODAL (Create / Edit Workflow) ─── */}
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold">
                    {editingWorkflowId ? "Editar Workflow" : "Assistente: Novo Workflow de Automação"}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Configure triggers, condições lógicas e a cadeia sequencial de ações.
                  </DialogDescription>
                </div>
              </div>

              {/* Steps Progress */}
              <div className="flex items-center justify-between pt-4 text-xs font-medium">
                {[
                  { step: 1, label: "1. Trigger & Condições" },
                  { step: 2, label: "2. Ações & Steps" },
                  { step: 3, label: "3. Teste em Direto" },
                  { step: 4, label: "4. Ativação" },
                ].map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setWizardStep(s.step as any)}
                    className={cn(
                      "flex items-center gap-1.5 pb-2 border-b-2 transition-all cursor-pointer",
                      wizardStep === s.step
                        ? "border-primary text-primary font-bold"
                        : wizardStep > s.step
                        ? "border-emerald-500 text-emerald-600"
                        : "border-transparent text-muted-foreground"
                    )}
                  >
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 p-6">
              {/* STEP 1: TRIGGER & CONDITIONS */}
              {wizardStep === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Nome do Workflow *</Label>
                      <Input
                        placeholder="Ex: Lead sem follow-up há 7 dias -> Notificar Manager"
                        value={wfName}
                        onChange={(e) => setWfName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Descrição (Opcional)</Label>
                      <Input
                        placeholder="Explicação breve do objetivo da regra..."
                        value={wfDescription}
                        onChange={(e) => setWfDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Definição do Trigger (Gatilho)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Coleção de Origem</Label>
                        <Select value={wfTriggerCollection} onValueChange={setWfTriggerCollection}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRIGGER_COLLECTIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                <div className="flex flex-col text-left">
                                  <span>{c.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Evento do Gatilho</Label>
                        <Select
                          value={wfTriggerEvent}
                          onValueChange={(v) => setWfTriggerEvent(v as TriggerEventType)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRIGGER_EVENTS.map((e) => (
                              <SelectItem key={e.value} value={e.value}>
                                <span>{e.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Conditions Builder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">Condições de Validação (Opcional)</h4>
                        <p className="text-xs text-muted-foreground">
                          O workflow só será executado se TODAS as condições forem satisfeitas.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setWfConditions([
                            ...wfConditions,
                            { field: "status", op: "_eq", value: "new" },
                          ])
                        }
                        className="text-xs gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar Condição
                      </Button>
                    </div>

                    {wfConditions.length === 0 ? (
                      <div className="p-4 rounded-md border border-dashed text-center text-xs text-muted-foreground">
                        Sem filtros adicionais: executa para todos os registos do evento selecionado.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {wfConditions.map((cond, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-muted/40 rounded-md border">
                            <Input
                              placeholder="Campo (ex: status, phone)"
                              value={cond.field}
                              onChange={(e) => {
                                const next = [...wfConditions];
                                next[idx].field = e.target.value;
                                setWfConditions(next);
                              }}
                              className="h-8 text-xs flex-1"
                            />
                            <Select
                              value={cond.op}
                              onValueChange={(v) => {
                                const next = [...wfConditions];
                                next[idx].op = v;
                                setWfConditions(next);
                              }}
                            >
                              <SelectTrigger className="h-8 w-[150px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_OPERATORS.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Valor comparado"
                              value={String(cond.value ?? "")}
                              onChange={(e) => {
                                const next = [...wfConditions];
                                next[idx].value = e.target.value;
                                setWfConditions(next);
                              }}
                              className="h-8 text-xs flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setWfConditions(wfConditions.filter((_, i) => i !== idx));
                              }}
                              className="h-8 w-8 p-0 text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: ACTIONS & STEPS (WITH DRAG-TO-REORDER) */}
              {wizardStep === 2 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">Cadeia Sequencial de Ações</h4>
                      <p className="text-xs text-muted-foreground">
                        Arraste para reordenar. As ações são executadas sequencialmente.
                      </p>
                    </div>

                    {/* Add Action Dropdown */}
                    <Select
                      value=""
                      onValueChange={(type: ActionType) => {
                        const def = ACTION_DEFINITIONS.find((a) => a.type === type);
                        if (def) {
                          setWfActions([
                            ...wfActions,
                            {
                              id: `act-${Date.now()}`,
                              type,
                              params: { ...def.defaultParams },
                            },
                          ]);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-[200px] text-xs gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Adicionar Nova Ação</span>
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_DEFINITIONS.map((act) => (
                          <SelectItem key={act.type} value={act.type}>
                            <div className="flex items-center gap-2">
                              <span>{act.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Variables Helper Bar */}
                  <div className="p-3 bg-secondary/40 rounded-lg border space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Variáveis Dinâmicas Disponíveis:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {AVAILABLE_VARIABLES.map((v) => (
                        <code
                          key={v}
                          className="text-[10px] bg-background border px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText(v);
                          }}
                          title="Clique para copiar"
                        >
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>

                  {/* Actions Drag and Drop List */}
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="actions-list">
                      {(provided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-3"
                        >
                          {wfActions.length === 0 ? (
                            <div className="p-8 text-center border border-dashed rounded-lg text-xs text-muted-foreground">
                              Nenhuma ação configurada. Adicione pelo menos uma ação para o workflow.
                            </div>
                          ) : (
                            wfActions.map((action, index) => {
                              const def = ACTION_DEFINITIONS.find((a) => a.type === action.type);
                              const IconComp = def?.icon || Zap;

                              return (
                                <Draggable
                                  key={action.id || `action-${index}`}
                                  draggableId={action.id || `action-${index}`}
                                  index={index}
                                >
                                  {(dragProvided) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className="p-4 rounded-lg border bg-card shadow-sm space-y-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div
                                            {...dragProvided.dragHandleProps}
                                            className="cursor-grab text-muted-foreground hover:text-foreground"
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </div>
                                          <div className={cn("p-1.5 rounded-md border", def?.color)}>
                                            <IconComp className="h-4 w-4" />
                                          </div>
                                          <div>
                                            <span className="text-xs font-semibold">
                                              Passo {index + 1}: {def?.label || action.type}
                                            </span>
                                            <p className="text-[10px] text-muted-foreground">
                                              {def?.description}
                                            </p>
                                          </div>
                                        </div>

                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setWfActions(wfActions.filter((_, i) => i !== index));
                                          }}
                                          className="h-8 w-8 p-0 text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>

                                      {/* Action Param Forms */}
                                      <div className="pt-2 border-t space-y-3 text-xs">
                                        {action.type === "send_email" && (
                                          <>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <Label className="text-[11px]">Destinatário (To)</Label>
                                                <Input
                                                  className="h-8 text-xs"
                                                  value={action.params.to || ""}
                                                  onChange={(e) => {
                                                    const next = [...wfActions];
                                                    next[index].params.to = e.target.value;
                                                    setWfActions(next);
                                                  }}
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-[11px]">Assunto</Label>
                                                <Input
                                                  className="h-8 text-xs"
                                                  value={action.params.subject || ""}
                                                  onChange={(e) => {
                                                    const next = [...wfActions];
                                                    next[index].params.subject = e.target.value;
                                                    setWfActions(next);
                                                  }}
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <Label className="text-[11px]">Corpo do Email (HTML/Texto)</Label>
                                              <Textarea
                                                rows={2}
                                                className="text-xs"
                                                value={action.params.body || ""}
                                                onChange={(e) => {
                                                  const next = [...wfActions];
                                                  next[index].params.body = e.target.value;
                                                  setWfActions(next);
                                                }}
                                              />
                                            </div>
                                          </>
                                        )}

                                        {action.type === "send_whatsapp" && (
                                          <>
                                            <div>
                                              <Label className="text-[11px]">Número WhatsApp (To)</Label>
                                              <Input
                                                className="h-8 text-xs"
                                                placeholder="{{phone}}"
                                                value={action.params.to || ""}
                                                onChange={(e) => {
                                                  const next = [...wfActions];
                                                  next[index].params.to = e.target.value;
                                                  setWfActions(next);
                                                }}
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-[11px]">Mensagem</Label>
                                              <Textarea
                                                rows={2}
                                                className="text-xs"
                                                value={action.params.message || ""}
                                                onChange={(e) => {
                                                  const next = [...wfActions];
                                                  next[index].params.message = e.target.value;
                                                  setWfActions(next);
                                                }}
                                              />
                                            </div>
                                          </>
                                        )}

                                        {action.type === "assign_to_employee" && (
                                          <div>
                                            <Label className="text-[11px]">Colaborador Destinatário</Label>
                                            <Input
                                              className="h-8 text-xs"
                                              placeholder="Nome ou ID do Colaborador"
                                              value={action.params.employee_id || ""}
                                              onChange={(e) => {
                                                const next = [...wfActions];
                                                next[index].params.employee_id = e.target.value;
                                                setWfActions(next);
                                              }}
                                            />
                                          </div>
                                        )}

                                        {action.type === "create_follow_up" && (
                                          <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2">
                                              <Label className="text-[11px]">Título do Follow-up</Label>
                                              <Input
                                                className="h-8 text-xs"
                                                value={action.params.title || ""}
                                                onChange={(e) => {
                                                  const next = [...wfActions];
                                                  next[index].params.title = e.target.value;
                                                  setWfActions(next);
                                                }}
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-[11px]">Vencimento (+Dias)</Label>
                                              <Input
                                                type="number"
                                                className="h-8 text-xs"
                                                value={action.params.due_in_days || 1}
                                                onChange={(e) => {
                                                  const next = [...wfActions];
                                                  next[index].params.due_in_days = Number(e.target.value);
                                                  setWfActions(next);
                                                }}
                                              />
                                            </div>
                                          </div>
                                        )}

                                        {action.type === "notify_user" && (
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <Label className="text-[11px]">Título da Notificação</Label>
                                              <Input
                                                className="h-8 text-xs"
                                                value={action.params.title || ""}
                                                onChange={(e) => {
                                                  const next = [...wfActions];
                                                  next[index].params.title = e.target.value;
                                                  setWfActions(next);
                                                }}
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-[11px]">Mensagem</Label>
                                              <Input
                                                className="h-8 text-xs"
                                                value={action.params.message || ""}
                                                onChange={(e) => {
                                                  const next = [...wfActions];
                                                  next[index].params.message = e.target.value;
                                                  setWfActions(next);
                                                }}
                                              />
                                            </div>
                                          </div>
                                        )}

                                        {action.type === "create_activity" && (
                                          <div>
                                            <Label className="text-[11px]">Descrição / Resumo no Ledger</Label>
                                            <Input
                                              className="h-8 text-xs"
                                              value={action.params.summary || ""}
                                              onChange={(e) => {
                                                const next = [...wfActions];
                                                next[index].params.summary = e.target.value;
                                                setWfActions(next);
                                              }}
                                            />
                                          </div>
                                        )}

                                        {action.type === "webhook" && (
                                          <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2">
                                              <Label className="text-[11px]">URL do Endpoint</Label>
                                              <Input
                                                className="h-8 text-xs"
                                                value={action.params.url || ""}
                                                onChange={(e) => {
                                                  const next = [...wfActions];
                                                  next[index].params.url = e.target.value;
                                                  setWfActions(next);
                                                }}
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-[11px]">Método</Label>
                                              <Select
                                                value={action.params.method || "POST"}
                                                onValueChange={(m) => {
                                                  const next = [...wfActions];
                                                  next[index].params.method = m;
                                                  setWfActions(next);
                                                }}
                                              >
                                                <SelectTrigger className="h-8 text-xs">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="POST">POST</SelectItem>
                                                  <SelectItem value="PUT">PUT</SelectItem>
                                                  <SelectItem value="GET">GET</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              )}

              {/* STEP 3: LIVE TEST WITH SAMPLE DATA */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">Testar Workflow com Item Real</h4>
                      <p className="text-xs text-muted-foreground">
                        Simula a execução do hook Directus com dados de exemplo antes de ativar em produção.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleRunWizardTest}
                      disabled={testExecutionMutation.isPending}
                      className="gap-2 text-xs"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Executar Teste Agora
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Dados do Item Trigger (JSON):</Label>
                      <Textarea
                        rows={10}
                        className="font-mono text-xs"
                        value={testSampleData}
                        onChange={(e) => setTestSampleData(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Resultado da Execução do Teste:</Label>
                      <div className="h-[220px] rounded-md border bg-muted/40 p-3 overflow-y-auto space-y-2 text-xs">
                        {lastTestResult ? (
                          <>
                            <div className="flex items-center justify-between">
                              <Badge
                                variant={lastTestResult.status === "completed" ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {lastTestResult.status === "completed" ? "Sucesso (200 OK)" : "Falhou"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                Executado em {format(new Date(lastTestResult.started_at), "HH:mm:ss")}
                              </span>
                            </div>
                            <Separator />
                            <div className="space-y-1">
                              {lastTestResult.log.map((step, idx) => (
                                <div key={idx} className="p-1.5 rounded bg-background border text-[11px]">
                                  <div className="flex items-center justify-between font-medium">
                                    <span>
                                      Passo {step.step}: {step.action_type}
                                    </span>
                                    <span className="text-emerald-600 font-mono text-[10px]">
                                      {step.status}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground mt-0.5">{step.message}</p>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground text-center">
                            Clique em "Executar Teste Agora" para verificar o comportamento das ações.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: ACTIVATION & SUMMARY */}
              {wizardStep === 4 && (
                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-secondary/40 border space-y-3">
                    <h4 className="text-sm font-semibold">Resumo do Workflow</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Nome:</span>
                        <p className="font-medium">{wfName || "Sem nome"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gatilho:</span>
                        <p className="font-medium">
                          {wfTriggerCollection} &rarr; {wfTriggerEvent}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Condições:</span>
                        <p className="font-medium">{wfConditions.length} regra(s) ativa(s)</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ações:</span>
                        <p className="font-medium">{wfActions.length} passo(s) configurado(s)</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">Ativar Workflow Imediatamente</Label>
                      <p className="text-xs text-muted-foreground">
                        Se ativado, o hook Directus responderá a eventos reais da coleção {wfTriggerCollection}.
                      </p>
                    </div>
                    <Switch checked={wfIsActive} onCheckedChange={setWfIsActive} />
                  </div>
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="p-4 border-t flex items-center justify-between sm:justify-between">
              <div>
                {wizardStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                  >
                    Voltar
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {wizardStep < 4 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setWizardStep((prev) => (prev + 1) as any)}
                    className="gap-1"
                  >
                    Seguinte
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveWorkflow}
                    disabled={createMutation.isPending || updateMutation.isPending || !wfName.trim()}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Gravar e Concluir
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── QUICK TEST RESULT DIALOG (From card button) ─── */}
        <Dialog open={!!quickTestWorkflow} onOpenChange={(open) => !open && setQuickTestWorkflow(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Play className="h-4 w-4 text-emerald-600" />
                Teste Rápido: {quickTestWorkflow?.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Execução de simulação com dados de teste para validar o encadeamento de ações.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              {quickTestResult ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-muted">
                    <span className="font-semibold">Estado da Execução:</span>
                    <Badge variant={quickTestResult.status === "completed" ? "default" : "destructive"}>
                      {quickTestResult.status}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                    {quickTestResult.log.map((s, idx) => (
                      <div key={idx} className="p-2 rounded border bg-card text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between font-medium">
                          <span>
                            Passo {s.step}: {s.action_type}
                          </span>
                          <span className="text-emerald-600 font-mono text-[10px]">{s.status}</span>
                        </div>
                        <p className="text-muted-foreground">{s.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
                  A executar ações de teste...
                </div>
              )}
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setQuickTestWorkflow(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
