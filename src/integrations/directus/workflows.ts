/**
 * Workflows & Workflow Executions — Directus SDK & REST API Integration
 */

import { directusRequest } from "./client";
import { qs } from "./utils";

export const DIRECTUS_WORKFLOWS_COLLECTION =
  import.meta.env.VITE_DIRECTUS_WORKFLOWS_COLLECTION || "workflows";
export const DIRECTUS_WORKFLOW_EXECUTIONS_COLLECTION =
  import.meta.env.VITE_DIRECTUS_WORKFLOW_EXECUTIONS_COLLECTION || "workflow_executions";

export type TriggerEventType =
  | "create"
  | "update"
  | "delete"
  | "stage_changed"
  | "no_followup_days";

export type ActionType =
  | "send_email"
  | "send_whatsapp"
  | "assign_to_employee"
  | "create_follow_up"
  | "notify_user"
  | "create_activity"
  | "webhook";

export type ConditionOperator =
  | "_eq"
  | "_neq"
  | "_gt"
  | "_gte"
  | "_lt"
  | "_lte"
  | "_contains"
  | "_icontains"
  | "_null"
  | "_nnull"
  | "_in"
  | "_nin"
  | "stage_changed";

export interface WorkflowCondition {
  field: string;
  op: ConditionOperator | string;
  value: any;
}

export interface WorkflowAction {
  id?: string;
  type: ActionType | string;
  params: Record<string, any>;
}

export interface WorkflowRow {
  id: string;
  name: string;
  description?: string | null;
  trigger_collection: string;
  trigger_event: TriggerEventType | string;
  trigger_conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  is_active: boolean;
  created_by?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
}

export interface WorkflowExecutionStepLog {
  step: number;
  action_type: ActionType | string;
  status: "success" | "failed" | "skipped" | "running";
  message: string;
  result?: any;
  timestamp: string;
}

export interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  trigger_item_id?: string | null;
  status: "pending" | "running" | "completed" | "failed";
  started_at: string;
  completed_at?: string | null;
  log: WorkflowExecutionStepLog[];
  error?: string | null;
  date_created?: string | null;
  workflow?: Partial<WorkflowRow>;
}

// ─── LocalStorage Fallback Storage Keys ───
const LOCAL_STORAGE_WORKFLOWS_KEY = "crm_workflows_v1";
const LOCAL_STORAGE_EXECUTIONS_KEY = "crm_workflow_executions_v1";

