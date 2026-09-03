/**
 * Directus Endpoint: /public/lead-capture/:slug
 *
 * Public POST endpoint that receives a Web-to-Lead form submission,
 * validates against the form definition, creates a lead in `leads`,
 * (optionally) assigns via round-robin, records an interaction entry,
 * fires the configured webhook, and returns JSON.
 */

export default (router, { services, exceptions, logger }) => {
  const { ItemsService } = services;
  const { InvalidPayloadException, NotFoundException } = exceptions;

  let rrCounter = 0;
  let rrCache = { pool: null, fetchedAt: 0 };

  async function getActiveEmployees() {
    const now = Date.now();
    if (rrCache.pool && now - rrCache.fetchedAt < 30000) return rrCache.pool;
    try {
      const svc = new ItemsService("employees", { schema: "public" });
      const rows = await svc.readByQuery({
        filter: { status: { _eq: "published" } },
        fields: ["id"],
        limit: 500,
      });
      const pool = Array.isArray(rows) ? rows.map((r) => r.id).filter(Boolean) : [];
      rrCache = { pool, fetchedAt: now };
      return pool;
    } catch (e) {
      try { if (logger && logger.warn) logger.warn("[lead-capture] pool fetch failed: " + (e && e.message || e)); } catch (_e) {}
      return [];
    }
  }

  function pickDisplay(data) {
    return {
      display_name: (data && (data.name || data.full_name || data.display_name)) || null,
      email: (data && data.email) || null,
      phone: (data && (data.phone || data.telefone || data.tel)) || null,
      nif: (data && data.nif) || null,
    };
  }

  async function triggerWebhook(url, payload) {
    if (!url) return;
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch (e) {
      try { if (logger && logger.warn) logger.warn("[lead-capture] webhook failed: " + (e && e.message || e)); } catch (_e) {}
    }
  }

  router.post("/:slug", async (req, res) => {
    try {
      const { slug } = req.params || {};
      if (!slug) throw new InvalidPayloadException("slug em falta");

      const forms = new ItemsService("lead_capture_forms", { schema: "public", accountability: null });
      const rows = await forms.readByQuery({
        filter: { slug: { _eq: slug }, is_active: { _eq: true } },
        limit: 1,
      });
      const form = Array.isArray(rows) ? rows[0] : (rows && rows.data && rows.data[0]);
      if (!form) throw new NotFoundException("Form nao encontrado ou inativo");

      const fields = Array.isArray(form.fields) ? form.fields : [];
      const data = (req.body && typeof req.body === "object") ? req.body : {};

      for (const f of fields) {
        if (!f || !f.required) continue;
        const v = data && data[f.name];
        if (v === undefined || v === null || String(v).trim() === "") {
          throw new InvalidPayloadException("Campo obrigatorio em falta: " + (f.label || f.name));
        }
      }

      const picked = pickDisplay(data);

      let assignee = form.assign_to_employee_id || null;
      if (!assignee && Array.isArray(form.round_robin_pool) && form.round_robin_pool.length > 0) {
        const pool = form.round_robin_pool;
        assignee = pool[rrCounter % pool.length];
        rrCounter += 1;
      } else if (!assignee) {
        const pool = await getActiveEmployees();
        if (pool.length > 0) {
          assignee = pool[rrCounter % pool.length];
          rrCounter += 1;
        }
      }

      const leads = new ItemsService("leads", { schema: "public", accountability: null });
      const nowIso = new Date().toISOString();

      const createdLead = await leads.createOne({
        status: "novo",
        source: form.source_label || "Web Form",
        source_event_id: `form:${slug}:${nowIso}`,
        display_name: picked.display_name || (data && data.name) || "Lead Web",
        email: picked.email,
        phone: picked.phone,
        nif: picked.nif,
        lead_data: {
          form_id: form.id,
          form_slug: slug,
          form_name: form.name,
          submitted_fields: data,
          referer: (req.headers && (req.headers.referer || req.headers.referrer)) || null,
          user_agent: (req.headers && req.headers["user-agent"]) || null,
          ip: (req.headers && req.headers["x-forwarded-for"]) || (req.socket && req.socket.remoteAddress) || null,
          submitted_at: nowIso,
        },
        claimed_by: assignee || undefined,
        first_attempt_at: nowIso,
        last_attempt_at: nowIso,
        attempt_count: 1,
      });

      const leadId = (createdLead && createdLead.id) || null;

      try {
        const current = Number(form.submit_count || 0);
        await forms.updateOne(form.id, { submit_count: current + 1, last_submitted_at: nowIso });
      } catch (e) {
        try { if (logger && logger.warn) logger.warn("[lead-capture] submit_count update failed: " + (e && e.message || e)); } catch (_e) {}
      }

      try {
        const interactions = new ItemsService("interactions", { schema: "public", accountability: null });
        await interactions.createOne({
          type: "form_submit",
          direction: "inbound",
          status: "received",
          source: form.source_label,
          external_id: String(leadId || ""),
          occurred_at: nowIso,
          phone: picked.phone,
          email: picked.email,
          display_name: picked.display_name,
          lead_id: leadId,
          summary: "Submissao via form: " + form.name,
          payload: { form_slug: slug, fields: data },
        });
      } catch (e) {
        try { if (logger && logger.warn) logger.warn("[lead-capture] interaction create failed: " + (e && e.message || e)); } catch (_e) {}
      }

      void triggerWebhook(form.webhook_url, {
        event: "lead_capture.submitted",
        lead_id: leadId,
        form: { id: form.id, slug: slug, name: form.name },
        data,
        assigned_to: assignee,
      });

      res.json({
        ok: true,
        lead_id: leadId,
        assigned_to: assignee,
        redirect_url: form.redirect_url || null,
        success_message: form.success_message || "Obrigado!",
      });
    } catch (err) {
      try { if (logger && logger.warn) logger.warn("[lead-capture] error: " + (err && err.message || err)); } catch (_e) {}
      const status = (err && err.status) || 400;
      res.status(status).json({ ok: false, error: (err && err.message) || "Falha ao processar submissao" });
    }
  });
};
