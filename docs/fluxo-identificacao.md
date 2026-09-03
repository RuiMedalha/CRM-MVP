# Fluxo de Identificação Automática de Contactos

## Versão: 15/07/2026

## Objetivo
Qualquer email ou WhatsApp que entre no CRM fica automaticamente ligado ao contacto certo. Se não encontrar correspondência, é criada uma lead e ligada à thread/conversa. Se ambiguidade, marca `needs_review=true` e regista os candidatos.

## Arquitetura

### Endpoints Directus

#### 1. `POST /identify-contact`
**Status**: ✅ EXPANDIDO (Fase 2 completa)

**Responsabilidade**: Identificação read-only
- Testa **contactos** por:
  - `phone`, `mobile_phone`, `whatsapp_number`, `contact_phone` (últimos 9 dígitos normalizado)
  - `email`, `contact_email`, `email_compras`, `email_comercial`, `email_encomendas`, `email_assistencia`, `email_pos_venda`, `email_financeiro`
- Testa **leads** por:
  - `phone`, `whatsapp_number`, `contact_phone` (normalizado)
  - `email`, `contact_email`, `email_compras`, `email_comercial`, `email_encomendas`
- Devolve: `{kind, record, matchedBy, enrichment}` ou `{kind: "unknown"}`

**Request**:
```bash
POST /identify-contact
Body: { phone?: string, email?: string }
```

**Response**:
```json
{
  "kind": "contact|lead|unknown",
  "record": { contacto/lead completo },
  "matchedBy": "phone|email|contact_phone|email_comercial|...",
  "interactionCount": number,
  "openDeals": number,
  "lastActivity": ISO datetime,
  "alsoLeadId": number|null
}
```

#### 2. `POST /apply-contact-identification`
**Status**: ✅ CRIADO (Fase 3 completa)

**Responsabilidade**: Persistência do resultado
- Recebe: `{email?, phone?, nif?, source_collection, source_id}`
- Chama internamente `POST /identify-contact`
- **Se contacto único**: PATCH source com `contact_id`, `customer_name` (empresa ou nome), `needs_review=false`
- **Se lead**: PATCH source com `lead_id`, `contact_id=null`
- **Se ambiguidade (2+ contactos)**: PATCH source com `needs_review=true`, `contact_id=null`, cria nota privada
- **Se desconhecido**: Não faz nada (lead já criada antes)

**Request**:
```bash
POST /apply-contact-identification
Body: {
  "email": "rui@example.pt",
  "phone": "916542271",
  "nif": "123456789",
  "source_collection": "email_threads|conversations|leads",
  "source_id": "uuid-ou-int"
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "contact_id": uuid|null,
    "lead_id": int|null,
    "customer_name": string|null,
    "needs_review": boolean
  },
  "kind": "contact|lead|ambiguous|unknown",
  "message": "...",
  "ambiguous_candidates": [{ id, name, field }]
}
```

### Fluxo de Email (n8n)
**Status**: ⏳ EM DESENVOLVIMENTO (Fase 4)

**Workflows**:
- `email-crm-v2-geral.json` (mailbox `geral@hotelequip.pt`)
- `email-crm-v2-apoio-cliente.json` (mailbox `apoio.cliente@hotelequip.pt`)

**Flow**:
```
1. [Trigger] A cada minuto
2. Obter token MS Graph
3. Buscar emails novos (isRead=false)
4. Processar cada email
5. Normalizar campos (from, to, body, subject, etc.)
6. [Decision] É email externo?
7. [Decision] Thread já existe?
8. [Classificação] Claude · Classificar (categoria, urgência, IA summary)
9. [IA] Tratar IA + calcular SLA
10. Directus · Criar thread
11. ✨ NEW: Aplicar Identificação (POST /apply-contact-identification)
    - email: from_address
    - phone: contact_phone extraído pela IA
    - source_collection: "email_threads"
    - source_id: ID da thread acabada de criar
12. Directus · Criar mensagem (inbound)
13. PATCH message attachments
14. Marcar como lido no MS Graph
```

