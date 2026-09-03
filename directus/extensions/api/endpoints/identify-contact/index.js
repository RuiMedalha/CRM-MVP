/**
 * Directus Endpoint Extension: /identify-contact
 *
 * Purpose:
 * - Central contact identification for n8n and other automations
 * - Avoids duplicating JS logic in n8n workflow Code nodes
 * - Same logic as src/services/contactIdentification.ts (frontend)
 *
 * Request:
 *   POST /identify-contact
 *   Body: { phone?: string, email?: string }
 *
 * Response:
 *   {
 *     kind: "contact" | "lead" | "unknown",
 *     record: object | null,
 *     matchedBy: "phone" | "mobile_phone" | "whatsapp_number" | "email" | null,
 *     interactionCount: number,
 *     openDeals: number,
 *     lastActivity: string | null,
 *     alsoLeadId: number | null
 *   }
 *
 * Auth: uses Directus standard auth (session token or static token).
 */

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.slice(-9);
}

export default (router, { services, getSchema }) => {
  const { ItemsService } = services;

  router.post("/", async (req, res) => {
    if (!req.accountability?.user) {
      return res.status(401).json({ error: "Autenticação necessária" });
    }
    const { phone, email } = req.body || {};
    if (!phone && !email) {
      return res.status(400).json({ error: "phone ou email obrigatório" });
    }

    const schema = await getSchema();
    const accountability = req.accountability || { admin: true };

    const contactsService = new ItemsService("contacts", { schema, accountability });
    const leadsService = new ItemsService("leads", { schema, accountability });
    const interactionsService = new ItemsService("interactions", { schema, accountability });
    const dealsService = new ItemsService("deals", { schema, accountability });

    const phoneTail = phone ? normalizePhone(phone) : "";
    const isValidPhone = phoneTail.length >= 9;

    // ─── Search contacts by phone ─────────────────────────────────────
    if (isValidPhone) {
      for (const field of ["phone", "mobile_phone", "whatsapp_number", "contact_phone"]) {
        try {
          const results = await contactsService.readByQuery({
            filter: {
              [field]: { _ends_with: phoneTail },
              entity_status: { _neq: "archived" },
            },
            limit: 1,
          });
          if (results.length) {
            const contact = results[0];
            const enrichment = await getEnrichment(contact.id, interactionsService, dealsService);
            const leadId = await findLeadByPhone(phoneTail, leadsService);
            return res.json({
              kind: "contact",
              record: contact,
              matchedBy: field,
              ...enrichment,
              alsoLeadId: leadId || null,
            });
          }
        } catch { /* continue */ }
      }
    }

    // ─── Search contacts by email (testa todos os campos de email) ─────────────────────────────────────
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      for (const field of ["email", "contact_email", "email_compras", "email_comercial", "email_encomendas", "email_assistencia", "email_pos_venda", "email_imap", "email_financeiro", "email_marketing_permitido"]) {
        try {
          const results = await contactsService.readByQuery({
            filter: {
              [field]: { _eq: normalizedEmail },
              entity_status: { _neq: "archived" },
            },
            limit: 1,
          });
          if (results.length) {
            const contact = results[0];
            const enrichment = await getEnrichment(contact.id, interactionsService, dealsService);
            const leadId = await findLeadByEmail(normalizedEmail, leadsService);
            return res.json({
              kind: "contact",
              record: contact,
              matchedBy: field,
              ...enrichment,
              alsoLeadId: leadId || null,
            });
          }
        } catch { /* continue */ }
      }
    }

    // ─── Search leads by phone ─────────────────────────────────────────
    if (isValidPhone) {
      for (const field of ["phone", "whatsapp_number", "contact_phone"]) {
        try {
          const results = await leadsService.readByQuery({
            filter: {
              [field]: { _ends_with: phoneTail },
              status: { _neq: "discarded" },
            },
            limit: 1,
          });
          if (results.length) {
            return res.json({
              kind: "lead",
              record: results[0],
              matchedBy: field === "contact_phone" ? "phone" : field,
              interactionCount: 0,
              openDeals: 0,
              lastActivity: results[0].last_attempt_at || null,
              alsoLeadId: null,
            });
          }
        } catch { /* continue */ }
      }
    }

    // ─── Search leads by email ─────────────────────────────────────────
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      for (const field of ["email", "contact_email", "email_compras", "email_comercial", "email_encomendas"]) {
        try {
          const results = await leadsService.readByQuery({
            filter: {
              [field]: { _eq: normalizedEmail },
              status: { _neq: "discarded" },
            },
            limit: 1,
          });
          if (results.length) {
            return res.json({
              kind: "lead",
              record: results[0],
              matchedBy: "email",
              interactionCount: 0,
              openDeals: 0,
              lastActivity: results[0].last_attempt_at || null,
              alsoLeadId: null,
            });
          }
        } catch { /* continue */ }
      }
    }

    // ─── Unknown ───────────────────────────────────────────────────────
    return res.json({
      kind: "unknown",
      record: null,
      matchedBy: null,
      interactionCount: 0,
      openDeals: 0,
      lastActivity: null,
      alsoLeadId: null,
    });
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getEnrichment(contactId, interactionsService, dealsService) {
  let interactionCount = 0;
  let openDeals = 0;
  let lastActivity = null;

  try {
    const interactions = await interactionsService.readByQuery({
      filter: { contact_id: { _eq: contactId } },
      aggregate: { count: ["id"] },
    });
    interactionCount = Number(interactions[0]?.count?.id || 0);
  } catch { /* ok */ }

  try {
    const deals = await dealsService.readByQuery({
      filter: {
        customer_id: { _eq: contactId },
        status: { _nin: ["ganho", "perdido"] },
      },
      aggregate: { count: ["id"] },
    });
    openDeals = Number(deals[0]?.count?.id || 0);
  } catch { /* ok */ }

  try {
    const lastInt = await interactionsService.readByQuery({
      filter: { contact_id: { _eq: contactId } },
      sort: ["-date_created"],
      limit: 1,
      fields: ["date_created"],
    });
    lastActivity = lastInt[0]?.date_created || null;
  } catch { /* ok */ }

  return { interactionCount, openDeals, lastActivity };
}

async function findLeadByPhone(phoneTail, leadsService) {
  try {
    const results = await leadsService.readByQuery({
      filter: {
        phone: { _ends_with: phoneTail },
        status: { _neq: "discarded" },
      },
      limit: 1,
      fields: ["id"],
    });
    return results[0]?.id || null;
  } catch {
    return null;
  }
}

async function findLeadByEmail(email, leadsService) {
  try {
    const results = await leadsService.readByQuery({
      filter: {
        email: { _eq: email },
        status: { _neq: "discarded" },
      },
      limit: 1,
      fields: ["id"],
    });
    return results[0]?.id || null;
  } catch {
    return null;
  }
}
