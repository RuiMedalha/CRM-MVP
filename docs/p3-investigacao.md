# P3 — Investigação: Proposta automática a partir de email

> Documento gerado por exploração ao vivo do código — 18/07/2026

---

## 1. Schema `quotations`

### Campos principais

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| `id` | integer (auto-inc) | — | PK |
| `quotation_number` | string | gerado: `PRP-YYYYMMDD-XXXX` ou `ORC-…` | |
| `status` | string | `"draft"` (cliente-side) | `draft→sent→viewed→approved/rejected/expired/converted` |
| `document_type` | string | `"proposal"` | `"proposal"` ou `"quotation"` |
| `customer_id` | integer | — | FK → contacts (inconsistência: contacts.id é UUID) |
| `customer_name` / `customer_company` | string | — | denormalizados para landing pública |
| `treatment` / `language` / `customer_timezone` | string | — / `"pt"` / — | |
| `welcome_message` / `proposal_description` | text | — | |
| `subtotal` / `total_amount` | decimal | — | calculados cliente-side |
| `valid_until` | date | — | |
| `phone_gate_enabled` | boolean | `true` | |
| `deposit_type` / `deposit_percent` | string / integer | `"partial"` / `50` | |
| `theme` | string | `"system"` | |
| `public_token` | string (unique) | — | gerado no envio |
| `notes` / `terms_conditions` / `internal_notes` | text | — | |
| `sent_to_email` / `sent_to_phone` | string | — | |
| `sent_at` / `approved_at` / `rejected_at` | timestamp | — | |
| `pdf_file_url` | string | — | |

**Nenhum campo é formalmente `required: true`** — todos `is_nullable: true`. Defaults são cliente-side.

### Relações
- `deal_id` → `deals` (uuid)
- `customer_id` → `contacts` (integer, inconsistência com contacts.id UUID)
- `pdf_file` → `directus_files`
- Items: resolvidos via `filter[quotation_id][_eq]=<id>` (FK lógica declarada em schema)

---

## 2. Schema `quotation_items`

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| `id` | integer (auto-inc) | — | PK |
| `quotation_id` | integer | — | m2o → `quotations` |
| `product_id` | string | — | ID externo (Meilisearch/Woo, não coleção Directus) |
| `product_name` | string | — | |
| `sku` | string | — | |
| `quantity` | integer | `1` (cliente-side) | |
| `unit_price` | decimal | — | |
| `iva_percent` | decimal | — | |
| `discount_percent` | decimal | `0` | |
| `line_total` | decimal | — | `qty * unit_price * (1 - discount/100)` |
| `image_url` | string | — | |
| `product_url` | string | — | |
| `item_type` | string | `"product"` | `product`, `service`, `additional` |
| `manual_entry` | boolean | `false` | |
| `sort_order` | integer | — | posição no array |
| `notes` | text | — | |
| `ai_description` | text | — | |
| `comparison_group` / `is_recommended` / `comparison_specs` | string/bool/json | — | comparação A/B |
| `images` | json | — | array até 5 |
| `datasheet_url` / `datasheet_label` / `ficha_tecnica_url` | string | — | |

---

## 3. Como o módulo manual (8 passos) cria uma quotation

### Fluxo resumido

1. **Montagem em `/propostas/nova`**: `QuotationForm.tsx` cria imediatamente um rascunho vazio:
   ```ts
   createQuotation({ status: "draft", document_type: "proposal", quotation_number: generateQuotationNumber("proposal") })
   ```
   Redireciona para `/propostas/<id>`.

2. **8 passos** — estado vive em React context (`ProposalFormContext.tsx`) + localStorage.

3. **Guardar rascunho** (`handleSaveDraft`): `patchQuotation(id, payload)` + `createQuotationItems(allItems)` (se 1ª vez) ou `replaceQuotationItems(id, items)` (re-save).

4. **Enviar** (`StepSend.handleSend`):
   - `patchQuotation` ou `createQuotation` + `createQuotationItems`
   - `sendQuotation(id, { email, phone })` → gera `public_token`, `status: "sent"`
   - `triggerQuotationSent(...)` → n8n webhook

