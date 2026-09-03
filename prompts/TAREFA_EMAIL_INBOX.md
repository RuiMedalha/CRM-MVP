# PROMPT — Aba Email / Inbox no CRM HotelEquip OS
# Para usar no Claude Code na branch `feat/modulo-propostas`

---

## Contexto obrigatório — lê antes de escrever uma linha

**Stack:** React + Vite + TypeScript + Tailwind + Directus v11
**Branch activa:** `feat/modulo-propostas` no repo `RuiMedalha/crm-lab-directus`
**URL Directus:** `https://api.hotelequip.pt`
**Token frontend (CRM):** usa `VITE_DIRECTUS_TOKEN` do `.env.local` (role CRM — tem read+update em `email_threads` e read em `email_messages`, `email_attachments`)

### Regras críticas do projecto (NÃO violar)
- Directus devolve números como strings → usar sempre o helper `n()` de `src/components/proposals/public/utils.ts`
- `directusAdminFetch()` com `VITE_DIRECTUS_ADMIN_TOKEN` é só para operações públicas de propostas. **Para a aba de email usa o token CRM normal (`VITE_DIRECTUS_TOKEN`)**
- Não tocas em nada relacionado com Telecof (`communication_events`)
- Não alterares o schema do Directus — as coleções já existem
- `objectFit: contain` em imagens de produto (irrelevante aqui, mas fica registado)
- Sem `Font.register()` com URLs externas em PDFs (irrelevante aqui)

### Mapeamento do operador logado → employees
`employees` **não tem** campo `directus_user_id`. O mapeamento é feito por **email**: o utilizador Directus logado tem `email` → faz `GET /items/employees?filter[email][_eq]={{email_do_user_logado}}&limit=1` para obter o `employees.id` (integer). Guarda este id no contexto/estado assim que o user está autenticado. **Este id é o que vai para `assigned_to` no "Assumir".**

---

## O que construir

Cria a aba **"Email"** / **"Inbox"** no CRM. O ficheiro de entrada é `src/pages/Email.tsx` (ou onde o router do CRM define as rotas — adapta ao padrão existente).

**Esta aba é só de visualização e triagem. O operador responde no Outlook. Não constróis editor de email.**

---

## 1. Rota e navegação

Adiciona a rota `/email` ao router existente e uma entrada no menu de navegação lateral com ícone de email (`Mail` do lucide-react). Badge numérico no menu mostrando a contagem de threads `status=queued` (fila comum — sem dono).

---

## 2. Componente principal: `src/pages/Email.tsx`

Estado local:
```typescript
type EmailView = 'list' | 'detail'

// filtros activos
interface EmailFilters {
  mailbox: string          // '' = todas
  status: string           // '' = todas | 'queued' | 'assigned' | 'replied' | 'closed' | 'snoozed'
  category: string         // '' = todas
  onlyUnassigned: boolean  // TRUE por defeito — a vista mais importante
}
```

Vista por defeito ao abrir a aba: `onlyUnassigned: true`, `status: ''`, resto vazio.

---

## 3. Barra de filtros

Uma linha compacta (não um painel lateral) com:

```
[ 🔵 Fila comum ●  ]  [ Caixa ▾ ]  [ Estado ▾ ]  [ Categoria ▾ ]  [ 🔍 pesquisa subject/remetente ]
```

- **"Fila comum"** é um toggle pill destacado (cor primary quando activo). Quando ON: `filter[assigned_to][_null]=true`. Quando OFF: sem filtro de assigned_to.
- **Caixa:** `apoio.cliente@hotelequip.pt` / `geral@hotelequip.pt` / Todas
- **Estado:** Fila (queued) / Assumido (assigned) / Respondido (replied) / Fechado (closed) / Todos
- **Categoria:** os 10 valores (ver abaixo) + Todas

Quando "Fila comum" está OFF e nenhum outro filtro activo → mostra todas as threads (as minhas + as da fila).

---

## 4. Lista de threads (`EmailThreadList.tsx`)

Fetch:
```
GET /items/email_threads
  ?sort=sla_due_at          ← mais urgente primeiro (null vai para o fim)
  &filter[assigned_to][_null]=true   ← se onlyUnassigned
  &filter[mailbox][_eq]=...          ← se mailbox filtro activo
  &filter[status][_eq]=...           ← se status filtro activo
  &filter[category][_eq]=...         ← se category filtro activo
  &limit=50
  &fields=id,subject,from_address,to_address,mailbox,category,status,urgency,
           sla_due_at,ai_summary,assigned_to,assigned_at,date_created,
           first_replied_at
```

Cada linha da lista é um card compacto (não uma tabela) com estas zonas:

```
┌─────────────────────────────────────────────────────────────────┐
│ [BADGE urgência] [BADGE categoria]          [mailbox pill] [SLA]│
│ 👤 cliente@empresa.pt → Re: Pedido de orçamento cozinha indust. │
│ 💬 "O cliente quer saber se temos stock de..."  [há 2h] [●queued]│
│                                               [ Assumir ▶ ]     │
└─────────────────────────────────────────────────────────────────┘
```

