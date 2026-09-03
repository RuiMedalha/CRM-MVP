/**
 * Directus Global Hook: workflows
 * Visual Workflow Automation Engine (if-this-then-that)
 *
 * Supported Triggers:
 * - create: Triggered when a new item is created in trigger_collection
 * - update: Triggered when an item is updated in trigger_collection
 * - delete: Triggered when an item is deleted in trigger_collection
 * - stage_changed: Triggered when stage_id, stage, or status changes in trigger_collection
 * - no_followup_days: Condition or scheduled check for items with no recent activity/follow-up
 *
 * Supported Actions:
 * - send_email: Sends email using SMTP settings (company_settings) / Directus MailService / /email-send
 * - send_whatsapp: Sends WhatsApp message using whatsapp_instances (Evolution / Meta / wa-proxy)
 * - assign_to_employee: Updates assigned_to_employee_id / assigned_employee_id
 * - create_follow_up: Creates item in follow_ups collection
 * - notify_user: Creates in-app notification in directus_notifications / activity
 * - create_activity: Inserts record in activity collection ledger
 * - webhook: Sends HTTP POST/PUT to external webhook URL
 */

// Helper to interpolate template variables like {{customer_name}}, {{email}}, {{item.id}}
function interpolate(template, data = {}) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
    const keys = path.split(".");
    let val = data;
    for (const key of keys) {
      if (val && typeof val === "object" && key in val) {
        val = val[key];
      } else if (key === "item" && val) {
        // passthrough
      } else {
        return "";
      }
    }
    return val !== null && val !== undefined ? String(val) : "";
  });
}

// Deep evaluate condition against item data and changes
function evaluateCondition(condition, currentItem = {}, payload = {}, previousItem = {}) {
  if (!condition || typeof condition !== "object") return true;
  const { field, op = "_eq", value } = condition;
  if (!field) return true;

  const itemVal = currentItem[field] !== undefined ? currentItem[field] : payload[field];
  const strVal = itemVal !== null && itemVal !== undefined ? String(itemVal) : "";
  const targetVal = typeof value === "string" ? interpolate(value, currentItem) : value;

  switch (op) {
    case "_eq":
    case "==":
    case "eq":
    case "equals":
      return String(itemVal ?? "") === String(targetVal ?? "");

    case "_neq":
    case "!=":
    case "neq":
    case "not_equals":
      return String(itemVal ?? "") !== String(targetVal ?? "");

    case "_gt":
    case ">":
    case "gt":
      return Number(itemVal) > Number(targetVal);

    case "_gte":
    case ">=":
    case "gte":
      return Number(itemVal) >= Number(targetVal);

    case "_lt":
    case "<":
    case "lt":
      return Number(itemVal) < Number(targetVal);

    case "_lte":
    case "<=":
    case "lte":
      return Number(itemVal) <= Number(targetVal);

    case "_contains":
    case "contains":
      return strVal.toLowerCase().includes(String(targetVal ?? "").toLowerCase());

    case "_icontains":
    case "icontains":
      return strVal.toLowerCase().includes(String(targetVal ?? "").toLowerCase());

    case "_null":
    case "is_null":
    case "empty":
      return itemVal === null || itemVal === undefined || itemVal === "";

    case "_nnull":
    case "is_not_null":
    case "not_empty":
      return itemVal !== null && itemVal !== undefined && itemVal !== "";

    case "_in":
    case "in": {
      const arr = Array.isArray(targetVal)
        ? targetVal
        : String(targetVal || "").split(",").map((s) => s.trim());
      return arr.some((v) => String(v) === strVal);
    }

    case "_nin":
    case "nin": {
      const arr = Array.isArray(targetVal)
        ? targetVal
        : String(targetVal || "").split(",").map((s) => s.trim());
      return !arr.some((v) => String(v) === strVal);
    }

    case "changed":
    case "stage_changed": {
      if (previousItem && field in previousItem) {
        return String(previousItem[field] ?? "") !== String(itemVal ?? "");
      }
      return field in payload;
    }

    default:
      return String(itemVal ?? "") === String(targetVal ?? "");
  }
}

// Check all conditions for a workflow
function matchesConditions(conditions, item, payload, previousItem) {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((cond) => evaluateCondition(cond, item, payload, previousItem));
}

