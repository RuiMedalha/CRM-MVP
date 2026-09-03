/**
 * Directus Hook: lead-scoring
 *
 * Trigger: items.create(items/leads) e items.update(items/leads)
 * Efeito: recalcula o score com a fórmula v1 (espelhada em
 *         src/services/leadScoring/score.ts) e:
 *   1. actualiza `leads.score`, `score_factors`, `score_computed_at`,
 *      `score_model_version`
 *   2. insere um registo append-only em `lead_score_history`
 *
 * NOTAS:
 *  - O score é calculado AQUI (no hook) e não via chamada HTTP para o front,
 *    para garantir que a fórmula corre em TODA a criação/actualização de lead,
 *    independentemente da origem (UI, API, n8n, etc.).
 *  - Esta implementação é a "source of truth" em runtime. O ficheiro TypeScript
 *    em src/services/leadScoring/score.ts espelha esta mesma fórmula para uso
 *    na UI (filtros, breakdown preview, A/B test).
 *  - Para evitar loops infinitos: usamos uma flag `__skipScoreRecalc` no payload
 *    durante o write que este hook faz. Directus propaga os input.
 */

const SCORE_MODEL_VERSION = "v1";

// Pesos v1 — manter alinhado com src/services/leadScoring/score.ts (DEFAULT_WEIGHTS_V1)
const WEIGHTS = {
  has_phone: 25,
  has_email: 15,
  has_nif: 10,
  whatsapp_replies: 20,
  email_opens: 15,
  status_qualified: 10,
  decay_per_day_after_7d: -5,
  penalty_discarded_or_spam: -50,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function nonEmpty(v) {
  return v !== undefined && v !== null && String(v).trim().length > 0;
}

function numOrZero(v) {
  const n = Number(v);
  if (!isFinite(n) || isNaN(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Calcula score + factors. Retorna { score, factors, model_version }.
 * Mirror exacto de breakdownScore() no TypeScript.
 */
function computeBreakdown(lead) {
  const factors = {};

  factors.has_phone = nonEmpty(lead.phone) ? WEIGHTS.has_phone : 0;
  factors.has_email = nonEmpty(lead.email) ? WEIGHTS.has_email : 0;
  factors.has_nif = nonEmpty(lead.nif) ? WEIGHTS.has_nif : 0;

  const wa = numOrZero(lead.whatsapp_replies);
  factors.whatsapp_replies = wa > 0 ? wa * WEIGHTS.whatsapp_replies : 0;

  const eo = numOrZero(lead.email_opens);
  factors.email_opens = eo > 0 ? eo * WEIGHTS.email_opens : 0;

  const status = String(lead.status ?? "").toLowerCase();
  factors.status_qualified = status === "qualified" ? WEIGHTS.status_qualified : 0;

  if (status === "discarded" || status === "spam") {
    factors.penalty_discarded_or_spam = WEIGHTS.penalty_discarded_or_spam;
  } else {
    factors.penalty_discarded_or_spam = 0;
  }

  // Penalização por idle days após 7d
  const refStr = lead.last_activity_at || lead.last_attempt_at || lead.date_updated || lead.date_created;
  let refMs;
  if (refStr) {
    const d = new Date(refStr);
    refMs = isNaN(d.getTime()) ? Date.now() : d.getTime();
  } else {
    refMs = Date.now();
  }
  const daysIdle = Math.max(0, Math.floor((Date.now() - refMs) / MS_PER_DAY));
  const extraIdleDays = Math.max(0, daysIdle - 7);
  factors.decay_per_day_after_7d = extraIdleDays * WEIGHTS.decay_per_day_after_7d;

  let positive = 0;
  let negative = 0;
  for (const key of Object.keys(factors)) {
    const v = factors[key];
    if (key === "penalty_discarded_or_spam" || key === "decay_per_day_after_7d") {
      negative += v;
    } else {
      positive += v;
    }
  }

  const raw = positive + negative;
  const score = Math.max(0, Math.min(100, raw));

  return {
    score,
    factors,
    positive,
    negative,
    model_version: SCORE_MODEL_VERSION,
  };
}

export default ({ action }, { services, database, logger, getSchema }) => {
  const { ItemsService } = services;

  /**
   * Hook create: após o lead ser inserido, actualizamos o score nele mesmo
   * (Directus devolve o id em `result`).
   */
  action("items.create", async ({ collection, payload, key }, context) => {
    if (collection !== "leads") return;
    if (!key) return;
    if (payload?.__skipScoreRecalc) return;

    try {
      const breakdown = computeBreakdown(payload);
      const updates = {
        score: breakdown.score,
        score_factors: breakdown.factors,
        score_computed_at: new Date().toISOString(),
        score_model_version: breakdown.model_version,
      };

      // Actualiza o lead. Usa flag __skipScoreRecalc para evitar loop.
      const LeadsService = new ItemsService("leads", {
        schema: await getSchema(),
        accountability: context.accountability,
      });
      await LeadsService.updateOne(key, { ...updates, __skipScoreRecalc: true });

      // Insere no histórico (append-only)
      const HistoryService = new ItemsService("lead_score_history", {
        schema: await getSchema(),
        accountability: context.accountability,
      });
      await HistoryService.createOne({
        lead_id: key,
        score: breakdown.score,
        factors: breakdown.factors,
        model_version: breakdown.model_version,
        computed_at: updates.score_computed_at,
      });
    } catch (err) {
      logger.error(`[lead-scoring] create failed for lead ${key}: ${err?.message ?? err}`);
    }
  });

  /**
   * Hook update: sempre que um lead é actualizado, recalcula.
   */
  action("items.update", async ({ collection, payload, keys }, context) => {
    if (collection !== "leads") return;
    if (!keys || keys.length === 0) return;
    if (payload?.__skipScoreRecalc) return;

    try {
      const LeadsService = new ItemsService("leads", {
        schema: await getSchema(),
        accountability: context.accountability,
      });
      const HistoryService = new ItemsService("lead_score_history", {
        schema: await getSchema(),
        accountability: context.accountability,
      });

      // Directus pode enviar uma key ou várias (batch update).
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) {
        // Buscar estado completo do lead (payload tem só os campos alterados)
        const current = await LeadsService.readOne(key);
        const merged = { ...current, ...payload };

        const breakdown = computeBreakdown(merged);
        const updates = {
          score: breakdown.score,
          score_factors: breakdown.factors,
          score_computed_at: new Date().toISOString(),
          score_model_version: breakdown.model_version,
        };
        await LeadsService.updateOne(key, { ...updates, __skipScoreRecalc: true });

        await HistoryService.createOne({
          lead_id: key,
          score: breakdown.score,
          factors: breakdown.factors,
          model_version: breakdown.model_version,
          computed_at: updates.score_computed_at,
        });
      }
    } catch (err) {
      logger.error(`[lead-scoring] update failed: ${err?.message ?? err}`);
    }
  });
};