### Badges de categoria (cor fixa por tipo)

```typescript
const CATEGORY_CONFIG = {
  pedido_orcamento:        { label: 'Orçamento',     color: 'bg-blue-100 text-blue-800' },
  followup_cliente:        { label: 'Follow-up',     color: 'bg-purple-100 text-purple-800' },
  reclamacao:              { label: 'Reclamação',    color: 'bg-red-100 text-red-800' },
  compra_cliente:          { label: 'Compra',        color: 'bg-green-100 text-green-800' },
  fornecedor_sourcing:     { label: 'Sourcing',      color: 'bg-orange-100 text-orange-800' },
  tabela_precos_fornecedor:{ label: 'Tabela preços', color: 'bg-yellow-100 text-yellow-800' },
  compra_fornecedor:       { label: 'Compra forn.',  color: 'bg-teal-100 text-teal-800' },
  fatura_administrativo:   { label: 'Fatura/Admin',  color: 'bg-gray-100 text-gray-700' },
  spam:                    { label: 'Spam',          color: 'bg-gray-100 text-gray-400' },
  outro:                   { label: 'Outro',         color: 'bg-gray-100 text-gray-600' },
}
```

### Badges de urgência

```typescript
const URGENCY_CONFIG = {
  low:      { label: 'Baixa',   color: 'bg-gray-100 text-gray-500',   dot: '⚪' },
  normal:   { label: 'Normal',  color: 'bg-blue-50 text-blue-600',    dot: '🔵' },
  high:     { label: 'Alta',    color: 'bg-amber-100 text-amber-700', dot: '🟡' },
  critical: { label: 'Crítica', color: 'bg-red-100 text-red-700',     dot: '🔴' },
}
```

### Estados visuais da linha

| Condição | Visual |
|---|---|
| `sla_due_at` passado + status não `replied`/`closed` | Borda esquerda vermelha + fundo vermelho muito suave + `⚠️ SLA excedido` |
| `status === 'queued'` e `assigned_to === null` | Borda esquerda âmbar + pill "Na fila" |
| `status === 'assigned'` | Borda esquerda azul + "Assumido por {nome}" |
| `status === 'replied'` | Borda esquerda verde + "Respondido" |
| `status === 'closed'` | Opacidade 60% + "Fechado" |

### "Tempo desde que entrou"

`formatDistanceToNow(new Date(thread.date_created), { locale: pt, addSuffix: true })` de `date-fns/locale/pt`.

### Botão "Assumir"

Visível em threads com `status === 'queued'` e `assigned_to === null`.
Também visível se o utilizador logado não é o `assigned_to` (para re-atribuição futura — por agora apenas na fila).

Ao clicar:
```typescript
// PATCH /items/email_threads/{thread.id}
await directusFetch(`/items/email_threads/${thread.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    assigned_to: currentEmployeeId,   // integer — employees.id do operador logado
    assigned_at: new Date().toISOString(),
    status: 'assigned'
  })
})
// Actualiza a thread localmente (optimistic update) e remove da fila comum
```

Usa o `VITE_DIRECTUS_TOKEN` normal (não o admin token). As permissões de update em `email_threads` já estão configuradas no role CRM.

---

## 5. Vista de detalhe da thread (`EmailThreadDetail.tsx`)

Ao clicar numa linha da lista, abre o detalhe (substitui a lista ou painel lateral — adapta ao padrão de navegação do CRM existente).

### Header do detalhe

```
← Voltar    [BADGE urgência] [BADGE categoria] [BADGE status]
Assunto: Re: Pedido de orçamento cozinha industrial
De: cliente@empresa.pt  →  apoio.cliente@hotelequip.pt
Entrou há 3h  |  SLA: 14:30 (⚠️ em 45min)  |  Assumido por: Rui Medalha
```

### Bloco "Rascunho da IA" (destaque principal)

Se `thread.ai_draft` preenchido:

```
┌─── 🤖 Rascunho preparado pela IA ──────────────────────────────┐
│                                                                  │
│  [texto do ai_draft aqui, fonte mono ligeiramente menor]        │
│                                                                  │
│  ⚠️  Este rascunho já foi criado no Outlook.                    │
│  Abre o rascunho no Outlook, revê o texto e clica em Enviar.   │
│                                                                  │
│  [ 📋 Copiar texto ]                                            │
└──────────────────────────────────────────────────────────────────┘
```

Fundo levemente azul/teal. Botão "Copiar texto" copia `ai_draft` para clipboard.

### Histórico de mensagens

Fetch:
```
GET /items/email_messages
  ?filter[thread_id][_eq]={thread.id}
  &sort=received_at
  &fields=id,direction,from_address,to_address,subject,body_text,received_at,sent_at,is_draft
