import assert from "node:assert";

// Simulation of Evolution Adapter Normalizer
function cleanPhoneNumber(phone) {
  let cleaned = String(phone || "").replace(/\D/g, "");
  if (cleaned.length === 9 && cleaned.startsWith("9")) {
    cleaned = `351${cleaned}`;
  }
  return cleaned;
}

function normalizeEvolutionIncoming(payload, instance) {
  if (!payload) return [];
  const messages = [];
  const data = payload.data || payload;
  const rawList = Array.isArray(data) ? data : [data];

  for (const item of rawList) {
    if (!item) continue;
    const key = item.key || {};
    const msg = item.message || {};
    const pushName = item.pushName || item.senderName || "";
    const remoteJid = key.remoteJid || item.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");
    const participant = key.participant || item.participant || "";

    const rawSender = isGroup ? participant : remoteJid;
    const fromNumber = cleanPhoneNumber(rawSender.split("@")[0] || "");

    let body = "";
    let mediaType = undefined;

    if (msg.conversation) {
      body = msg.conversation;
    } else if (msg.extendedTextMessage) {
      body = msg.extendedTextMessage.text || "";
    } else if (msg.imageMessage) {
      body = msg.imageMessage.caption || "[Imagem]";
      mediaType = "image";
    } else if (msg.audioMessage) {
      body = "[Áudio]";
      mediaType = "audio";
    }

    const whatsappId = key.id || item.id || `wamid_evo_${Date.now()}`;
    const timestampSeconds = item.messageTimestamp || item.timestamp || Math.floor(Date.now() / 1000);
    const timestamp = new Date(timestampSeconds < 10000000000 ? timestampSeconds * 1000 : timestampSeconds);

    messages.push({
      whatsappId,
      instanceId: instance?.id,
      provider: "evolution",
      from: fromNumber || "Desconhecido",
      to: instance?.phone_number || "",
      body: body || "[Sem texto]",
      direction: "inbound",
      mediaType,
      timestamp,
      senderName: pushName,
      isGroup,
    });
  }
  return messages;
}

// Simulation of Meta Cloud Adapter Normalizer
function normalizeMetaIncoming(payload, instance) {
  if (!payload) return [];
  const messages = [];
  const entries = payload.entry || [payload];

  for (const entry of entries) {
    const changes = entry.changes || [entry];
    for (const change of changes) {
      const value = change.value || change;
      const rawMessages = value.messages || [];
      const contacts = value.contacts || [];

      const contactMap = new Map();
      for (const c of contacts) {
        if (c.wa_id && c.profile?.name) {
          contactMap.set(c.wa_id, c.profile.name);
        }
      }

      for (const item of rawMessages) {
        const fromNumber = cleanPhoneNumber(item.from || "");
        const senderName = contactMap.get(item.from) || item.from;
        const whatsappId = item.id || `wamid_${Date.now()}`;
        const timestampSeconds = parseInt(item.timestamp, 10) || Math.floor(Date.now() / 1000);
        const timestamp = new Date(timestampSeconds * 1000);

        let body = "";
        let mediaType = undefined;

        if (item.type === "text" && item.text) {
          body = item.text.body || "";
        } else if (item.type === "image" && item.image) {
          body = item.image.caption || "[Imagem Meta]";
          mediaType = "image";
        } else if (item.type === "audio" && item.audio) {
          body = "[Áudio]";
          mediaType = "audio";
        }

        messages.push({
          whatsappId,
          instanceId: instance?.id,
          provider: "meta",
          from: fromNumber || "Desconhecido",
          to: instance?.phone_number || value.metadata?.display_phone_number || "",
          body: body || "[Sem conteúdo]",
          direction: "inbound",
          mediaType,
          timestamp,
          senderName,
          isGroup: false,
        });
      }
    }
  }
  return messages;
}

console.log("🧪 Iniciando Testes Unitários de Normalização WhatsApp Dual...");

// 1. Teste Evolution Texto
const evoTextPayload = {
  event: "messages.upsert",
  data: {
    key: {
      remoteJid: "351912345678@s.whatsapp.net",
      fromMe: false,
      id: "EVO_MSG_12345",
    },
    pushName: "João Silva",
    message: {
      conversation: "Olá, gostaria de saber o preço de uma máquina de café.",
    },
    messageTimestamp: 1788396000,
  },
};

const evoNormalized = normalizeEvolutionIncoming(evoTextPayload, { id: "inst-evo-918", phone_number: "+351918000000" });
assert.strictEqual(evoNormalized.length, 1);
assert.strictEqual(evoNormalized[0].whatsappId, "EVO_MSG_12345");
assert.strictEqual(evoNormalized[0].from, "351912345678");
assert.strictEqual(evoNormalized[0].senderName, "João Silva");
assert.strictEqual(evoNormalized[0].body, "Olá, gostaria de saber o preço de uma máquina de café.");
assert.strictEqual(evoNormalized[0].provider, "evolution");
assert.strictEqual(evoNormalized[0].direction, "inbound");
console.log("  ✓ Teste 1: Normalização Evolution (Texto) passou com sucesso.");

// 2. Teste Evolution Imagem com legenda
const evoImagePayload = {
  data: {
    key: {
      remoteJid: "351916999888@s.whatsapp.net",
      fromMe: false,
      id: "EVO_IMG_67890",
    },
    pushName: "Maria Santos",
    message: {
      imageMessage: {
        caption: "Fotografia do equipamento para assistência",
        mimetype: "image/jpeg",
        url: "https://mmg.whatsapp.net/v/t62.7118-24/...",
      },
    },
    messageTimestamp: 1788396100,
  },
};

const evoImgNormalized = normalizeEvolutionIncoming(evoImagePayload);
assert.strictEqual(evoImgNormalized.length, 1);
assert.strictEqual(evoImgNormalized[0].mediaType, "image");
assert.strictEqual(evoImgNormalized[0].body, "Fotografia do equipamento para assistência");
console.log("  ✓ Teste 2: Normalização Evolution (Imagem + Caption) passou com sucesso.");

// 3. Teste Meta Cloud API WABA v18.0
const metaPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "109384920492819",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "351913866565",
              phone_number_id: "943101945557713",
            },
            contacts: [
              {
                profile: { name: "Carlos Oliveira Hotelaria" },
                wa_id: "351939887766",
              },
            ],
            messages: [
              {
                from: "351939887766",
                id: "wamid.HBgNMzUxOTM5ODg3NzY2FQIAEhgg...",
                timestamp: "1788396200",
                text: {
                  body: "Precisamos de um orçamento urgente para 2 fornos combinados.",
                },
                type: "text",
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

const metaNormalized = normalizeMetaIncoming(metaPayload, { id: "inst-meta-913", phone_number: "+351913866565" });
assert.strictEqual(metaNormalized.length, 1);
assert.strictEqual(metaNormalized[0].whatsappId, "wamid.HBgNMzUxOTM5ODg3NzY2FQIAEhgg...");
assert.strictEqual(metaNormalized[0].from, "351939887766");
assert.strictEqual(metaNormalized[0].senderName, "Carlos Oliveira Hotelaria");
assert.strictEqual(metaNormalized[0].body, "Precisamos de um orçamento urgente para 2 fornos combinados.");
assert.strictEqual(metaNormalized[0].provider, "meta");
assert.strictEqual(metaNormalized[0].direction, "inbound");
console.log("  ✓ Teste 3: Normalização Meta Cloud API WABA v18.0 passou com sucesso.");

console.log("\n🎉 Todos os testes de normalização passaram a 100%!");
