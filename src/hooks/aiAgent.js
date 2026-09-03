/**
 * Card 16 — Directus Hooks (extensões) para AI Agentica.
 *
 * - leads.items.create     → qualificaLead
 * - deals.items.update    → se stage mudou para "proposta", draftEmail
 * - follow_ups.items.create (com due_at excedido) → scheduleFollowup
 *
 * Este hook é carregado pelo Directus via `extensions/hooks/ai-agent/index.js`
 * e re-exporta handlers `filter`/`action` no formato esperado pela plataforma.
 * Para execução local em browser/Node, expomos também helpers nomeados que
 * a UI pode invocar.
 */

const { qualifyLead } = require("../services/ai/agents/leadQualifier.js");
const { draftEmail } = require("../services/ai/agents/emailDrafter.js");
const {
  scheduleFollowup,
} = require("../services/ai/agents/followupScheduler.js");

const PROPOSTA_STAGE = "proposta";

async function onLeadCreate(input, { database, schema, accountability } = {}) {
  try {
    const payload = input.payload || {};
    const leadId = payload.key ?? payload.id ?? null;
    const lead = await database("leads").where({ id: leadId }).first();
    if (!lead) return input;

    const result = await qualifyLead({
      lead_id: String(lead.id),
      name: lead.name || lead.full_name || "Lead",
      email: lead.email || null,
      source: lead.source || lead.origin || null,
      context: {
        phone: lead.phone || null,
        company: lead.company || lead.company_name || null,
      },
    });

    return { ...input, payload: { ...payload, ai_qualification: result } };
  } catch (err) {
    console.warn("[ai-agent] onLeadCreate falhou", err);
    return input;
  }
}

async function onDealUpdate(input, { database } = {}) {
  try {
    const before = await database("deals")
      .where({ id: input.keys?.[0] })
      .first()
      .catch(() => null);
    const next = input.payload || {};
    const stageChanged =
      before && before.stage !== next.stage && next.stage === PROPOSTA_STAGE;

    if (!stageChanged) return input;

    const lead = before?.lead_id
      ? await database("leads").where({ id: before.lead_id }).first()
      : null;

    const context = {
      lead_name: lead?.name || "Cliente",
      deal_title: before.title || before.name || "Proposta",
      stage: next.stage,
    };

    await draftEmail({
      lead_id: lead?.id ? String(lead.id) : null,
      deal_id: String(before.id),
      lead_name: context.lead_name,
      deal_title: context.deal_title,
      stage: context.stage,
      recent_messages: [],
    });

    return input;
  } catch (err) {
    console.warn("[ai-agent] onDealUpdate falhou", err);
    return input;
  }
}

async function onFollowupOverdue(input, { database } = {}) {
  try {
    const due = input.payload?.due_at;
    if (!due) return input;
    if (new Date(due).getTime() > Date.now()) return input;

    const leadId = input.payload.lead_id || input.payload.contact_id;
    if (!leadId) return input;

    const lastDate = await database("follow_ups")
      .where({ lead_id: leadId })
      .max("due_at as last_due")
      .first()
      .catch(() => null);

    const days = lastDate?.last_due
      ? Math.floor(
          (Date.now() - new Date(lastDate.last_due).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 30;

    const lead = await database("leads").where({ id: leadId }).first();

    await scheduleFollowup({
      lead_id: String(leadId),
      lead_name: lead?.name || "Lead",
      last_follow_up_days: days,
      context: { triggered_by: "due_at_exceeded" },
    });

    return input;
  } catch (err) {
    console.warn("[ai-agent] onFollowupOverdue falhou", err);
    return input;
  }
}

module.exports = {
  onLeadCreate,
  onDealUpdate,
  onFollowupOverdue,
  filter: {
    "items.create": onLeadCreate,
  },
  action: {
    "items.create": onLeadCreate,
    "items.update": onDealUpdate,
  },
};