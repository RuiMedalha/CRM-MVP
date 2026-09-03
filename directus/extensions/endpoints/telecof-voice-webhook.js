/**
 * Directus Endpoint: telecof-voice-webhook
 * Recebe POST /telecof-call-ended quando uma chamada Telecof termina.
 *
 * Flow: Webhook -> download audio -> transcribe -> summarize -> ai_call_runs -> activity ledger
 *
 * Config env:
 * - OPENAI_API_KEY (para Whisper)
 * - VITE_DEEPGRAM_API_KEY (opcional, fallback)
 * - AI_ROUTER_DEFAULT_PROVIDER (opcional, "openai" para GPT summary)
 */

export default ({ router, services, env, logger, getSchema }) => {
  const { ItemsService } = services;

  router.post("/telecof-call-ended", async (req, res) => {
    try {
      const { call_id, contact_id, audio_url, duration_seconds, phone, direction, start_time, end_time, agent_name } = req.body || {};

      // ─── Validacao ────────────────────────────────────────────
      if (!call_id) {
        return res.status(400).json({ error: "call_id é obrigatório" });
      }
      if (!audio_url) {
        return res.status(400).json({ error: "audio_url é obrigatório" });
      }

      logger.info(`[telecof-voice] Call ended webhook received: call_id=${call_id}, duration=${duration_seconds ?? "?"}s`);

      // ─── Criar registo inicial em ai_call_runs ────────────────
      const schema = await getSchema();
      const aiRuns = new ItemsService("ai_call_runs", { schema, accountability: "admin" });

      const run = await aiRuns.createOne({
        call_id: parseInt(String(call_id), 10) || call_id,
        status: "processing",
        provider: "openai_whisper",
        model: "whisper-1",
      });

      // ─── Nota: transcricao real requer download de audio e chamada API externa
      // Neste endpoint Directus, delegamos ao worker externo ou fazemos inline.
      // Opcao 1: worker externo (fila n8n/pub-sub)
      // Opcao 2: fetch inline (requer fetch da rede)

      // Por seguranca, registamos "pending" e delegamos para worker externo.
      // O worker real fara: download audio -> transcribe -> summarize -> update ai_call_runs
      await aiRuns.updateOne(run.id, {
        status: "pending",
        error_message: "Aguardando processamento pelo worker externo",
      });

      // ─── Activity ledger ───────────────────────────────────────
      try {
        const activity = new ItemsService("activity", { schema, accountability: "admin" });
        await activity.createOne({
          type: "call",
          channel: "telecof",
          direction: direction === "outbound" ? "out" : "in",
          status: "ai_pending",
          summary: `[Voice AI] Chamada #${call_id} recebida para processamento`,
          occurred_at: new Date().toISOString(),
          contact_id: contact_id ? parseInt(String(contact_id), 10) || contact_id : null,
          source_collection: "ai_call_runs",
          source_id: String(run.id),
          payload: JSON.stringify({ call_id, duration_seconds, audio_url }),
        });
      } catch (actErr) {
        logger.warn(`[telecof-voice] Activity ledger write failed: ${actErr.message}`);
      }

      logger.info(`[telecof-voice] ai_call_run #${run.id} created for call #${call_id}`);

      return res.json({
        success: true,
        aiRunId: run.id,
        status: "pending",
        message: "Chamada enfileirada para processamento Voice AI",
      });
    } catch (err) {
      logger.error(`[telecof-voice] Webhook error: ${err.message}`);
      return res.status(500).json({ error: err.message || "Internal error" });
    }
  });

  // ─── Health check ─────────────────────────────────────────────
  router.get("/telecof-voice-status", (_req, res) => {
    res.json({ status: "ok", service: "telecof-voice-webhook" });
  });
};
