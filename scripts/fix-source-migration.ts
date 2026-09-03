/**
 * Fix: completar migração de source que ficou nos primeiros 100.
 * Pagina até acabar.
 *
 * Uso: DIRECTUS_URL=https://api.hotelequip.pt DIRECTUS_ADMIN_TOKEN=xxx npx tsx scripts/fix-source-migration.ts
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://api.hotelequip.pt";
const TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
if (!TOKEN) { console.error("❌ DIRECTUS_ADMIN_TOKEN required"); process.exit(1); }

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function patchBatch(collection: string, filterField: string, oldValue: string, newValue: string): Promise<number> {
  let total = 0;
  while (true) {
    // Buscar IDs com valor antigo (batch de 100)
    const searchRes = await fetch(
      `${DIRECTUS_URL}/items/${collection}?filter[${filterField}][_eq]=${encodeURIComponent(oldValue)}&limit=100&fields=id`,
      { headers }
    );
    if (!searchRes.ok) throw new Error(`GET ${collection} failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const ids: number[] = (searchData.data ?? []).map((r: any) => r.id);
    if (ids.length === 0) break;

    // PATCH cada um individualmente (batch PATCH com filter não pagina)
    await Promise.all(
      ids.map((id) =>
        fetch(`${DIRECTUS_URL}/items/${collection}/${id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ [filterField]: newValue }),
        }).catch(() => {})
      )
    );
    total += ids.length;
    console.log(`  ${collection}: ${total} migrados (${oldValue} → ${newValue})`);
  }
  return total;
}

async function main() {
  console.log("🚀 Completar migração de source\n");

  console.log("contacts.source: bravo → bravo_legacy");
  const c1 = await patchBatch("contacts", "source", "bravo", "bravo_legacy");
  console.log(`  ✅ ${c1} registos\n`);

  console.log("leads.source: central → telecof");
  const l1 = await patchBatch("leads", "source", "central", "telecof");
  console.log(`  ✅ ${l1} registos\n`);

  console.log("leads.source: email_inbound → email");
  const l2 = await patchBatch("leads", "source", "email_inbound", "email");
  console.log(`  ✅ ${l2} registos\n`);

  console.log("contacts.source: teste/n8n_test_updated/inbox → outro");
  const c2a = await patchBatch("contacts", "source", "teste", "outro");
  const c2b = await patchBatch("contacts", "source", "n8n_test_updated", "outro");
  const c2c = await patchBatch("contacts", "source", "inbox", "outro");
  console.log(`  ✅ ${c2a + c2b + c2c} registos\n`);

  console.log("🏁 Migração completa!");
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
