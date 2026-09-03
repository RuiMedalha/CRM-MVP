# Activity Ledger — Append-only Audit Pattern

## Schema

A coleção `activity` no Directus funciona como um **ledger append-only** para toda a atividade do CRM. Cada linha regista uma mutação com estado anterior/posterior.

### Campos expandidos (auditoria)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `collection` | text | Nome da coleção alvo (ex: `deals`, `leads`) |
| `item_id` | uuid | ID do registo mutado |
| `action` | enum | `create`, `update`, `delete` |
| `user_id` | FK → directus_users | Quem executou |
| `user_email` | text | Email do user (denormalizado) |
| `server_timestamp` | datetime | Momento exacto no servidor |
| `before` | JSON | Estado anterior (null em creates) |
| `after` | JSON | Estado posterior (null em deletes) |
| `source` | enum | `ui`, `api`, `webhook`, `system`, `ai` |
| `ip_address` | text | Origem da request |
| `user_agent` | text | User-agent da request |

### Índices

- `(collection, item_id)` — lookup por registo
- `(server_timestamp DESC)` — timeline eficiente

## Padrão implementado

### `auditMutation(collection, action, before, after)`

Wrapper fire-and-forget em `src/integrations/directus/audit.ts`:

1. Tenta POST directo para `/items/activity`
2. Se falhar (rede, 503), **persiste numa retry queue em IndexedDB**
3. A cada 30s, faz flush da queue para o Directus
4. **Nunca bloqueia a mutação original** — é sempre async + .catch()

### `useAuditedMutation`

Hook React Query em `src/hooks/useAudit.ts` que:

- Em updates: lê o estado actual (`before`) via GET antes de executar
- Executa a mutation original
- Dispara `auditMutation` com o `before` + `result`
- Faz invalidate de queries no `onSuccess`

### Mutações migradas

| Ficheiro | Mutação | Collection |
|----------|---------|------------|
| `src/hooks/useDeals.ts` | `useCreateDeal` | `deals` |
| `src/hooks/useDeals.ts` | `useUpdateDeal` | `deals` (audit inline) |
| `src/hooks/useFollowUps.ts` | `useCreateFollowUp` | `follow_ups` |
| `src/hooks/useQuotations.ts` | `useCreateQuotation` | `quotations` |
| `src/hooks/useLeads.ts` | `useCreateLead` | `leads` |

## Princípios

1. **Append-only** — nunca UPDATE ou DELETE linhas de activity
2. **Best-effort** — falhas de rede geram retry queue, nunca bloqueiam UI
3. **Before/After** — em updates, `before` captura o estado pré-mutação
4. **Source tagging** — cada entrada identifica a origem (ui, api, webhook, etc.)
