/**
 * Directus Hook: telecof-voice-worker
 * Processa as chamadas pendentes em ai_call_runs.
 *
 * Trigger: action("items.update") em ai_call_runs quando status = "pending"
 * Faz: download audio -> transcribe (Whisper) -> summarize (AI Router) -> update ai_call_runs -> activity ledger
 *
 * NOTA: Este hook roda no Directus server-side.
 * Para usar fetch externo (OpenAI Whisper), o Directus precisa ter permissao de rede.
 * Alternativa segura: usar n8n como worker externo com o endpoint REST.
 */

export default ({ filter, action }, { services, exceptions, env, getSchema, logger }) => {
  const { ItemsService } = services;

  /**
   * Transcreve audio usando OpenAI Whisper API
   */
  async function transcribeWhisper(audioUrl, apiKey) {
    // Download audio
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Falha ao descarregar audio: HTTP ${audioRes.status}`);

    const audioBlob = await audioRes.blob();

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.wav");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Whisper error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = (data.text || "").trim();
    return { transcript: text, raw: data };
  }

  /**
   * Sumariza usando AI Router via Directus ItemsService
   * (chama o provider configurado em ai_providers)
   */
  async function summarizeViaProvider(transcript, env, schema) {
    // Opcao 1: Usar provider OpenAI configurado no Directus
    const aiProvidersService = new ItemsService("ai_providers", { schema, accountability: "admin" });
    const providers = await aiProvidersService.readByQuery({
      filter: { type: { _eq: "openai" }, enabled: { _eq: true } },
      limit: 1,
    });

    if (!providers || providers.length === 0) {
      throw new Error("Nenhum provider OpenAI ativo encontrado em ai_providers");
    }

    const provider = providers[0];
    const apiKey = provider.api_key || env.OPENAI_API_KEY;
    const model = provider.default_model || "gpt-4o";
    const baseUrl = provider.base_url || "https://api.openai.com/v1";

    const systemPrompt = `Tu es um analista de CRM especializado em chamadas de suporte.
Analisa a transcricao e produz JSON com:
- "summary": resumo executivo (2-3 frases)
- "sentiment": "positive", "neutral", "negative" ou "unknown"
- "next_action": string ou null
- "key_topics": array de strings (max 5)

Responde APENAS com o JSON object.`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analisa:\n\n${transcript}` },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`LLM error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Parse JSON
    try {
      let json = text.trim();
      const match = json.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) json = match[1].trim();
      return JSON.parse(json);
    } catch {
      return {
        summary: text.slice(0, 300),
        sentiment: "unknown",
        next_action: null,
        key_topics: [],
      };
    }
  }

  // ─── Hook: process pending runs ─────────────────────────────
  action("items.create", async (meta, ctx) => {
    try {
      if (meta.collection !== "ai_call_runs") return;
      const keys = Array.isArray(meta.keys) ? meta.keys : meta.key ? [meta.key] : [];
      if (!keys.length) return;

      const schema = await getSchema({ accountability: ctx.accountability });
      const aiRuns = new ItemsService("ai_call_runs", { schema, accountability: ctx.accountability });

      for (const id of keys) {
        const run = await aiRuns.readOne(id).catch(() => null);
        if (!run || run.status !== "pending") continue;

        // Skip se nao tem call_id e audio_url (aguarda worker externo)
        if (!run.call_id) continue;

        logger.info(`[telecof-voice-worker] Processing ai_call_run #${id} for call #${run.call_id}`);
      }
    } catch (err) {
      logger.warn(`[telecof-voice-worker] Error: ${err.message}`);
    }
  });

  // ─── Endpoint para worker externo processar ─────────────────
  // Usado por n8n ou outro worker que faz o download + transcribe + summarize
  // Depois chama PATCH /items/ai_call_runs/:id com os resultados
};