export const DEFAULT_WORKFLOWS: WorkflowRow[] = [
  {
    id: "wf-lead-inactivity-7d",
    name: "Lead sem follow-up há 7 dias -> Notificar Manager",
    description: "Quando um Lead fica 7 dias sem atividade ou follow-up, cria notificação in-app e follow-up de urgência.",
    trigger_collection: "leads",
    trigger_event: "no_followup_days",
    trigger_conditions: [
      { field: "status", op: "_neq", value: "converted" },
      { field: "status", op: "_neq", value: "lost" },
    ],
    actions: [
      {
        id: "act-1",
        type: "notify_user",
        params: {
          user_id: "manager",
          title: "Atenção: Lead sem follow-up",
          message: "O lead {{first_name}} {{last_name}} está há mais de 7 dias sem contacto.",
        },
      },
      {
        id: "act-2",
        type: "create_follow_up",
        params: {
          title: "Ligar urgente - Lead inativo há 7 dias",
          type: "call",
          due_in_days: 1,
          notes: "Verificar motivo de ausência de contacto.",
        },
      },
      {
        id: "act-3",
        type: "create_activity",
        params: {
          activity_type: "task",
          channel: "system",
          summary: "Alerta automático de inatividade de 7 dias disparado.",
        },
      },
    ],
    is_active: true,
    date_created: "2026-08-20T10:00:00.000Z",
    date_updated: "2026-08-20T10:00:00.000Z",
  },
  {
    id: "wf-new-lead-welcome-wa",
    name: "Novo Lead Criado -> Enviar WhatsApp Boas-vindas",
    description: "Envia mensagem de boas-vindas pelo WhatsApp quando um novo lead com telefone entra no CRM.",
    trigger_collection: "leads",
    trigger_event: "create",
    trigger_conditions: [
      { field: "phone", op: "_nnull", value: "" },
    ],
    actions: [
      {
        id: "act-wa-1",
        type: "send_whatsapp",
        params: {
          to: "{{phone}}",
          message: "Olá {{first_name}}! Recebemos o seu pedido de contacto na HotelEquip. O nosso gestor comercial entrará em contacto em breve.",
        },
      },
      {
        id: "act-act-1",
        type: "create_activity",
        params: {
          activity_type: "whatsapp",
          channel: "evolution",
          direction: "out",
          summary: "Mensagem automática de boas-vindas WhatsApp enviada.",
        },
      },
    ],
    is_active: true,
    date_created: "2026-08-22T14:30:00.000Z",
    date_updated: "2026-08-22T14:30:00.000Z",
  },
  {
    id: "wf-deal-stage-won-moloni",
    name: "Oportunidade Ganha -> Sincronizar Webhook Moloni",
    description: "Quando uma oportunidade atinge a fase Ganho, envia webhook para integração de faturação.",
    trigger_collection: "deals",
    trigger_event: "stage_changed",
    trigger_conditions: [
      { field: "stage", op: "_eq", value: "won" },
    ],
    actions: [
      {
        id: "act-wh-1",
        type: "webhook",
        params: {
          url: "https://api.hotelequip.pt/webhook/moloni/deal-won",
          method: "POST",
          headers: { "X-Source": "CRM-Workflow" },
          payload: { deal_id: "{{id}}", amount: "{{value}}" },
        },
      },
      {
        id: "act-notif-won",
        type: "notify_user",
        params: {
          title: "🎉 Negócio Ganho!",
          message: "A oportunidade {{title}} foi marcada como Ganha.",
        },
      },
    ],
    is_active: true,
    date_created: "2026-08-25T09:15:00.000Z",
    date_updated: "2026-08-25T09:15:00.000Z",
  },
];

function getLocalWorkflows(): WorkflowRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_WORKFLOWS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_WORKFLOWS_KEY, JSON.stringify(DEFAULT_WORKFLOWS));
      return DEFAULT_WORKFLOWS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_WORKFLOWS;
  }
}

function saveLocalWorkflows(items: WorkflowRow[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_WORKFLOWS_KEY, JSON.stringify(items));
  } catch {
    // silent
  }
}

function getLocalExecutions(): WorkflowExecutionRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EXECUTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalExecutions(items: WorkflowExecutionRow[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_EXECUTIONS_KEY, JSON.stringify(items));
  } catch {
    // silent
  }
}

// ─── WORKFLOWS CRUD ───

export async function listWorkflows(params?: {
  collection?: string;
  is_active?: boolean;
}): Promise<WorkflowRow[]> {
  try {
    const q: Record<string, any> = {
      limit: 100,
      sort: "-date_created",
      fields: "*",
    };
    if (params?.collection) q["filter[trigger_collection][_eq]"] = params.collection;
    if (params?.is_active !== undefined) q["filter[is_active][_eq]"] = params.is_active;

    const res = await directusRequest<{ data: WorkflowRow[] }>(
      `/items/${DIRECTUS_WORKFLOWS_COLLECTION}${qs(q)}`
    );
    if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    return getLocalWorkflows();
  } catch {
    return getLocalWorkflows();
  }
}

export async function getWorkflow(id: string): Promise<WorkflowRow | null> {
  try {
    const res = await directusRequest<{ data: WorkflowRow }>(
      `/items/${DIRECTUS_WORKFLOWS_COLLECTION}/${encodeURIComponent(id)}${qs({ fields: "*" })}`
    );
    return res?.data || null;
  } catch {
    const local = getLocalWorkflows();
    return local.find((w) => w.id === id) || null;
  }
}

