/**
 * Directus Hook: slaMonitor
 */

export default (router, { services, database, getSchema, logger }) => {
  const { ItemsService, ActivityService, NotificationsService } = services;

  router.post("/sla/check", async (req, res) => {
    try {
      const schema = await getSchema();
      const acc = req.accountability || { admin: true };
      const dealsSvc = new ItemsService("deals", { schema, accountability: acc });
      const stagesSvc = new ItemsService("pipeline_stages", { schema, accountability: acc });
      const brSvc = new ItemsService("sla_breaches", { schema, accountability: acc });
      const actSvc = new ActivityService({ database, schema });
      const notSvc = new NotificationsService({ database, schema });

      const deals = await dealsSvc.readByQuery({
        filter: { status: { _nin: ["ganho", "perdido"] } },
        fields: ["id", "stage_id", "pipeline_id", "date_created", "entered_stage_at", "title"],
        limit: 500,
      });
      if (!deals || !deals.length) return res.json({ ok: true, checked: 0, breaches: 0 });

      const stageIds = [...new Set(deals.map(d => d.stage_id).filter(Boolean))];
      const stages = await stagesSvc.readByQuery({
        filter: { id: { _in: stageIds } }, fields: ["id", "sla_hours", "escalate_to_employee_id"], limit: 500,
      });
      const stageMap = {};
      for (const s of stages || []) stageMap[s.id] = s;

      let breaches = 0;
      for (const deal of deals) {
        const st = stageMap[deal.stage_id];
        if (!st || !st.sla_hours) continue;
        const entered = deal.entered_stage_at || deal.date_created;
        if (!entered) continue;
        const elapsed = (Date.now() - new Date(entered).getTime()) / 3600000;
        if (elapsed < st.sla_hours) continue;
        const existing = await brSvc.readByQuery({ filter: { deal_id: { _eq: deal.id }, stage_id: { _eq: deal.stage_id }, notified: { _eq: false } }, fields: ["id"], limit: 1 });
        if (existing && existing.length > 0) continue;
        await brSvc.createOne({ deal_id: deal.id, stage_id: deal.stage_id, pipeline_id: deal.pipeline_id || null, entered_stage_at: entered, sla_hours: st.sla_hours, escalated_to_employee_id: st.escalate_to_employee_id || null });
        try { await actSvc.createOne({ action: "sla_breach", collection: "deals", item: deal.id, comment: "SLA exceeded for " + deal.title + " (" + st.sla_hours + "h)", user: st.escalate_to_employee_id || null }); } catch(e) { logger.error(e); }
        if (st.escalate_to_employee_id) {
          try { await notSvc.createOne({ recipient: st.escalate_to_employee_id, collection: "deals", item: deal.id, subject: "SLA Excedido", message: "SLA exceeded: " + deal.title }); } catch(e) { logger.error(e); }
        }
        breaches++;
      }
      return res.json({ ok: true, checked: deals.length, breaches });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
};

