/**
 * Directus Endpoint Extension: /apply-contact-identification
 *
 * Purpose:
 * - Persists the result of contact identification to a source collection (email_threads, conversations, leads)
 * - Updates contact_id, lead_id, customer_name, needs_review fields
 * - Creates private notes for ambiguous cases
 *
 * Request:
 *   POST /apply-contact-identification
 *   Body: { phone?: string, email?: string, nif?: string, source_collection: string, source_id: string }
 *
 * Response:
 *   {
 *     success: boolean,
 *     result: { contact_id, lead_id, customer_name, needs_review },
 *     message: string,
 *     ambiguous_candidates?: [{ id, name, field }]
 *   }
 *
 * Auth: uses Directus standard auth
 */

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.slice(-9);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export default (router, { services, exceptions, getSchema }) => {
  const { ItemsService } = services;

  router.post("/", async (req, res) => {
    try {
      const { phone, email, nif, source_collection, source_id } = req.body || {};

      if (!source_collection || !source_id) {
        return res.status(400).json({
          success: false,
          message: "source_collection e source_id são obrigatórios",
        });
      }

      const schema = await getSchema();
      const accountability = req.accountability || { admin: true };

      const contactsService = new ItemsService("contacts", { schema, accountability });
      const leadsService = new ItemsService("leads", { schema, accountability });
      const sourceService = new ItemsService(source_collection, { schema, accountability });

      // ─── Search for contact or lead ─────────────────────────────────────
      let identificationResult = null;

      // Try phone
      if (phone) {
        const phoneTail = normalizePhone(phone);
        if (phoneTail.length >= 9) {
          for (const field of ["phone", "mobile_phone", "whatsapp_number", "contact_phone"]) {
            try {
              const results = await contactsService.readByQuery({
                filter: {
                  [field]: { _ends_with: phoneTail },
                  entity_status: { _neq: "archived" },
                },
                limit: 2, // Get 2 to detect ambiguity
              });
              if (results.length === 1) {
                identificationResult = { kind: "contact", record: results[0], matchedBy: field };
                break;
              } else if (results.length > 1) {
                identificationResult = {
                  kind: "ambiguous",
                  candidates: results.map((c) => ({ id: c.id, name: c.company_name || c.contact_name, field })),
                };
                break;
              }
            } catch { /* continue */ }
          }
        }
      }

      // Try email if no result yet
      if (!identificationResult && email) {
        const normalizedEmail = normalizeEmail(email);
        for (const field of [
          "email",
          "contact_email",
          "email_compras",
          "email_comercial",
          "email_encomendas",
          "email_assistencia",
          "email_pos_venda",
          "email_financeiro",
        ]) {
          try {
            const results = await contactsService.readByQuery({
              filter: {
                [field]: { _eq: normalizedEmail },
                entity_status: { _neq: "archived" },
              },
              limit: 2,
            });
            if (results.length === 1) {
              identificationResult = { kind: "contact", record: results[0], matchedBy: field };
              break;
            } else if (results.length > 1) {
              identificationResult = {
                kind: "ambiguous",
                candidates: results.map((c) => ({ id: c.id, name: c.company_name || c.contact_name, field })),
              };
              break;
            }
          } catch { /* continue */ }
        }
      }

      // Try leads if no contact found
      if (!identificationResult && phone) {
        const phoneTail = normalizePhone(phone);
        if (phoneTail.length >= 9) {
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
                identificationResult = { kind: "lead", record: results[0], matchedBy: field };
                break;
              }
            } catch { /* continue */ }
          }
        }
      }

      // Try leads by email
      if (!identificationResult && email) {
        const normalizedEmail = normalizeEmail(email);
        for (const field of ["email", "contact_email"]) {
          try {
            const results = await leadsService.readByQuery({
              filter: {
                [field]: { _eq: normalizedEmail },
                status: { _neq: "discarded" },
              },
              limit: 1,
            });
            if (results.length) {
              identificationResult = { kind: "lead", record: results[0], matchedBy: field };
              break;
            }
          } catch { /* continue */ }
        }
      }

      // ─── Persist result ────────────────────────────────────────────────
      let patch = {};

      if (identificationResult?.kind === "contact") {
        const contact = identificationResult.record;
        patch = {
          contact_id: contact.id,
          lead_id: null,
          needs_review: false,
          customer_name: contact.company_name || contact.contact_name || contact.phone,
        };
      } else if (identificationResult?.kind === "lead") {
        const lead = identificationResult.record;
        patch = {
          contact_id: null,
          lead_id: lead.id,
          needs_review: false,
        };
      } else if (identificationResult?.kind === "ambiguous") {
        patch = {
          contact_id: null,
          lead_id: null,
          needs_review: true,
        };
      } else {
        // No match
        patch = {
          contact_id: null,
          lead_id: null,
          needs_review: false,
        };
      }

      // Update source collection
      if (Object.keys(patch).length > 0 && patch.contact_id !== null) {
        try {
          await sourceService.updateOne(source_id, patch);
        } catch { /* log warning but don't fail */ }
      } else if (patch.needs_review) {
        // Mark as needs_review if ambiguous
        try {
          await sourceService.updateOne(source_id, { needs_review: true, contact_id: null, lead_id: null });
          // Create private note with candidates
          if (identificationResult?.candidates?.length > 0) {
            const candidateList = identificationResult.candidates
              .map((c) => `  • ${c.name || "Unknown"} (${c.field})`)
              .join("\n");
            const noteContent = `[AMBIGUIDADE] 2+ contactos encontrados durante identificação automática:\n${candidateList}\nReview manual requerido.`;
            // Try to create a private note (optional, may not exist)
            try {
              await new ItemsService("conversation_notes", { schema, accountability }).createOne({
                conversation_id: source_collection === "conversations" ? source_id : null,
                content: noteContent,
                type: "private",
                created_by: "system",
              });
            } catch {
              /* note creation failed, that's ok */
            }
          }
        } catch { /* continue */ }
      }

      // ─── Response ──────────────────────────────────────────────────────
      return res.json({
        success: true,
        result: {
          contact_id: patch.contact_id || null,
          lead_id: patch.lead_id || null,
          customer_name: patch.customer_name || null,
          needs_review: patch.needs_review || false,
        },
        kind: identificationResult?.kind || "unknown",
        message: identificationResult?.kind
          ? identificationResult.kind === "contact"
            ? `Contacto identificado: ${identificationResult.record.company_name}`
            : identificationResult.kind === "lead"
              ? `Lead identificada: ${identificationResult.record.display_name}`
              : `Ambiguidade detectada: ${identificationResult.candidates?.length || 0} contactos`
          : "Nenhuma correspondência encontrada",
        ...(identificationResult?.kind === "ambiguous" && {
          ambiguous_candidates: identificationResult.candidates,
        }),
      });
    } catch (err) {
      console.error("[apply-contact-identification] Error:", err);
      return res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : "Erro ao aplicar identificação",
      });
    }
  });
};