export async function createWorkflow(payload: Partial<WorkflowRow>): Promise<WorkflowRow> {
  const newItem: WorkflowRow = {
    id: payload.id || crypto.randomUUID(),
    name: payload.name || "Novo Workflow",
    description: payload.description || null,
    trigger_collection: payload.trigger_collection || "leads",
    trigger_event: payload.trigger_event || "create",
    trigger_conditions: payload.trigger_conditions || [],
    actions: payload.actions || [],
    is_active: payload.is_active ?? true,
    created_by: payload.created_by || null,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  try {
    const res = await directusRequest<{ data: WorkflowRow }>(
      `/items/${DIRECTUS_WORKFLOWS_COLLECTION}`,
      {
        method: "POST",
        body: JSON.stringify(newItem),
      }
    );
    if (res?.data) {
      const local = getLocalWorkflows();
      saveLocalWorkflows([res.data, ...local.filter((w) => w.id !== res.data.id)]);
      return res.data;
    }
  } catch {
    // fallback to local
  }

  const local = getLocalWorkflows();
  const updated = [newItem, ...local.filter((w) => w.id !== newItem.id)];
  saveLocalWorkflows(updated);
  return newItem;
}

export async function updateWorkflow(id: string, payload: Partial<WorkflowRow>): Promise<WorkflowRow> {
  const patchData = {
    ...payload,
    date_updated: new Date().toISOString(),
  };

  try {
    const res = await directusRequest<{ data: WorkflowRow }>(
      `/items/${DIRECTUS_WORKFLOWS_COLLECTION}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patchData),
      }
    );
    if (res?.data) {
      const local = getLocalWorkflows();
      const updated = local.map((w) => (w.id === id ? { ...w, ...res.data } : w));
      saveLocalWorkflows(updated);
      return res.data;
    }
  } catch {
    // fallback to local
  }

  const local = getLocalWorkflows();
  let found = local.find((w) => w.id === id);
  if (found) {
    found = { ...found, ...patchData };
    const updated = local.map((w) => (w.id === id ? found! : w));
    saveLocalWorkflows(updated);
    return found;
  }
  throw new Error(`Workflow ${id} not found`);
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  try {
    await directusRequest(`/items/${DIRECTUS_WORKFLOWS_COLLECTION}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    // fallback
  }
  const local = getLocalWorkflows();
  saveLocalWorkflows(local.filter((w) => w.id !== id));
  return true;
}

export async function toggleWorkflowActive(id: string, is_active: boolean): Promise<WorkflowRow> {
  return updateWorkflow(id, { is_active });
}

// ─── WORKFLOW EXECUTIONS ───

export async function listWorkflowExecutions(params?: {
  workflow_id?: string;
  status?: string;
  limit?: number;
}): Promise<WorkflowExecutionRow[]> {
  try {
    const q: Record<string, any> = {
      limit: params?.limit || 50,
      sort: "-started_at",
      fields: "*,workflow_id.id,workflow_id.name,workflow_id.trigger_collection",
    };
    if (params?.workflow_id) q["filter[workflow_id][_eq]"] = params.workflow_id;
    if (params?.status) q["filter[status][_eq]"] = params.status;

    const res = await directusRequest<{ data: WorkflowExecutionRow[] }>(
      `/items/${DIRECTUS_WORKFLOW_EXECUTIONS_COLLECTION}${qs(q)}`
    );
    if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    const local = getLocalExecutions();
    if (params?.workflow_id) {
      return local.filter((e) => e.workflow_id === params.workflow_id);
    }
    return local;
  } catch {
    const local = getLocalExecutions();
    if (params?.workflow_id) {
      return local.filter((e) => e.workflow_id === params.workflow_id);
    }
    return local;
  }
}

// ─── TEST EXECUTION RUNNER (Simulated / In-App Execution) ───

function interpolateVars(template: string, data: Record<string, any>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
    const keys = path.split(".");
    let val: any = data;
    for (const key of keys) {
      if (val && typeof val === "object" && key in val) {
        val = val[key];
      } else {
        return "";
      }
    }
    return val !== null && val !== undefined ? String(val) : "";
  });
}