**N8n Node a Adicionar** (após "Directus · Criar thread"):
```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.hotelequip.pt/apply-contact-identification",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "Bearer {{ $env.DIRECTUS_N8N_TOKEN }}"
        }
      ]
    },
    "sendBody": true,
    "contentType": "application/json",
    "specifyBody": "json",
    "jsonBody": {
      "email": "{{ $('Tratar IA + calcular SLA').first().json.fromAddress }}",
      "phone": "{{ $('Tratar IA + calcular SLA').first().json.contact_phone }}",
      "nif": "{{ $('Tratar IA + calcular SLA').first().json.nif }}",
      "source_collection": "email_threads",
      "source_id": "{{ $('Directus · Criar thread').first().json.data.id }}"
    }
  },
  "id": "apply-identify",
  "name": "Aplicar Identificação",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [2304, 384],
  "onError": "continueRegularOutput"
}
```

**Connection Changes**:
- "Directus · Criar thread" output → "Aplicar Identificação" (novo node) + "Directus · Criar mensagem (inbound)" (existing)
- "Aplicar Identificação" output → "Marcar como lido (novo)"

### Fluxo de WhatsApp (n8n) — NOVO
**Status**: ⏳ NÃO INICIADO (Fase 5)

**Workflow**: `wa-inbound-to-directus.json` (novo)

**Trigger**: Webhook em `POST /webhook/wa-inbound`

**Event Payload** (Evolution API `MESSAGES_UPSERT`):
```json
{
  "sender": "351916542271@s.whatsapp.net|351913866565:351916542271",
  "message": "Olá, qual é a disponibilidade?",
  "id": "wamid.123...",
  "timestamp": 1721078400
}
```

**Flow**:
```
1. [Webhook] POST /webhook/wa-inbound (recebe evento Evolution/Meta)
2. [Code] Extrair telefone do sender (JID ou Meta ID)
3. [HTTP] Upsert conversa: GET /items/conversations?filter[source][_eq]=<sender_jid>
   - Se não existe: POST /items/conversations
     body: { source, customer_name: phone, channel: whatsapp, status: open, ... }
   - Se existe: skip
4. [HTTP] POST /items/messages
   body: { conversation_id, sender_type: customer, content, external_message_id, ... }
5. [HTTP] Aplicar Identificação
   body: { phone, source_collection: "conversations", source_id: conversation_id }
6. [HTTP] Se identificada: PATCH /items/conversations/<id>
   body: { customer_name, contact_id, updated_at }
```

**N8n Webhook Config**:
- URL: `https://n8n.hotelequip.pt/webhook/wa-inbound`
- Active: true
- Method: POST

**Evolution Config** (externo, no evolutionapp.profihotel.pt):
```
Instância 916 (hotelequip-916): webhook para MESSAGES_UPSERT → POST https://n8n.hotelequip.pt/webhook/wa-inbound
Instância 918 (hotelequip-918): idem
Instância 913 (Meta Cloud API): webhook para incoming messages → POST https://n8n.hotelequip.pt/webhook/wa-inbound
```

### Schema Directus — NOVO CAMPOS
**Status**: ✅ CRIADO (Fase 1 completa)

Campos adicionados via `POST /fields` (15/07/2026):

1. **email_threads**:
   - `lead_id` (INT, nullable, FK leads.id)
   - `needs_review` (BOOLEAN, default false)

2. **conversations**:
   - `lead_id` (INT, nullable, FK leads.id)
   - `needs_review` (BOOLEAN, default false)

3. **follow_ups**:
   - `lead_id` (INT, nullable, FK leads.id)

**Campos já existentes** (verificado):
- **contacts**: `contact_phone`, `email_compras`, `email_comercial`, `email_encomendas`, `contact_email` ✅
- **leads**: `contact_phone`, `contact_email`, `whatsapp_number` ✅

### UI Changes — MÍNIMO (Fases 7-8)
**Status**: ⏳ NÃO INICIADO