### Ficheiros críticos
- `src/pages/QuotationForm.tsx` — orquestrador
- `src/contexts/ProposalFormContext.tsx` — state + reducer
- `src/components/proposals/steps/StepContent.tsx` — adiciona items via Meilisearch
- `src/components/proposals/steps/StepSend.tsx` — finaliza e envia
- `src/integrations/directus/quotations.ts` — CRUD

### Funções disponíveis para criar quotation programaticamente

| Função | Ficheiro | O que faz |
|---|---|---|
| `createQuotation(payload)` | `quotations.ts:163` | POST /items/quotations — gera number se faltar |
| `createQuotationItems(items[])` | `quotations.ts:173` | POST /items/quotation_items — aceita array |
| `patchQuotation(id, patch)` | `quotations.ts:181` | PATCH /items/quotations/:id |
| `replaceQuotationItems(id, items)` | `quotations.ts:205` | delete + create (substituição total) |
| `generateQuotationNumber(docType)` | `quotations.ts:56` | Gera `PRP-/ORC-YYYYMMDD-XXXX` |
| `sendQuotation(id, { email, phone })` | `quotations.ts:288` | Gera token + status sent |

---

## 4. Botão "→ Proposta" no `EmailProductSuggestions.tsx`

### O que faz hoje

Linha ~161-173:
```ts
const params = new URLSearchParams();
if (contactId) params.set("customer_id", String(contactId));
params.set("products", JSON.stringify([{ sku: p.sku, name: p.title || p.name, price: p.price }]));
window.location.href = `/propostas/nova?${params.toString()}`;
```

**Navega** para `/propostas/nova` com query params. **MAS o QuotationForm NÃO lê query params** — só lê `location.state.prefill` (via React Router state). Logo, **hoje o botão não pré-preenche nada** — o formulário abre vazio.

### Descoberta crítica

O contrato correto (usado em `Customer360Actions.tsx:77`) é:
```ts
navigate('/propostas/nova', { state: { prefill: { contactId, products: [...] } } })
```

O `ProposalFormContext.tsx:209-274` aplica `prefillData` vindo de `location.state` com:
- `customer_id`, `contactName`, `company`, `email`, `phone`, `notes`
- `products` → mapeia para `QuotationItem[]` com `product_name`, `quantity=1`, `unit_price`, `line_total`

---

## 5. Conclusões para o P3

### O que já existe e pode ser reutilizado
1. `createQuotation()` + `createQuotationItems()` — funções prontas para criar programaticamente
2. `ProposalFormContext` aceita `prefillData` com `products` array
3. Schema aceita todos os campos necessários sem `required: true`

### O que não existe / está partido
1. **Botão "→ Proposta" no email não funciona** — usa `window.location.href` + query params em vez de `navigate + state`
2. **Não há criação automática de proposta em rascunho** — o fluxo actual exige abrir o formulário manualmente
3. **Não há endpoint/função que crie quotation + items numa só chamada** — são sempre 2 chamadas separadas

### Caminhos possíveis para P3

**Opção A — Fix mínimo (corrigir botão existente):**
- Trocar `window.location.href` por `navigate('/propostas/nova', { state: { prefill: { ... } } })`
- Vantagem: zero infra nova, o formulário abre pré-preenchido
- Limitação: ainda exige acção manual do agente (clicar botão, rever, enviar)

**Opção B — Criação automática de rascunho:**
- Quando `EmailProductSuggestions` tem resultados E `contactId` existe:
  - Chamar `createQuotation({ status: "draft", document_type: "proposal", customer_id, customer_name, ... })`
  - Chamar `createQuotationItems([...products mapped])` com os resultados do Meilisearch
  - Mostrar link directo para a proposta criada em vez do botão "→ Proposta"
- Vantagem: zero cliques para o agente — a proposta já está feita
- Risco: pode criar propostas para emails mal classificados (falsos positivos)