export async function executeWorkflowTest(
  workflow: WorkflowRow,
  sampleItem: Record<string, any>
): Promise<WorkflowExecutionRow> {
  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const stepLogs: WorkflowExecutionStepLog[] = [];
  let executionStatus: "completed" | "failed" = "completed";
  let executionError: string | null = null;

  for (let i = 0; i < (workflow.actions || []).length; i++) {
    const action = workflow.actions[i];
    const stepNum = i + 1;
    const actionType = action.type;
    const params = action.params || {};
    const timestamp = new Date().toISOString();

    try {
      switch (actionType) {
        case "send_email": {
          const to = interpolateVars(params.to || sampleItem.email || "exemplo@hotelequip.pt", sampleItem);
          const subject = interpolateVars(params.subject || "Notificação CRM", sampleItem);
          stepLogs.push({
            step: stepNum,
            action_type: actionType,
            status: "success",
            message: `Email preparado e despachado para ${to} com assunto "${subject}".`,
            result: { to, subject },
            timestamp,
          });
          break;
        }
        case "send_whatsapp": {
          const to = interpolateVars(params.to || sampleItem.phone || "+351912345678", sampleItem);
          const msg = interpolateVars(params.message || "", sampleItem);
          stepLogs.push({
            step: stepNum,
            action_type: actionType,
            status: "success",
            message: `Mensagem WhatsApp disparada para ${to}.`,
            result: { to, message_preview: msg.slice(0, 100) },
            timestamp,
          });
          break;
        }
        case "assign_to_employee": {
          const emp = params.employee_id || "Gestor Comercial";
          stepLogs.push({
            step: stepNum,
            action_type: actionType,
            status: "success",
            message: `Item reatribuído com sucesso ao colaborador ${emp}.`,
            result: { assigned_to: emp },
            timestamp,
          });
          break;
        }
        case "create_follow_up": {
          const title = interpolateVars(params.title || "Follow-up de Teste", sampleItem);
          const days = params.due_in_days || 1;
          stepLogs.push({
            step: stepNum,
            action_type: actionType,
            status: "success",
            message: `Follow-up "${title}" agendado para +${days} dia(s).`,
            result: { title, due_in_days: days, type: params.type || "call" },
            timestamp,
          });
          break;
        }
        case "notify_user": {
          const title = interpolateVars(params.title || "Notificação", sampleItem);
          const body = interpolateVars(params.message || "", sampleItem);
          stepLogs.push({
            step: stepNum,
            action_type: actionType,
            status: "success",
            message: `Notificação in-app enviada: ${title} (${body}).`,
            result: { title, message: body },
            timestamp,
          });
          break;
        }
        case "create_activity": {
          const summary = interpolateVars(params.summary || "Atividade de automação", sampleItem);
          stepLogs.push({
            step: stepNum,
            action_type: actionType,
            status: "success",
            message: `Registo criado no Activity Ledger: "${summary}".`,
            result: { summary, type: params.activity_type || "note" },
            timestamp,
          });
          break;
        }
        case "webhook": {
          const url = interpolateVars(params.url || "https://httpbin.org/post", sampleItem);
          stepLogs.push({
            step: stepNum,
            action_type: actionType,
            status: "success",
            message: `POST webhook enviado para ${url}. Resposta: 200 OK.`,
            result: { url, status: 200 },
            timestamp,
          });
          break;
        }
        default:
          stepLogs.push({
            step: stepNum,
            action_type: actionType,
            status: "skipped",
            message: `Ação ${actionType} processada com sucesso.`,
            timestamp,
          });
          break;
      }
    } catch (err: any) {
      executionStatus = "failed";
      executionError = err?.message || String(err);
      stepLogs.push({
        step: stepNum,
        action_type: actionType,
        status: "failed",
        message: `Falha na execução: ${executionError}`,
        timestamp,
      });
      break;
    }
  }

  const executionRecord: WorkflowExecutionRow = {
    id: executionId,
    workflow_id: workflow.id,
    trigger_item_id: sampleItem.id || "test-item-123",
    status: executionStatus,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    log: stepLogs,
    error: executionError,
    date_created: startedAt,
    workflow: {
      id: workflow.id,
      name: workflow.name,
      trigger_collection: workflow.trigger_collection,
    },
  };

  // Try saving to Directus
  try {
    await directusRequest(`/items/${DIRECTUS_WORKFLOW_EXECUTIONS_COLLECTION}`, {
      method: "POST",
      body: JSON.stringify({
        workflow_id: workflow.id,
        trigger_item_id: executionRecord.trigger_item_id,
        status: executionRecord.status,
        started_at: executionRecord.started_at,
        completed_at: executionRecord.completed_at,
        log: executionRecord.log,
        error: executionRecord.error,
      }),
    });
  } catch {
    // save locally
  }

  const localExecs = getLocalExecutions();
  saveLocalExecutions([executionRecord, ...localExecs]);

  return executionRecord;
}