**Fase 7 (Leads Timeline)**:
- `src/pages/Leads.tsx`: Adicionar coluna "Última atividade"
- Modal "Ver detalhes" mostra:
  - Threads ligadas (email_threads.lead_id)
  - Conversas ligadas (conversations.lead_id)
  - Follow-ups (follow_ups.lead_id)
  - Itens pedidos (lead_data.requested_items)

**Fase 8 (Customer360)**:
- `src/hooks/useCustomer360.ts`: Adicionar fetch de conversations com contact_id
- Mostrar no timeline junto com email_threads

## Backfill Histórico — SCRIPT
**Status**: ⏳ NÃO INICIADO (Fase 6)

**Procedimento**:
```bash
# 1. Backup
curl -s -H "Auth: Bearer TOKEN" \
  'https://api.hotelequip.pt/items/email_threads?filter[contact_id][_null]=true&filter[lead_id][_null]=true&limit=1000' \
  > docs/backups/email-threads-prebackfill-2026-07-15.json

curl -s -H "Auth: Bearer TOKEN" \
  'https://api.hotelequip.pt/items/conversations?filter[contact_id][_null]=true&filter[lead_id][_null]=true&limit=1000' \
  > docs/backups/conversations-prebackfill-2026-07-15.json

# 2. Para cada thread:
POST /apply-contact-identification
{ email: from_address, source_collection: "email_threads", source_id: id }

# 3. Para cada conversa:
POST /apply-contact-identification
{ phone: source normalizado, source_collection: "conversations", source_id: id }

# 4. Relatório A1-A3:
- % threads com contact_id/lead_id antes vs depois
- % conversas com contact_id/lead_id antes vs depois
- Amostra de 5 ligações corretas
```

## Testes Reais

### T1: Contacto [TESTE]
```bash
POST https://api.hotelequip.pt/items/contacts
{ company_name: "[TESTE] Hotelequip", email: "ruimedalha@hotelequip.pt", whatsapp_number: "916542271" }
```

### T2: Email [TESTE]
Enviar email DE ruimedalha@hotelequip.pt PARA geral@hotelequip.pt
→ Verificar: thread criada com `contact_id` preenchido e `customer_name = "[TESTE] Hotelequip"`

### T3: WhatsApp [TESTE]
Enviar WhatsApp PARA 916542271 via Evolution
→ Verificar: conversa criada com `contact_id` preenchido e `customer_name` atualizado

### T4: Ficha 360
Abrir `/customer360-shell/<contactId>`
→ Verificar: timeline mostra email e conversa ligados

### T5: Lead com Email
Criar lead [TESTE], enviar email de lead.teste@exemplo.pt
→ Verificar: thread criada com `lead_id` preenchido e visível na timeline da lead

## Status de Implementação

| Fase | Descrição | Status | Commit |
|------|-----------|--------|--------|
| 1 | Schema — lead_id, needs_review | ✅ DONE | fase-1-schema |
| 2 | Endpoint /identify-contact expandido | ✅ DONE | fase-2-identify-expanded |
| 3 | Endpoint /apply-contact-identification | ✅ DONE | fase-3-apply-identify |
| 4 | Integração n8n email | ⏳ TODO | — |
| 5 | Workflow n8n wa-inbound | ⏳ TODO | — |
| 6 | Backfill histórico + relatório | ⏳ TODO | — |
| 7 | UI Lead timeline | ⏳ TODO | — |
| 8 | Customer360 conversations | ⏳ TODO | — |
| T | Testes T1-T5 + cleanup | ⏳ TODO | — |

## Notas Importantes

1. **Newsletter**: Campo INTOCÁVEL (Sprint Final rule)
2. **Tokens**: Usar env vars n8n, nunca hardcoded
3. **Ambiguidade**: Sem atribuição automática — sempre human review
4. **Backup obrigatório**: Antes do backfill
5. **Cache**: POST /utils/cache/clear após mudanças de schema
6. **SSH**: Não acessível — usar POST /fields em vez de psql
