# Card 16 — AI Agentica: política de uso e limites de confiança

A coleção `ai_agent_runs` regista cada invocação dos agentes que **agem** no
CRM (qualificação de lead, redacção de email, agendamento de follow-up).

## Coleção `ai_agent_runs`

| Campo              | Tipo                              | Notas                                  |
| ------------------ | --------------------------------- | -------------------------------------- |
| `agent_type`       | enum                              | `lead_qualifier` \| `email_drafter` \| `followup_scheduler` \| `call_summarizer` |
| `input_payload`    | JSON                              | Dados que o agente recebeu             |
| `output_payload`   | JSON                              | Resposta estruturada do agente         |
| `status`           | enum                              | `pending` \| `running` \| `completed` \| `failed` \| `awaiting_human` |
| `confidence_score` | decimal(3,2) [0-1]                | Auto-confiança do agente               |
| `human_reviewed_by`| FK directus_users (nullable)      | Quem aprovou/rejeitou                  |
| `human_approved`   | boolean (nullable)                | `true` aprovado, `false` rejeitado     |
| `human_reject_reason` | text                          | Motivo da rejeição                     |
| `provider`         | text                              | ID do provider AI usado                |
| `model`            | text                              | Modelo                                 |
| `tokens_used`      | integer                           | Métrica de custo                       |
| `latency_ms`       | integer                           | Latência da chamada                    |
| `error`            | text nullable                     | Mensagem de erro em caso de falha      |
| `lead_id` / `deal_id` / `follow_up_id` | FK | Contexto da execução         |
| `date_created` / `date_updated` | timestamp            | Automáticos                            |

Índices:
- `(agent_type, status)` — listagem filtrada por tipo + estado.
- `(awaiting_human)` — fila de revisão humana.

## Política de uso

| Agente              | Auto-aprova?          | Acção por defeito                          |
| ------------------- | --------------------- | ------------------------------------------ |
| `lead_qualifier`    | Sim, se `confidence ≥ 0.7` | Caso contrário, fila `awaiting_human`.  |
| `email_drafter`     | **Nunca**             | SEMPRE `awaiting_human`. Risco reputacional. |
| `followup_scheduler`| **Nunca**             | Cria rascunho `follow_ups.status=draft`, aguarda humano. |
| `call_summarizer`   | Sim, se `confidence ≥ 0.7` | Caso contrário, fila.                  |

> Limite duro: **`CONFIDENCE_THRESHOLD = 0.7`** abaixo do qual a execução é
> colocada em fila para revisão humana.

## Hooks Directus

`src/hooks/aiAgent.js` regista handlers:

- `items.create` em `leads` → `qualifyLead`
- `items.update` em `deals` com transição para stage `proposta` → `draftEmail`
- `items.create`/`items.update` em `follow_ups` com `due_at` no passado →
  `scheduleFollowup`

Instalação como extensão Directus:

```js
// extensions/hooks/ai-agent/index.js
const { onLeadCreate, onDealUpdate, onFollowupOverdue } = require('../../src/hooks/aiAgent');

module.exports = function registerHook({ database, schema, accountability }) {
  return {
    'items.create': {
      collection: 'leads',
      action: (input) => onLeadCreate(input, { database, schema, accountability }),
    },
    'items.update': {
      collection: 'deals',
      action: (input) => onDealUpdate(input, { database, schema, accountability }),
    },
    'items.create': {
      collection: 'follow_ups',
      action: (input) => onFollowupOverdue(input, { database, schema, accountability }),
    },
  };
};
```

## UI

- `/ai-review` — fila de runs `awaiting_human` com botões Aprovar / Editar / Rejeitar.
- `src/pages/Leads.tsx` — badge `AI: qualified N` + botão **Ver raciocínio** em
  cada lead que tenha um `ai_agent_runs.agent_type=lead_qualifier`.

## Audit log

Cada execução (e cada aprovação/rejeição) escreve um registo em `activity` com
`source_collection=ai_agent_runs`, `source_id=<run id>` e `payload` com
provider/model/tokens/latency. Permite reconstruir o que o agente decidiu e
quando.

## Limites & segurança

- Nenhum agente escreve fora das coleções permitidas (`leads`, `deals`,
  `follow_ups`, `activity`, `ai_agent_runs`).
- Toda a IA passa pelo `AIRouterService` (Card 13) com provider configurável
  em `ai_providers` (chaves nunca no código).
- O prompt do agente vive em código; alterações exigem PR + revisão humana.
- Ações irreversíveis (enviar email, criar deal, mudar stage) só acontecem
  após `human_approved=true` em `/ai-review`.
