/**
 * Setup Quotation Schema — Directus v11
 * 
 * Adiciona campos e coleções necessários para o módulo de propostas.
 * Idempotente: verifica se campo/coleção já existe antes de criar.
 * 
 * Uso: npx tsx scripts/setup-quotation-schema.ts
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://api.hotelequip.pt";
const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error("❌ DIRECTUS_ADMIN_TOKEN env var is required. Set it before running this script.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${ADMIN_TOKEN}`,
  "Content-Type": "application/json",
};

async function apiRequest(path: string, options?: RequestInit) {
  const url = `${DIRECTUS_URL}${path}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Field already exists = not an error
    if (res.status === 400 && text.includes("already exists")) {
      return null;
    }
    throw new Error(`${options?.method || "GET"} ${path} → ${res.status}: ${text}`);
  }
  return res.json().catch(() => null);
}

async function fieldExists(collection: string, field: string): Promise<boolean> {
  try {
    const res = await fetch(`${DIRECTUS_URL}/fields/${collection}/${field}`, { headers });
    return res.ok;
  } catch {
    return false;
  }
}

async function collectionExists(collection: string): Promise<boolean> {
  try {
    const res = await fetch(`${DIRECTUS_URL}/collections/${collection}`, { headers });
    return res.ok;
  } catch {
    return false;
  }
}

async function createField(collection: string, field: string, type: string, schema: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
  if (await fieldExists(collection, field)) {
    console.log(`  ✓ ${collection}.${field} (já existe)`);
    return;
  }

  await apiRequest(`/fields/${collection}`, {
    method: "POST",
    body: JSON.stringify({
      field,
      type,
      schema: { is_nullable: true, ...schema },
      meta: { hidden: false, ...meta },
    }),
  });
  console.log(`  + ${collection}.${field} (${type})`);
}

async function createCollection(collection: string, fields: Array<{ field: string; type: string; schema?: Record<string, unknown>; meta?: Record<string, unknown> }>) {
  if (await collectionExists(collection)) {
    console.log(`  ✓ Coleção ${collection} (já existe)`);
    return;
  }

  await apiRequest("/collections", {
    method: "POST",
    body: JSON.stringify({
      collection,
      schema: {},
      meta: { icon: "description", note: "Módulo de propostas" },
      fields: [
        { field: "id", type: "integer", schema: { is_primary_key: true, has_auto_increment: true }, meta: { hidden: true, readonly: true } },
        ...fields,
      ],
    }),
  });
  console.log(`  + Coleção ${collection} criada`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 Setup Quotation Schema`);
  console.log(`   URL: ${DIRECTUS_URL}\n`);

  // ─── Novos campos em quotations ──────────────────────────────────────────
  console.log("📦 quotations — novos campos:");

  await createField("quotations", "public_token", "string", { is_unique: true });
  await createField("quotations", "phone_gate_enabled", "boolean", { default_value: true });
  await createField("quotations", "viewed_at", "timestamp");
  await createField("quotations", "view_count", "integer", { default_value: 0 });
  await createField("quotations", "last_viewed_at", "timestamp");
  await createField("quotations", "unique_visitors", "integer", { default_value: 0 });
  await createField("quotations", "avg_duration_seconds", "integer");
  await createField("quotations", "approved_at", "timestamp");
  await createField("quotations", "rejected_at", "timestamp");
  await createField("quotations", "rejection_reason", "text");
  await createField("quotations", "approval_signature", "string");
  await createField("quotations", "moloni_document_id", "string");
  await createField("quotations", "notification_sent", "boolean", { default_value: false });
  await createField("quotations", "theme", "string", { default_value: "system" });
  await createField("quotations", "language", "string", { default_value: "pt" });
  await createField("quotations", "customer_timezone", "string");
  await createField("quotations", "customer_name", "string");
  await createField("quotations", "customer_company", "string");
  await createField("quotations", "treatment", "string");
  await createField("quotations", "welcome_message", "text");
  await createField("quotations", "voice_message_url", "string");
  await createField("quotations", "video_url", "string");
  await createField("quotations", "next_steps", "json");
  await createField("quotations", "urgency_discount_pct", "decimal", { numeric_precision: 5, numeric_scale: 2 });
  await createField("quotations", "urgency_hours", "integer");
  await createField("quotations", "urgency_expires_at", "timestamp");
  await createField("quotations", "deposit_type", "string", { default_value: "partial" });
  await createField("quotations", "deposit_percent", "integer", { default_value: 50 });
  await createField("quotations", "persuasion_score", "integer");
  await createField("quotations", "template_id", "integer");
  await createField("quotations", "sent_to_phone", "string");
  await createField("quotations", "follow_up_1_sent_at", "timestamp");
  await createField("quotations", "follow_up_2_sent_at", "timestamp");
  await createField("quotations", "follow_up_3_sent_at", "timestamp");
  await createField("quotations", "pdf_file_url", "string");
  await createField("quotations", "proposal_description", "text");
  await createField("quotations", "comparison_recommendation_text", "text");

  // ─── Novos campos em quotation_items ─────────────────────────────────────
  console.log("\n📦 quotation_items — novos campos:");

  await createField("quotation_items", "item_type", "string", { default_value: "product" });
  await createField("quotation_items", "datasheet_url", "string");
  await createField("quotation_items", "datasheet_label", "string");
  await createField("quotation_items", "images", "json");
  await createField("quotation_items", "ai_description", "text");
  await createField("quotation_items", "comparison_group", "string");
  await createField("quotation_items", "is_recommended", "boolean", { default_value: false });
  await createField("quotation_items", "comparison_specs", "json");

  // ─── Nova coleção: quotation_reviews ─────────────────────────────────────
  console.log("\n📦 quotation_reviews:");

  await createCollection("quotation_reviews", [
    { field: "quotation_id", type: "integer", meta: { interface: "select-dropdown-m2o" } },
    { field: "reviewer_name", type: "string" },
    { field: "rating", type: "integer" },
    { field: "review_text", type: "text" },
    { field: "source", type: "string", schema: { default_value: "manual" } },
    { field: "date_created", type: "timestamp", meta: { special: ["date-created"] } },
  ]);

  // ─── Nova coleção: quotation_templates ───────────────────────────────────
  console.log("\n📦 quotation_templates:");

  await createCollection("quotation_templates", [
    { field: "name", type: "string" },
    { field: "description", type: "text" },
    { field: "data", type: "json" },
    { field: "date_created", type: "timestamp", meta: { special: ["date-created"] } },
    { field: "date_updated", type: "timestamp", meta: { special: ["date-updated"] } },
    { field: "created_by", type: "uuid", meta: { special: ["user-created"] } },
  ]);

  // ─── Nova coleção: quotation_views_log ───────────────────────────────────
  console.log("\n📦 quotation_views_log:");

  await createCollection("quotation_views_log", [
    { field: "quotation_id", type: "integer", meta: { interface: "select-dropdown-m2o" } },
    { field: "viewed_at", type: "timestamp", meta: { special: ["date-created"] } },
    { field: "duration_seconds", type: "integer" },
    { field: "ip_hash", type: "string" },
    { field: "device", type: "string" },
  ]);

  console.log("\n✅ Schema setup completo!\n");
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});
