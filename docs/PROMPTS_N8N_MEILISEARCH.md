# Prompts para configuração n8n + Meilisearch

## Ponto 8 — Delivery Receipts WhatsApp (n8n)

### Objectivo
Receber webhooks de delivery status do Evolution API (acks: sent → delivered → read) e persistir no Directus.

### Prompt para n8n:

```
Criar workflow n8n que:

1. TRIGGER: Webhook POST em /webhook/wa-delivery-status
   - Recebe payload do Evolution API com:
     - event: "messages.update" 
     - data.key.id (message ID do provider)
     - data.update.status ("DELIVERY_ACK" | "READ" | "PLAYED")
     - data.instance (nome da instância: hotelequip-918, hotelequip-916)

2. LÓGICA:
   - Mapear status do Evolution para estados canónicos:
     - DELIVERY_ACK → "delivered"
     - READ → "read" 
     - PLAYED → "read" (áudio)
   - Encontrar a mensagem no Directus:
     - GET /items/messages?filter[external_message_id][_eq]={{data.key.id}}&limit=1
   - Se encontrada, PATCH:
     - delivery_status: estado mapeado
     - delivered_at / read_at: timestamp actual (conforme estado)

3. SEGURANÇA:
   - Validar header X-Signature (HMAC SHA256 com shared secret)
   - Rejeitar se assinatura inválida

4. CONFIGURAÇÃO Evolution:
   - Em cada instância (hotelequip-918, hotelequip-916), configurar:
     - Webhook URL: https://n8n.hotelequip.pt/webhook/wa-delivery-status
     - Events: messages.update
     - Webhook by events: true

Campos a adicionar no Directus (colecção messages):
- delivered_at: timestamp, nullable
- read_at: timestamp, nullable

(O campo delivery_status já existe: pending/sent/delivered/read/failed)
```

---

## Ponto 9 — Pesquisa Server-Side Global (Meilisearch)

### Objectivo
Indexar emails e conversas no Meilisearch para pesquisa full-text global.

### Prompt para n8n:

```
Criar 2 workflows n8n para indexação:

=== WORKFLOW 1: Indexar Email Threads ===

TRIGGER: Schedule (a cada 5 min) OU Directus Hook (items.create em email_threads)

LÓGICA:
1. GET /items/email_threads?sort=-date_created&limit=50&fields=id,subject,from_address,to_address,mailbox,category,status,ai_summary,date_created,contact_id
2. Para cada thread, GET /items/email_messages?filter[thread_id][_eq]={{id}}&fields=body_text&limit=3
3. Construir documento Meilisearch:
   {
     id: "email_{{thread.id}}",
     title: thread.subject,
     body: concatenar body_text das mensagens (max 2000 chars),
     from: thread.from_address,
     to: thread.to_address,
     category: thread.category,
     status: thread.status,
     summary: thread.ai_summary,
     mailbox: thread.mailbox,
     contact_id: thread.contact_id,
     type: "email",
     created_at: thread.date_created
   }
4. POST para Meilisearch: https://search.palamenta.com.pt/indexes/crm_global/documents
   - Header: Authorization: Bearer {{MEILISEARCH_ADMIN_KEY}}

=== WORKFLOW 2: Indexar Conversas WhatsApp ===

TRIGGER: Schedule (a cada 5 min) OU Directus Hook (items.create em messages)

LÓGICA:
1. GET /items/conversations?sort=-updated_at&limit=50&fields=id,customer_name,channel,source,instance_name,contact_id,last_message,updated_at
2. Para cada conversa, GET /items/messages?filter[conversation_id][_eq]={{id}}&sort=-created_at&limit=10&fields=content,sender_type,created_at
3. Construir documento Meilisearch:
   {
     id: "conv_{{conversation.id}}",
     title: conversation.customer_name,
     body: concatenar content das últimas 10 mensagens,
     channel: conversation.channel,
     instance: conversation.instance_name,
     contact_id: conversation.contact_id,
     type: "conversation",
     created_at: conversation.updated_at
   }
4. POST para Meilisearch: https://search.palamenta.com.pt/indexes/crm_global/documents

=== CONFIGURAÇÃO MEILISEARCH ===

Criar índice:
POST https://search.palamenta.com.pt/indexes
{
  "uid": "crm_global",
  "primaryKey": "id"
}

Configurar searchable attributes:
PATCH https://search.palamenta.com.pt/indexes/crm_global/settings
{
  "searchableAttributes": ["title", "body", "from", "summary"],
  "filterableAttributes": ["type", "category", "channel", "status", "contact_id", "mailbox"],
  "sortableAttributes": ["created_at"]
}

Search key (frontend, read-only): usar a key existente em .env.local
  VITE_MEILISEARCH_SEARCH_KEY=ed7cabcddd7aeeed55e18972f4ec98dccd3c27bf78cb82962d04e1661778011e

Admin key (n8n, write): usar a master key do Meilisearch (já configurada no n8n)
```

---

## Como usar estes prompts

1. Abrir n8n: https://n8n.hotelequip.pt
2. Criar novo workflow
3. Colar o prompt relevante como referência
4. Construir os nodes conforme descrito
5. Activar

Para o Meilisearch, o índice `crm_global` precisa de ser criado primeiro (via curl ou admin UI).