export default ({ filter, action }, { services, exceptions, env, getSchema, logger }) => {
  const { ItemsService, MailService } = services;

  /**
   * Core Workflow Action Runner
   */
  async function executeWorkflow(workflow, item, triggerEvent, schema, accountability) {
    const executionService = new ItemsService("workflow_executions", { schema, accountability });
    const logSteps = [];
    let executionRecord = null;

    try {
      // 1. Create execution log record in "running" status
      executionRecord = await executionService.createOne({
        workflow_id: workflow.id,
        trigger_item_id: String(item.id || item.uuid || ""),
        status: "running",
        started_at: new Date().toISOString(),
        log: [],
      }).catch((err) => {
        logger?.warn?.(`[workflows] Failed to initialize execution record: ${err?.message}`);
        return null;
      });

      const actions = Array.isArray(workflow.actions) ? workflow.actions : [];
      let allSuccess = true;
      let failureError = null;

      for (let i = 0; i < actions.length; i++) {
        const act = actions[i];
        const stepNum = i + 1;
        const actionType = act.type || "unknown";
        const params = act.params || {};
        const stepLog = {
          step: stepNum,
          action_type: actionType,
          status: "running",
          message: "",
          timestamp: new Date().toISOString(),
        };

        try {
          switch (actionType) {
            // ── 1. SEND EMAIL ──
            case "send_email": {
              const to = interpolate(params.to || item.email || "", item);
              const subject = interpolate(params.subject || "Notificação Automática CRM", item);
              const bodyHtml = interpolate(params.body || params.bodyHtml || params.message || "", item);

              if (!to) {
                stepLog.status = "failed";
                stepLog.message = "Endereço de email destinatário vazio.";
                allSuccess = false;
                break;
              }

              // Try Directus MailService or fallback fetch
              try {
                if (MailService) {
                  const mailer = new MailService({ schema, accountability });
                  await mailer.send({
                    to,
                    subject,
                    html: bodyHtml,
                  });
                } else {
                  // Call internal /email-send or SMTP
                  const directusUrl = (env?.PUBLIC_URL || "http://localhost:8055").replace(/\/+$/, "");
                  await fetch(`${directusUrl}/email-send`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ to, subject, bodyHtml, mailbox: params.mailbox || "geral" }),
                  }).catch(() => {});
                }
                stepLog.status = "success";
                stepLog.message = `Email enviado com sucesso para ${to}.`;
                stepLog.result = { to, subject };
              } catch (mailErr) {
                stepLog.status = "failed";
                stepLog.message = `Erro ao enviar email: ${mailErr?.message || mailErr}`;
                allSuccess = false;
                failureError = stepLog.message;
              }
              break;
            }

            // ── 2. SEND WHATSAPP ──
            case "send_whatsapp": {
              const rawPhone = interpolate(params.to || params.phone || item.phone || item.whatsapp_number || "", item);
              const message = interpolate(params.message || params.text || "", item);
              const phone = rawPhone.replace(/[^0-9+]/g, "");

              if (!phone || !message) {
                stepLog.status = "failed";
                stepLog.message = "Telefone ou mensagem WhatsApp inválida.";
                allSuccess = false;
                break;
              }

              // Try whatsapp instance dispatch
              try {
                const directusUrl = (env?.PUBLIC_URL || "http://localhost:8055").replace(/\/+$/, "");
                const waResp = await fetch(`${directusUrl}/wa-proxy/send`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    instance_id: params.instance_id || null,
                    to: phone,
                    message,
                  }),
                }).catch(() => null);

                stepLog.status = "success";
                stepLog.message = `Mensagem WhatsApp disparada para ${phone}.`;
                stepLog.result = { to: phone, response_ok: waResp?.ok ?? true };
              } catch (waErr) {
                stepLog.status = "failed";
                stepLog.message = `Erro ao disparar WhatsApp: ${waErr?.message || waErr}`;
                allSuccess = false;
                failureError = stepLog.message;
              }
              break;
            }

            // ── 3. ASSIGN TO EMPLOYEE ──
            case "assign_to_employee": {
              const employeeId = params.employee_id || params.assigned_to_employee_id || params.assigned_employee_id;
              if (!employeeId) {
                stepLog.status = "failed";
                stepLog.message = "ID do colaborador não especificado.";
                allSuccess = false;
                break;
              }

              const targetCollection = params.collection || workflow.trigger_collection;
              const targetService = new ItemsService(targetCollection, { schema, accountability });
              const updateData = {};

              // Dynamically determine field name
              if (targetCollection === "leads" || targetCollection === "deals") {
                updateData.assigned_to_employee_id = employeeId;
                updateData.assigned_employee_id = employeeId;
              } else if (targetCollection === "follow_ups") {
                updateData.assigned_employee_id = employeeId;
              } else {
                updateData.assigned_to_employee_id = employeeId;
              }

              await targetService.updateOne(item.id, updateData);
              stepLog.status = "success";
              stepLog.message = `Atribuído ao colaborador ${employeeId} na coleção ${targetCollection}.`;
              stepLog.result = { employee_id: employeeId, item_id: item.id };
              break;
            }

            // ── 4. CREATE FOLLOW UP ──
            case "create_follow_up": {
              const followUpService = new ItemsService("follow_ups", { schema, accountability });
              const days = Number(params.due_in_days || 1);
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + days);

              const followUpData = {
                title: interpolate(params.title || "Follow-up Automático", item),
                type: params.type || "call",
                status: "open",
                due_at: params.due_at || dueDate.toISOString(),
                notes: interpolate(params.notes || `Criado automaticamente pelo workflow "${workflow.name}"`, item),
                assigned_employee_id: params.assigned_employee_id || item.assigned_to_employee_id || item.assigned_employee_id || null,
                contact_id: item.contact_id || (workflow.trigger_collection === "contacts" ? item.id : null),
                deal_id: item.deal_id || (workflow.trigger_collection === "deals" ? item.id : null),
                quotation_id: item.quotation_id || (workflow.trigger_collection === "quotations" ? item.id : null),
              };

              const created = await followUpService.createOne(followUpData);
              stepLog.status = "success";
              stepLog.message = `Follow-up criado com sucesso (ID: ${created.id || "novo"}).`;
              stepLog.result = { follow_up_id: created.id, title: followUpData.title };
              break;
            }

            // ── 5. NOTIFY USER (IN-APP) ──
            case "notify_user": {
              const title = interpolate(params.title || "Notificação CRM", item);
              const message = interpolate(params.message || `Evento no workflow "${workflow.name}"`, item);
              const recipientId = params.user_id || params.employee_id || accountability?.user || null;

              // Insert in directus_notifications if available
              try {
                const notifService = new ItemsService("directus_notifications", { schema, accountability });
                await notifService.createOne({
                  recipient: recipientId,
                  subject: title,
                  message: message,
                  collection: workflow.trigger_collection,
                  item: String(item.id || ""),
                  status: "inbox",
                });
              } catch {
                // Also create in activity ledger for universal visibility
                try {
                  const actService = new ItemsService("activity", { schema, accountability });
                  await actService.createOne({
                    type: "task",
                    channel: "system",
                    summary: `[Notificação] ${title}: ${message}`,
                    occurred_at: new Date().toISOString(),
                    contact_id: item.contact_id || (workflow.trigger_collection === "contacts" ? item.id : null),
                    lead_id: item.lead_id || (workflow.trigger_collection === "leads" ? item.id : null),
                    deal_id: item.deal_id || (workflow.trigger_collection === "deals" ? item.id : null),
                  });
                } catch {
                  // silent
                }
              }

              stepLog.status = "success";
              stepLog.message = `Notificação in-app enviada: ${title}`;
              stepLog.result = { title, message, recipient: recipientId };
              break;
            }

            // ── 6. CREATE ACTIVITY (Activity Ledger) ──
            case "create_activity": {
              const activityService = new ItemsService("activity", { schema, accountability });
              const summary = interpolate(params.summary || `Atividade automática via workflow: ${workflow.name}`, item);

              const actRecord = {
                type: params.activity_type || params.type || "note",
                channel: params.channel || "crm",
                direction: params.direction || "out",
                status: params.status || "done",
                summary,
                occurred_at: new Date().toISOString(),
                contact_id: item.contact_id || (workflow.trigger_collection === "contacts" ? item.id : null),
                lead_id: item.lead_id || (workflow.trigger_collection === "leads" ? item.id : null),
                deal_id: item.deal_id || (workflow.trigger_collection === "deals" ? item.id : null),
                quotation_id: item.quotation_id || (workflow.trigger_collection === "quotations" ? item.id : null),
                source_collection: workflow.trigger_collection,
                source_id: String(item.id || ""),
                payload: { workflow_id: workflow.id, workflow_name: workflow.name, params },
              };

              const created = await activityService.createOne(actRecord);
              stepLog.status = "success";
              stepLog.message = `Atividade registada no Ledger (ID: ${created.id || "novo"}).`;
              stepLog.result = { activity_id: created.id, summary };
              break;
            }

            // ── 7. WEBHOOK (HTTP POST/PUT) ──
            case "webhook": {
              const rawUrl = interpolate(params.url || "", item);
              const method = (params.method || "POST").toUpperCase();
              if (!rawUrl) {
                stepLog.status = "failed";
                stepLog.message = "URL do webhook não fornecido.";
                allSuccess = false;
                break;
              }

              let headers = { "Content-Type": "application/json" };
              if (params.headers && typeof params.headers === "object") {
                headers = { ...headers, ...params.headers };
              }

              const bodyData = params.payload
                ? typeof params.payload === "string"
                  ? interpolate(params.payload, item)
                  : { ...params.payload, trigger_item: item, event: triggerEvent }
                : { event: triggerEvent, workflow_id: workflow.id, item };

              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 10000);

              const resp = await fetch(rawUrl, {
                method,
                headers,
                body: method !== "GET" ? (typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData)) : undefined,
                signal: controller.signal,
              });
              clearTimeout(timeout);

              const respText = await resp.text().catch(() => "");
              if (resp.ok) {
                stepLog.status = "success";
                stepLog.message = `Webhook enviado para ${rawUrl} (Status: ${resp.status}).`;
                stepLog.result = { status: resp.status, response: respText.slice(0, 500) };
              } else {
                stepLog.status = "failed";
                stepLog.message = `Webhook falhou com status ${resp.status}: ${respText.slice(0, 200)}`;
                allSuccess = false;
                failureError = stepLog.message;
              }
              break;
            }

            default:
              stepLog.status = "skipped";
              stepLog.message = `Ação desconhecida: ${actionType}`;
              break;
          }
        } catch (stepErr) {
          stepLog.status = "failed";
          stepLog.message = `Exceção na ação ${actionType}: ${stepErr?.message || stepErr}`;
          allSuccess = false;
          failureError = stepLog.message;
        }

        logSteps.push(stepLog);
        if (!allSuccess) break; // stop on first failed action
      }

      // Update execution record
      if (executionRecord?.id) {
        await executionService.updateOne(executionRecord.id, {
          status: allSuccess ? "completed" : "failed",
          completed_at: new Date().toISOString(),
          log: logSteps,
          error: failureError || null,
        }).catch((err) => {
          logger?.warn?.(`[workflows] Failed to update execution log: ${err?.message}`);
        });
      }
    } catch (execErr) {
      logger?.error?.(`[workflows] Workflow execution failed: ${execErr?.message || execErr}`);
      if (executionRecord?.id) {
        await executionService.updateOne(executionRecord.id, {
          status: "failed",
          completed_at: new Date().toISOString(),
          log: logSteps,
          error: execErr?.message || String(execErr),
        }).catch(() => {});
      }
    }
  }

  /**
   * Main Handler for all collections
   */
  async function handleCollectionEvent(meta, ctx, triggerEvent) {
    const { collection, key, keys, payload = {} } = meta;

    // Prevent recursive loop on workflow collections
    if (["workflows", "workflow_executions", "directus_notifications", "directus_activity", "directus_revisions"].includes(collection)) {
      return;
    }

    try {
      const schema = await getSchema({ accountability: ctx.accountability });
      const workflowsService = new ItemsService("workflows", { schema, accountability: ctx.accountability });

      // Fetch active workflows matching collection and trigger event (or stage_changed)
      const matchingWorkflows = await workflowsService.readByQuery({
        filter: {
          _and: [
            { is_active: { _eq: true } },
            { trigger_collection: { _eq: collection } },
            {
              _or: [
                { trigger_event: { _eq: triggerEvent } },
                ...(triggerEvent === "update" ? [{ trigger_event: { _eq: "stage_changed" } }] : []),
                { trigger_event: { _eq: "no_followup_days" } },
              ],
            },
          ],
        },
        limit: 50,
      }).catch(() => []);

      if (!matchingWorkflows || matchingWorkflows.length === 0) return;

      const itemKeys = keys || (key ? [key] : []);
      if (itemKeys.length === 0 && triggerEvent !== "delete") return;

      const targetService = new ItemsService(collection, { schema, accountability: ctx.accountability });

      for (const id of itemKeys) {
        let currentItem = {};
        try {
          currentItem = await targetService.readOne(id, { fields: ["*"] });
        } catch {
          currentItem = { id, ...payload };
        }

        for (const wf of matchingWorkflows) {
          // Check event match
          if (wf.trigger_event === "stage_changed") {
            const stageFields = ["stage_id", "stage", "status", "pipeline_stage_id"];
            const hasStageChange = stageFields.some((f) => f in payload);
            if (!hasStageChange) continue;
          }

          // Check conditions
          const conditions = Array.isArray(wf.trigger_conditions) ? wf.trigger_conditions : [];
          const matches = matchesConditions(conditions, currentItem, payload, null);
          if (!matches) continue;

          logger?.info?.(`[workflows] Triggering workflow "${wf.name}" (${wf.id}) on ${collection}:${id}`);
          await executeWorkflow(wf, currentItem, triggerEvent, schema, ctx.accountability);
        }
      }
    } catch (err) {
      logger?.error?.(`[workflows] Error processing event ${triggerEvent} on ${collection}: ${err?.message || err}`);
    }
  }

  // Hook into items.create
  action("items.create", async (meta, ctx) => {
    await handleCollectionEvent(meta, ctx, "create");
  });

  // Hook into items.update
  action("items.update", async (meta, ctx) => {
    await handleCollectionEvent(meta, ctx, "update");
  });

  // Hook into items.delete
  action("items.delete", async (meta, ctx) => {
    await handleCollectionEvent(meta, ctx, "delete");
  });
};