**Opção C — Híbrido:**
- Corrigir botão (opção A)
- Acrescentar botão "Criar proposta automática" que faz o que a opção B descreve, mas com confirmação do agente (1 clique)
- Vantagem: controlo sem atrito

---

## 6. Ficheiros-chave para implementação

| Ficheiro | Papel |
|---|---|
| `src/components/email/EmailProductSuggestions.tsx` | Botão "→ Proposta" (partido) |
| `src/integrations/directus/quotations.ts` | CRUD quotation/items |
| `src/pages/QuotationForm.tsx` | Formulário manual (lê `location.state.prefill`) |
| `src/contexts/ProposalFormContext.tsx` | Aplica prefill (products, customer) |
| `src/components/proposals/steps/StepContent.tsx` | Padrão de como items são adicionados |

---

## 7. Regra de segurança — Fase 1

### Problema confirmado

Teste real no Meilisearch para `máquina de lavar loiça industrial`:

- Resultados encontrados: **3.309**
- Mistura produtos muito diferentes:
  - Máquinas de túnel: **10.000€–24.000€**
  - Máquinas de bancada: cerca de **2.000€**

Logo, escolher automaticamente o primeiro resultado pode criar uma proposta com SKU/preço totalmente errado (até 10x+ mais caro e dimensão errada).

### Critério implementado na Fase 1

Antes de criar `quotation_items`, o frontend reavalia cada produto sugerido:

1. Pesquisa novamente no Meilisearch usando `sku || title || name` do produto.
2. Analisa os **top 5 resultados**.
3. Calcula dispersão de preço: `max(price) / min(price)` ignorando zeros.
4. Se dispersão `> 3x`, o item fica em revisão:
   - Não fixa `sku`
   - Não fixa `product_id`
   - Não fixa `unit_price`
   - Cria item manual com `unit_price=0` e nota `⚠️ Revisão necessária`
5. Se não há SKU claro e há vários candidatos, também fica em revisão.

### Como fica guardado

Sem alterar schema nesta fase:

- `quotations.internal_notes` recebe marcador:
  - `email_thread:<threadId>` para deduplicação
  - `[needs_review] N item(s) precisam confirmação` quando aplicável
- `quotation_items.notes` recebe a razão concreta da revisão
- `quotation_items.manual_entry=true` nos itens em revisão

### Esclarecimento ao cliente — Fase 1 simples

Quando há review, o painel mostra botão **"Pedir esclarecimento ao cliente"**.

- Usa o proxy IA já existente (`generateWithAI` / n8n)
- Gera só um rascunho curto/objectivo
- O agente copia/revê/envia manualmente
- Nunca envia automaticamente

### Limitação da regra de dispersão (descoberta em teste real)

Para `"máquina de lavar loiça industrial"` (com acentos), os top 5 do Meilisearch são:

| # | Produto | Preço |
|---|---|---|
| 1 | Máquina Túnel 1800 Pratos/Hora | 10.405€ |
| 2 | Máquina Túnel 1980 Pratos/h | 13.699€ |
| 3 | Máquina Túnel Industrial 400V | 14.906€ |
| 4 | Máquina Túnel Compact | 17.500€ |
| 5 | Máquina Túnel Premium | 23.982€ |

Dispersão: 23.982/10.405 = **2,3x** (abaixo do limiar 3x).

O problema: todas as opções "erradas" estão juntas no mesmo grupo de preço.
Nenhuma máquina de bancada (~2.000€) aparece no top 5 para esta frase exata.

**Solução: segundo critério independente — teto de preço absoluto.**

Se `candidato_top.price > 3.000€` E o termo pedido NÃO contém o SKU/referência
exata do candidato → `needs_review = true`, independentemente da dispersão.

Isto garante que items caros nunca passam sem revisão humana, excepto quando
o cliente mencionou explicitamente o modelo/código.

### Fora de âmbito (Fase 2)

- Formulário estruturado com medidas/fotos/exemplos
- Links de produtos sugeridos para o cliente escolher
- Automatização de envio
