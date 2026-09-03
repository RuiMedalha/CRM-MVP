# n8n Email Workflows — Melhorias a Aplicar

## Workflows afectados
- `3rFeTNSDFYOXHexU` — "Hotelequip · Email → CRM (apoio.cliente@hotelequip.pt)"
- `8zO7pcCiEYKzNdzn` — "Hotelequip · Email → CRM (geral@hotelequip.pt)"

## REGRA: Nunca alterar os originais!
Criar CÓPIAS com sufixo " v2" no nome. Desactivar o original. Activar a cópia.

---

## Alteração 1 — Corpo completo (bodyPreview → body.content)

**Nó afectado:** "Normalizar campos" (tipo Set)

**Campo `bodyText`:**
```
ANTES: {{ $json.bodyPreview || '' }}
DEPOIS: {{ ($json.body?.content || $json.bodyPreview || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim() }}
```

**Adicionar novo campo `bodyHtml`:**
```
{{ $json.body?.content || '' }}
```

**No nó Microsoft Outlook (Trigger):** confirmar que o campo `body` está a ser pedido.
Se usar `$select`, adicionar `body` à lista: `$select=subject,from,toRecipients,body,bodyPreview,receivedDateTime,hasAttachments,conversationId`

---

## Alteração 2 — Gravar body_html na mensagem

**Nó afectado:** "Directus · Criar mensagem (inbound)"

Adicionar ao body do POST:
```json
"body_html": "{{ $json.bodyHtml || '' }}"
```

---

## Alteração 3 — Identificar contacto por email

**Novo nó** (HTTP Request) DEPOIS de "Normalizar campos", ANTES de "Claude · Classificar":

```
Nome: "Identificar contacto"
Tipo: HTTP Request (POST)
URL: https://api.hotelequip.pt/identify-contact
Headers: Authorization: Bearer {{ $env.DIRECTUS_ADMIN_TOKEN }}
Body (JSON):
{
  "email": "{{ $json.fromAddress }}"
}
```

Resultado: `$json.kind` = "contact" | "lead" | "unknown"

---

## Alteração 4 — Criar Lead se desconhecido

**Novo nó** (IF + HTTP Request) DEPOIS de "Identificar contacto":

```
IF: $json.kind === "unknown"
TRUE → HTTP Request POST:
  URL: https://api.hotelequip.pt/items/leads
  Headers: Authorization: Bearer {{ $env.DIRECTUS_ADMIN_TOKEN }}
  Body:
  {
    "status": "new",
    "source": "email_inbound",
    "email": "{{ $('Normalizar campos').first().json.fromAddress }}",
    "display_name": "{{ $('Normalizar campos').first().json.fromName || '' }}",
    "contact_name": "{{ $('Normalizar campos').first().json.fromName || '' }}"
  }
FALSE → continua normalmente
```

---

## Alteração 5 — Ligar contact_id à thread

**Nó afectado:** "Directus · Criar thread"

Adicionar ao body:
```json
"contact_id": {{ $('Identificar contacto').first().json.kind === 'contact' ? $('Identificar contacto').first().json.record.id : null }}
```

---

## Alteração 6 — Gerar draft para TODAS as categorias

**Nó afectado:** "Exige resposta?" (tipo IF)

Actualmente: só cria rascunho para categorias específicas.

Alteração: **Remover a condição** ou alterar para que SEMPRE gere draft (o comercial decide se usa ou não). Em alternativa, incluir `fornecedor_sourcing` na lista de categorias que geram draft.

No prompt do "Claude · Classificar", alterar a instrução:
```
ANTES: "draft": "rascunho PT-PT ou null"
DEPOIS: "draft": "rascunho de resposta em PT-PT (SEMPRE gerar, mesmo para fornecedores — adaptar tom: se for fornecedor, responder como comprador)"
```

---

## Alteração 7 — Anexos (futuro)

Quando `hasAttachments === true`:
1. GET /messages/{id}/attachments
2. Para cada: upload para Directus /files
3. Gravar no campo `attachments` (JSON) da email_message

Formato:
```json
[{"file": "<directus-uuid>", "filename": "nome.pdf", "mimetype": "application/pdf", "size": 12345}]
```

---

## Ordem de implementação

1. 🔴 Alteração 1+2 (corpo completo) — resolve truncamento
2. 🔴 Alteração 3+4+5 (identificação + lead) — resolve "não cria leads"
3. 🟡 Alteração 6 (draft sempre) — resolve "ai_draft vazio"
4. 🟢 Alteração 7 (anexos) — melhoria futura

---

## Nota sobre a cópia

Ao criar o workflow v2:
1. Duplicar via API: POST /api/v1/workflows com body do original + nome alterado
2. Desactivar original: PATCH /api/v1/workflows/{id} com {"active": false}
3. Activar cópia: PATCH /api/v1/workflows/{id} com {"active": true}
4. Manter o original com nome "[ORIGINAL] Hotelequip · Email → CRM (apoio.cliente@hotelequip.pt)"