```

Renderizar cada mensagem como um balão/card:

- `direction === 'inbound'` → alinhado à esquerda, fundo cinzento claro
- `direction === 'outbound'` → alinhado à direita, fundo teal claro
- `is_draft === true` → fundo amarelo claro, label "Rascunho"

Mostrar `body_text` (não HTML por segurança nesta fase). Timestamp formatado.

### Botões de acção no rodapé do detalhe

```
[ Assumir ]           ← só se assigned_to === null ou !== currentEmployeeId
[ ✅ Marcar resolvido ]  ← PATCH status='closed', closed_at=now()
[ 👤 Ver contacto ]   ← só se contact_id preenchido → navega para /contactos/{contact_id}
```

"Marcar resolvido":
```typescript
await directusFetch(`/items/email_threads/${thread.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString() })
})
```

---

## 6. Hook `useEmailThreads.ts`

Cria `src/hooks/useEmailThreads.ts`:

```typescript
interface UseEmailThreadsOptions {
  filters: EmailFilters
  enabled?: boolean
}

export function useEmailThreads({ filters, enabled = true }: UseEmailThreadsOptions) {
  // fetch com react-query ou useEffect — adapta ao padrão existente no projecto
  // URL: /items/email_threads com os filtros mapeados
  // Retorna: { threads, isLoading, error, refetch, unassignedCount }
}
```

`unassignedCount`: fetch separado `GET /items/email_threads?filter[assigned_to][_null]=true&filter[status][_neq]=closed&aggregate[count]=id` para o badge do menu.

---

## 7. Hook `useCurrentEmployee.ts`

Cria `src/hooks/useCurrentEmployee.ts`:

```typescript
export function useCurrentEmployee() {
  // 1. GET /users/me → obtém email do user Directus logado
  // 2. GET /items/employees?filter[email][_eq]={email}&limit=1 → obtém employees.id
  // Retorna: { employee: { id: number, full_name: string, email: string } | null, isLoading }
}
```

Este hook é partilhado — se já existir equivalente no projecto, usa-o e adapta.

---

## 8. Ficheiros a criar/modificar

```
src/pages/Email.tsx                          ← novo (componente principal da aba)
src/components/email/EmailThreadList.tsx     ← novo
src/components/email/EmailThreadCard.tsx     ← novo (um card da lista)
src/components/email/EmailThreadDetail.tsx   ← novo
src/components/email/EmailFilters.tsx        ← novo (barra de filtros)
src/hooks/useEmailThreads.ts                 ← novo
src/hooks/useCurrentEmployee.ts              ← novo (ou adaptar existente)
src/App.tsx (ou router)                      ← adicionar rota /email
src/components/Layout.tsx (ou Sidebar)       ← adicionar entrada no menu
```

---

## 9. Mapa de status → label PT

```typescript
const STATUS_LABELS: Record<string, string> = {
  queued:   'Na fila',
  assigned: 'Assumido',
  replied:  'Respondido',
  closed:   'Fechado',
  snoozed:  'Adiado',
}
```

---

## 10. Requisito de qualidade

`npx tsc --noEmit` com **zero erros** antes do commit.

Commit mensagem: `feat(email): aba inbox — lista, filtros, assumir, detalhe + rascunho IA`

---

## O que NÃO construir (explicitamente fora de âmbito)

- ❌ Editor de resposta dentro do CRM
- ❌ Envio de email via Graph API a partir do CRM
- ❌ Anexos — só listar (sem download nesta fase)
- ❌ Assinaturas (`email_signatures`) — a coleção existe mas não usa ainda
- ❌ Notificações push / realtime — polling simples é suficiente
- ❌ Criação manual de threads no CRM
- ❌ Qualquer alteração ao schema Directus

---

## Referência rápida de campos

### `email_threads` (campos que a aba lê/escreve)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `date_created` | timestamp | quando entrou |
| `subject` | string | assunto |
| `from_address` | string | remetente |
| `to_address` | string | destinatário |
| `mailbox` | string | `apoio.cliente@hotelequip.pt` ou `geral@hotelequip.pt` |
| `category` | string | enum 10 valores |
| `status` | string | queued / assigned / replied / closed / snoozed |
| `urgency` | string | low / normal / high / critical |
| `sla_due_at` | timestamp | prazo — comparar com `Date.now()` |
| `ai_summary` | text | resumo curto da IA |
| `ai_draft` | text | rascunho completo da IA |
| `assigned_to` | **integer** | `employees.id` — **null = fila comum** |
| `assigned_at` | timestamp | quando foi assumido |
| `first_replied_at` | timestamp | quando foi respondido (via Outlook) |
| `contact_id` | integer | `contacts.id` se encontrado |

### `email_messages` (a aba só lê)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `thread_id` | uuid | FK → email_threads.id |
| `direction` | string | inbound / outbound |
| `from_address` | string | |
| `body_text` | text | mostrar este (não HTML) |
| `received_at` | timestamp | quando chegou |
| `sent_at` | timestamp | quando foi enviado (outbound) |
| `is_draft` | boolean | true = rascunho |
