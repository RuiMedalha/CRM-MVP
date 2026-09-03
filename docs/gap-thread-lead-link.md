# Gap: Thread Lead Link (não gravado pelo n8n)

**Data:** 2026-07-17  
**Status:** Identificado e documentado (fix parcial no frontend)  
**Severidade:** Média — leva a duplicação de leads se operador clica "Criar contacto"

## Descrição do Bug

Quando o workflow n8n `email-crm-v2-geral` (ou apoio-cliente) cria uma **lead via `/items/leads` POST**, o `thread_id` da thread **não é gravado na lead** e, reciprocamente, o `lead_id` da lead **não é gravado na thread**.

Result: no frontend `EmailThreadDetail.tsx`, ao abrir a thread, o sistema não consegue associar a thread à lead já criada. Mostra "Contacto desconhecido" com botão "Criar contacto", que se clicado cria uma **segunda lead duplicada** com o mesmo email.

## Cenário Real (T1 — Testes Reais SPRINT FINAL 2026-07-17)

```
Input: Email de ruimedalha@medalharui@gmail.com com categoria=pedido_orcamento
        → n8n Check/Create Lead:
           1) verifica se existe contacto com email = medalharui@gmail.com → NÃO
           2) verifica se existe lead → NÃO
           3) cria lead nova id=1814 com todos os campos OK ✅

Output thread 5f84ecf3 no Directus:
  - contact_id: null (correcto — não é contacto)
  - lead_id: null ← ERRO: devia estar 1814

Output lead 1814 no Directus:
  - email: medalharui@gmail.com
  - display_name: "João Teste"
  - Todos os campos completos (contact_name, contact_phone, city, postal_code, website, lead_data) ✅

Frontend (antes do fix):
  1) Abre a thread 5f84ecf3
  2) Procura contacto com email=medalharui@gmail.com → NÃO encontra
  3) Mostra: "Contacto desconhecido | ✨ Criar contacto"
  4) Se operador clica "Criar contacto" → cria SEGUNDA lead com mesmo email ❌

Frontend (depois do fix):
  1) Abre a thread 5f84ecf3
  2) Procura contacto → NÃO
  3) **Procura lead com email=medalharui@gmail.com** → encontra id=1814 ✅
  4) Mostra: "Lead já criada: João Teste | Ver"
  5) Operador clica "Ver" → vai para /leads ✅
```

## Causas Raiz

### 1. n8n não grava `thread_id` na lead (workflow)

No nó `Check/Create Lead` do workflow, quando o `POST /items/leads` é executado, o payload não inclui um `thread_id` ou `thread_id_ext` (se existisse coluna). Nem no schema `leads` há coluna `thread_id` — o design é **unidirecional**: leads têm `email_thread_id` em `lead_data` (nested), não em topo.

### 2. n8n não grava `lead_id` na thread (workflow)

Após criar a lead, o workflow não faz `PATCH /items/email_threads/{threadId}` para atualizar o `lead_id`. Isto deixaria a ligação bidirecional, mas **não é implementado**.

### 3. Schema Directus é assimétrico

- `leads` table: coluna `lead_data` (JSON nested) com `email_thread_id` — é a "ligação indireta"
- `email_threads` table: coluna `contact_id` (M2O) mas **sem `lead_id`** — se fosse adicionada, seria a ligação directa

### 4. Frontend assume que thread.lead_id existe

`EmailThreadDetail.tsx` (antes do fix) só consultava `thread.contact_id` para carregar o contexto do cliente. Não havia fallback para "já existe lead mas thread_id é null".

## Fix Parcial (Frontend 2026-07-17)

### Implementado em `EmailThreadDetail.tsx`

1. **Novo estado**: `existingLead` — guarda a lead encontrada por email
2. **Novo useEffect**: quando `contactNotFound` é true, query `/items/leads?filter[email][_eq]=X&filter[status][_neq]=discarded`
3. **Novo ramo de renderização**: se `existingLead` existir, mostra "Lead já criada: <nome>" + link para /leads
4. **Desabilita auto-extract**: quando existe lead, não corre a IA para extrair contacto

### Resultado

- ✅ Operador abre a thread, vê a lead existente com nome correcto
- ✅ Não há tentação de clicar "Criar contacto" (botão desaparece)
- ✅ Link directo para /leads mantém a experiência coerente

## Fix Completo (Backend — n8n, fora do escopo)

Para resolver completamente, é necessário (tarefa futura, fora do scope da SPRINT FINAL):

1. **Schema**: adicionar coluna `lead_id` (FK) a `email_threads` (type: integer, nullable)
2. **n8n nó Check/Create Lead**: após criar lead, fazer `PATCH /items/email_threads/{threadId}` com o `lead_id` da lead criada
3. **Frontend**: quando `thread.lead_id` existir, usar esse em vez de fazer query de fallback

## Entrega

- ✅ **Frontend fix** commitado em 2026-07-17
- ✅ **Build verified** (npm run build passed)
- ✅ **Teste T1** confirma: thread 5f84ecf3 tem lead_id=null (bug confirmado), mas frontend fallback encontra lead 1814
- ✅ **Documento** este — para a próxima etapa resolver no n8n

## Próximos Passos (fora deste scope)

- [ ] Adicionar coluna `lead_id` a `email_threads` (Directus schema alterar via docker exec db-hotelequip psql)
- [ ] Patcher o nó `Check/Create Lead` para gravar `lead_id` após criar lead
- [ ] Re-processar threads antigas para popular `lead_id` onde aplicável
