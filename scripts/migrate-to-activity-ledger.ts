/**
 * Migração de dados históricos para a tabela activity.
 *
 * Copia registos de:
 *   - interactions → activity
 *   - communication_events → activity
 *   - follow_ups → activity
 *
 * Uso: DIRECTUS_URL=https://api.hotelequip.pt DIRECTUS_ADMIN_TOKEN=xxx npx tsx scripts/migrate-to-activity-ledger.ts
 *
 * Idempotente: usa source_collection + source_id para evitar duplicados.
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://api.hotelequip.pt";
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;

if (!TOKEN) {
  console.error("❌ DIRECTUS_ADMIN_TOKEN env var required");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}

async function getExistingSourceIds(): Promise<Set<string>> {
  const set = new Set<string>();
  let page = 1;
  while (true) {
    const res = await api(`/items/activity?fields=source_collection,source_id&limit=500&page=${page}`);
    const rows = res.data ?? [];
    if (rows.length === 0) break;
    for (const r of rows) {
      if (r.source_collection && r.source_id) {
        set.add(`${r.source_collection}:${r.source_id}`);
      }
    }
    page++;
  }
  return set;
}

async function migrateInteractions(existing: Set<string>) {
  console.log("\n📋 Migrating interactions...");
  let page = 1;
  let total = 0;
  while (true) {
    const res = await api(`/items/interactions?limit=100&page=${page}&sort=-date_created&fields=id,type,direction,status,source,occurred_at,summary,contact_id,lead_id,date_created`);
    const rows = res.data ?? [];
    if (rows.length === 0) break;

    const batch = rows
      .filter((r: any) => !existing.has(`interactions:${r.id}`))
      .map((r: any) => ({
        type: r.type || "note",
        channel: r.source || "crm",
        direction: r.direction || null,
        status: r.status || null,
        summary: r.summary || null,
        occurred_at: r.occurred_at || r.date_created || null,
        contact_id: r.contact_id || null,
        lead_id: r.lead_id || null,
        source_collection: "interactions",
        source_id: String(r.id),
      }));

    if (batch.length > 0) {
      await api("/items/activity", { method: "POST", body: JSON.stringify(batch) });
      total += batch.length;
      console.log(`  ✓ page ${page}: ${batch.length} migrados (${total} total)`);
    }
    page++;
  }
  console.log(`  ✅ interactions: ${total} registos migrados`);
}

async function migrateCommunicationEvents(existing: Set<string>) {
  console.log("\n📋 Migrating communication_events...");
  let page = 1;
  let total = 0;
  while (true) {
    const res = await api(`/items/communication_events?limit=100&page=${page}&sort=-created_at&fields=id,channel,event_type,direction,status,phone,short_message,contact_int_id,conversation_id,started_at,created_at,raw_payload`);
    const rows = res.data ?? [];
    if (rows.length === 0) break;

    const batch = rows
      .filter((r: any) => !existing.has(`communication_events:${r.id}`))
      .map((r: any) => ({
        type: r.event_type || "call",
        channel: r.channel || "telecof",
        direction: r.direction || null,
        status: r.status || null,
        summary: r.short_message || r.phone || null,
        occurred_at: r.started_at || r.created_at || null,
        contact_id: r.contact_int_id || null,
        conversation_id: r.conversation_id || null,
        source_collection: "communication_events",
        source_id: String(r.id),
        payload: r.raw_payload || null,
      }));

    if (batch.length > 0) {
      await api("/items/activity", { method: "POST", body: JSON.stringify(batch) });
      total += batch.length;
      console.log(`  ✓ page ${page}: ${batch.length} migrados (${total} total)`);
    }
    page++;
  }
  console.log(`  ✅ communication_events: ${total} registos migrados`);
}

async function migrateFollowUps(existing: Set<string>) {
  console.log("\n📋 Migrating follow_ups...");
  let page = 1;
  let total = 0;
  while (true) {
    const res = await api(`/items/follow_ups?limit=100&page=${page}&sort=-date_created&fields=id,type,status,title,notes,due_at,contact_id,deal_id,quotation_id,date_created`);
    const rows = res.data ?? [];
    if (rows.length === 0) break;

    const batch = rows
      .filter((r: any) => !existing.has(`follow_ups:${r.id}`))
      .map((r: any) => ({
        type: r.type || "task",
        channel: "crm",
        status: r.status || "open",
        summary: r.title || r.notes || null,
        occurred_at: r.due_at || r.date_created || null,
        contact_id: r.contact_id || null,
        deal_id: r.deal_id || null,
        quotation_id: r.quotation_id || null,
        source_collection: "follow_ups",
        source_id: String(r.id),
      }));

    if (batch.length > 0) {
      await api("/items/activity", { method: "POST", body: JSON.stringify(batch) });
      total += batch.length;
      console.log(`  ✓ page ${page}: ${batch.length} migrados (${total} total)`);
    }
    page++;
  }
  console.log(`  ✅ follow_ups: ${total} registos migrados`);
}

async function main() {
  console.log("🚀 Migração para Activity Ledger");
  console.log(`   Directus: ${DIRECTUS_URL}`);
  console.log("   Carregando registos existentes...");

  const existing = await getExistingSourceIds();
  console.log(`   ${existing.size} registos já existem no activity ledger.`);

  await migrateInteractions(existing);
  await migrateCommunicationEvents(existing);
  await migrateFollowUps(existing);

  console.log("\n🏁 Migração concluída!");
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
