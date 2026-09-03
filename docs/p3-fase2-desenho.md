# P3 — Fase 2 — Desenho: Mini-formulário público de especificação

> Análise e proposta de arquitetura — 19/07/2026

---

## 1. Contexto & Objetivo

**Fase 1** (concluída hoje):
- Botão "Pedir esclarecimento" gera uma pergunta de texto curto
- Usa IA via proxy n8n para formular pergunta simples + objectiva
- Agente copia/revê/envia manualmente — não há automação

**Fase 2** — Mini-formulário público de especificação:
- Cliente clica num **link** (em vez de colar texto no email)
- Abre uma **landing pública** (tipo `https://proposta.hotelequip.pt/spec/:token/item/:itemId`)
- Mostra:
  - 3–5 perguntas específicas do produto (geradas pela IA)
  - Upload de 1 foto do espaço/instalação
  - Produtos candidatos como referência (nome, preço, link)
- Cliente responde, faz upload
- Respostas guardadas em Directus (nova coleção `product_specifications`)
- Agente vê as respostas no painel de revisão (sem precisar de email adicional)

**Foco:** validação sem sair do navegador + contexto visual + estrutura clara.

---

## 2. Mecanismo das páginas públicas (padrão existente)

### Como funciona hoje

Todas as páginas públicas usam o mesmo padrão (exemplo: `PublicQuotation.tsx`):

1. **URL com token:** `/p/:token` — token é a chave de acesso
2. **Fetch público (sem auth):** `getQuotationByToken(token)` via `publicFetch()` (plain fetch, sem header Authorization)
3. **Campos expostos:** apenas campos seguros (sem `cost_price`, `internal_notes`, etc.) em `PUBLIC_QUOTATION_FIELDS`
4. **Escrita com admin token:** `recordView()`, `respondToQuotation()` usam `directusAdminFetch()` para PATCH (escrita segura server-side)

### Por que reutilizar?

- ✅ Autenticação: token opaco + sem login
- ✅ Roteamento: React Router já tem `/p/:token`, fácil adicionar `/spec/:token/item/:itemId`
- ✅ Padrão de fetch: `publicFetch()` para leitura, `directusAdminFetch()` para escrita
- ✅ Segurança: Directus role `Public` já tem permissões read-only definidas

---

## 3. Nova coleção Directus: `product_specifications`

### Schema proposto

```
Coleção: product_specifications

Campos:
  id                integer (auto-inc)                  — PK
  quotation_item_id integer (FK → quotation_items)     — item da proposta que esta especificação complementa
  question_number   integer (1-5)                      — ordem das perguntas
  question_text     string                             — pergunta gerada pela IA
  question_type     string                             — tipo: "text" | "number" | "choice" | "photo"
  choice_options    json (array of strings)            — se question_type="choice"
  answer_text       string                             — resposta do cliente (texto)
  answer_number     decimal                            — resposta do cliente (número)
  answer_choice     string                             — resposta do cliente (uma das opções)
  photo_url         string                             — URL do upload (R2)
  photo_upload_at   timestamp                          — quando foi enviado
  ai_summary        text                               — resumo gerado pela IA (opcional)
  status            string                             — "draft" | "submitted" | "reviewed"
  created_at        timestamp
  updated_at        timestamp
  created_by        string (UUID do Public token)      — para audit
```

### Por que esta estrutura?

- **Ligação clara a `quotation_items`:** cada especificação é sobre 1 item da proposta (máquinas, serviços)
- **Perguntas independentes:** número flexível (3–5 conforme gerado pela IA)
- **Tipo de pergunta varia:** o IA pode gerar texto, número, escolha ou pedido de foto
- **Uma foto por item:** suficiente para contexto visual da instalação
- **Status simples:** draft (IA gerou) → submitted (cliente respondeu) → reviewed (agente confirmou)
- **Sem historial:** sobrescreve — simplicidade vs. auditoria

### Permissões Directus

Role `Public`:
```
product_specifications:
  read: campos públicos (question_text, question_type, choice_options, answer_text, photo_url, status)
  create: ✘ (apenas public token criado por admin pode escrever)
  update: para aquele token específico (PATCH resposta + upload)
```

---

## 4. Geração de perguntas pela IA

### Problema com banco fixo de perguntas

Impossível manter uma base de dados com perguntas para **milhares de categorias** (Meilisearch tem ~50k produtos, centenas de categorias). Cada categoria, subcategoria, tipo de produto exigiria curadoria manual.

### Solução: IA inline (por caso concreto)

1. **Trigger:** Quando agente clica "Gerar formulário de especificação" no painel de revisão
2. **Inputs para o IA:**
   - Nome do produto (ex: "Máquina de lavar loiça industrial 1800 pratos/hora")
   - Categoria do produto (ex: "Equipamento de cozinha > Máquinas de lavar")
   - Contexto do cliente (empresa, país, uso HORECA)
   - Razão da revisão (ex: "preço disperso", "sem SKU claro")

3. **Prompt (Haiku, ~100 tokens)**
   ```
   Gera 4 perguntas de especificação em português para validar este produto com o cliente.
   
   Produto: {product_name}
   Categoria: {category}
   Razão de dúvida: {review_reason}
   
   Formato JSON:
   [
     { "question": "...", "type": "text|number|choice|photo", "choices": [...] }
   ]
   
   Perguntas devem:
   - Esclarecer dimensões, capacidade, voltagem, etc.
   - Ser simples e directas (< 80 caracteres cada)
   - Nunca vender, apenas validar
   
   Devolve apenas o JSON.
   ```

4. **Output esperado:**
   ```json
   [
     {
       "question": "Qual é o espaço disponível para esta máquina na vossa cozinha (largura × profundidade)?",
       "type": "text"
     },
     {
       "question": "Qual a voltagem da vossa rede (220V / 380V 3-fase)?",
       "type": "choice",
       "choices": ["220V monofásico", "380V trifásico"]
     },
     {
       "question": "Quantos pratos/hora precisam lavar aproximadamente?",
       "type": "number"
     },
     {
       "question": "Podem enviar uma foto da zona onde será instalada?",
       "type": "photo"
     }
   ]
   ```

5. **Guardar em Directus:** Cria 4 registos em `product_specifications` com as perguntas (status: "draft", sem respostas)

### Viabilidade

- ✅ Prompt curto (< 200 tokens), resposta também pequena (~150 tokens)
- ✅ Custo: ~0.001€ por item (Haiku 4.5 é barato)
- ✅ Velocidade: < 1s (Haiku)
- ✅ Sem cache necessário — cada item é diferente

---

## 5. UI pública: `/spec/:token/item/:itemId`

### Layout

```
┌─────────────────────────────────────────────┐
│  HotelEquip Logo | Especificação de Produto │
├─────────────────────────────────────────────┤
│ Proposta PRP-20260719-0001                  │
│ Cliente: João Café Lda                      │
├─────────────────────────────────────────────┤
│                                             │
│ REFERÊNCIA VISUAL                           │
│ ┌─────────────────────────────────────────┐ │
│ │ Máquina de Lavar Loiça Industrial       │ │
│ │ SKU: MLI-1800-380V                      │ │
│ │ € 8.500,00                              │ │
│ │ [Ficha Técnica]  [Ver Catálogo]         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ VALIDAÇÃO DO CLIENTE                        │
│                                             │
│ 1. Qual é o espaço disponível?              │
│    [________________] (largura × profundidade)
│                                             │
│ 2. Qual a voltagem?                         │
│    (○) 220V  (○) 380V 3-fase               │
│                                             │
│ 3. Quantos pratos/hora?                     │
│    [________] pratos                        │
│                                             │
│ 4. Foto da zona de instalação               │
│    [📎 Seleccionar ficheiro]                │
│    (PNG, JPG, máx. 5 MB)                   │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ [Cancelar]  [Enviar Respostas] (→)      │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Garantia: A sua proposta permanece válida  │
│ até {data}. Depois desta data, entre em    │
│ contacto connosco.                         │
└─────────────────────────────────────────────┘
```

### Componentes

1. **Header:** Logo + cliente + número proposta (leitura pública, sem auth)
2. **Product Card:** Nome, SKU, preço, imagem, link externo (reutilizar de `ProductCard.tsx`)
3. **Form questões:** 3–5 perguntas inline + input dinâmico (text / number / radio / file)
4. **File upload:** Drag-drop ou input file → upload directo a R2 via Directus
5. **Action Buttons:** "Cancelar" + "Enviar Respostas" (PATCH `product_specifications`)
6. **Rodapé:** Validade, contacto

### Tecnologia

- **React component:** `PublicProductSpecification.tsx`
- **Rota:** `/spec/:token/item/:itemId` em `App.tsx`
- **State:** `useState` para respostas temporárias + localStorage backup
- **Upload:** fetch com FormData → `/files?folder_id=...` ou S3 directo

---

## 6. Integração com painel de revisão (backend agente)

### O agente vê isto no painel (no `EmailProductSuggestions`)

Hoje mostra:
```
[⚠️ Alguns produtos precisam de confirmação]
- Preço muito disperso (€5.000–€15.000)
- Sem SKU claro

[Pedir esclarecimento ao cliente]  [rascunho texto]
```

**Fase 2 adiciona:**
```
[⚠️ Alguns produtos precisam de confirmação]
- Preço muito disperso (€5.000–€15.000)
- Sem SKU claro

[Pedir esclarecimento] [Gerar formulário] ← NOVO
  ↓
(Clica "Gerar formulário")
  ↓
(Sistema chama IA, cria registos em product_specifications)
  ↓
[✓ Formulário gerado]
Link para enviar: https://proposta.hotelequip.pt/spec/{token}/item/{itemId}
[Copiar link]
```

Agente copia o link e envia via email como:
```
Olá João,

Para precisarmos melhor a solução, preencha este formulário rápido:
https://proposta.hotelequip.pt/spec/abc123/item/45

Demora < 2 min. Obrigado!
```

### Após cliente responder

Agente recarrega o painel (ou vê notificação automática):
```
[✓ Formulário respondido]
Respostas:
- Espaço: 1.5m × 2.0m
- Voltagem: 380V trifásico
- Pratos/hora: 1.200
- Foto: [visto em R2]

[Revisar] [Confirmar e criar item] [Ajustar]
```

---

## 7. Comparação com "Pedir esclarecimento" (Fase 1)

| Aspecto | Fase 1 | Fase 2 |
|---|---|---|
| **Tipo de resposta** | Texto livre (pergunta genérica) | Estruturado (perguntas específicas) |
| **Validação** | Nenhuma (agente lê na resposta) | Tipo de resposta varia (texto, número, escolha, foto) |
| **Contexto visual** | Nenhum | Referência visual do produto + foto da instalação |
| **Automação** | Nenhuma (email manual) | Link automático |
| **Armazenamento** | Email (ephemeral) | Directus `product_specifications` (structured) |
| **Reutilização** | Não | Sim (IA pode aprender de padrões) |

### Decisão importante: substitui ou complementa?

**Recomendação: complementa, não substitui**

- Fase 1 ("Pedir esclarecimento") = pergunta rápida de texto (< 50 caracteres)
  - Útil para dúvidas simples ("É realmente 380V?" / "Que dimensão de espaço?")
  - Resposta no email, cópia rápida

- Fase 2 (formulário estruturado) = validação completa
  - Útil para revisões complexas (vários itens, medidas, fotos)
  - Agente clica "Gerar formulário" quando há múltiplos items em revisão

**Painel mostra ambas opções** — agente escolhe conforme contexto.

---

## 8. Ligação entre items (produtos candidatos)

### Problema

"Máquina de lavar loiça" tem 5 candidatos no Meilisearch. Hoje o Fase 1 marca todos como "needs_review". Agente pede esclarecimento de uma vez só.

Idealmente, formulário deveria mostrar:
```
Qual destas opções mais se aproxima?

[] Máquina Túnel 1800 pratos/h (€10.405)
[] Máquina Túnel 1980 pratos/h (€13.699)
[] Máquina Túnel Industrial    (€14.906)
[] Máquina Bancada Compact     (€5.200)
[] Outro (especificar)
```

### Solução para Fase 2

Se há vários candidatos (armazenados em `quotation_items.candidates` ou em nova coleção `quotation_item_candidates`):

1. **IA gera pergunta:** "Qual destas máquinas é mais adequada?"
2. **Pergunta do tipo "choice"** com os candidatos como opções
3. **Cliente escolhe** → resposta guardada
4. **Agente vê a escolha** e fixa o item correto

Isto require:
- Nova coleção `quotation_item_candidates` (ou usar JSON em `quotation_items`)
- Passar candidatos para o IA no momento da geração
- Renderizar radio/checkbox com imagens + preço

---

## 9. Fluxo completo (Fase 2)

```
┌─────────────────────────────────────────────────────────┐
│ AGENTE vê proposta em rascunho (EmailProductSuggestions) │
└─────────────────────────────────────────────────────────┘
                          ↓
        [Alguns produtos precisam de confirmação]
        ┌─────────────────────────────┐
        │ [Pedir esclarecimento]       │  ← Fase 1
        │ [Gerar formulário]           │  ← Fase 2 NOVO
        └─────────────────────────────┘
                          ↓
                  (Clica "Gerar formulário")
                          ↓
        POST /ai-proxy: Gera 4 perguntas (IA)
                          ↓
        POST /items/product_specifications (4 registos)
                          ↓
        [✓ Formulário gerado]
        Link: https://proposta.hotelequip.pt/spec/{token}/item/{itemId}
        [Copiar link]
                          ↓
        (Agente envia link via email, WhatsApp, etc.)
                          ↓
    ┌──────────────────────────────────────────────────────┐
    │ CLIENTE clica link → PublicProductSpecification.tsx  │
    │ Lê `public_token` de URL                             │
    │ GET /items/quotation_items?filter[...]=itemId       │
    │ GET /items/product_specifications?filter[...]=itemId│
    │ Renderiza perguntas + espaço para respostas          │
    └──────────────────────────────────────────────────────┘
                          ↓
                  (Cliente responde tudo)
                          ↓
    (Client-side validação mínima — tipos corretos)
                          ↓
        PATCH /items/product_specifications/1 { answer_text: "...", status: "submitted" }
        PATCH /items/product_specifications/2 { answer_choice: "380V", status: "submitted" }
        PATCH /items/product_specifications/3 { answer_number: 1200, status: "submitted" }
        PATCH /items/product_specifications/4 { photo_url: "https://r2.../file.jpg", status: "submitted" }
                          ↓
                  [✓ Respostas enviadas]
                  Redirection → página de confirmação (ou fecho)
                          ↓
    ┌──────────────────────────────────────────────────────┐
    │ AGENTE recarrega painel (ou webhook n8n notifica)   │
    │ Vê `product_specifications` com status="submitted"   │
    │                                                      │
    │ [✓ Cliente respondeu]                               │
    │ Respostas:                                           │
    │ - Espaço: "1.5m × 2.0m"                             │
    │ - Voltagem: "380V trifásico"                        │
    │ - Pratos/hora: 1200                                 │
    │ - Foto: [visto]                                      │
    │                                                      │
    │ [Revisar] [Confirmar] [Ajustar SKU/preço]           │
    └──────────────────────────────────────────────────────┘
                          ↓
                (Agente confirma)
                          ↓
        PATCH /items/quotation_items/{itemId}
        { sku, unit_price, product_id, status: "confirmed" }
```

---

## 10. Perguntas em aberto & decisões finais

### Q1: Uma pergunta por item, ou múltiplas perguntas por item?

**Resposta: Múltiplas perguntas por item (3–5)**

Justificação:
- Especificação completa (dimensão + voltagem + uso + foto)
- Cada pergunta é um campo independente (não precisam estar tudo no mesmo item)
- IA pode priorizar: Q1 essencial, Q2 importante, Q3–5 nice-to-have

### Q2: Cache de perguntas?

**Resposta: Não cacher, gerar always inline**

Justificação:
- Contexto pode variar (razão de revisão é diferente)
- Custo é negligenciável (Haiku é barato)
- Mantém flexibilidade para ajustes futuros (ex: perguntas baseadas em histórico do cliente)

### Q3: Validação servidor vs cliente?

**Resposta: Mínima cliente-side, confiança em admin token**

Justificação:
- Cliente é untrusted (é público)
- Directus valida tipos (answer_text string, answer_number decimal)
- Admin token garante que escreve apenas no seu próprio item

### Q4: Quando pedir foto é opcional?

**Resposta: Decidir no prompt do IA**

Sugestão:
```
Se o tipo de dúvida é visual/espacial (dimensão, instalação, espaço),
  → type: "photo" (opcional)
Senão, omitir pergunta de foto.
```

---

## 11. Ficheiros a criar/modificar

### Novos

- `src/pages/PublicProductSpecification.tsx` — landing pública do formulário
- `src/components/proposals/public/SpecificationForm.tsx` — componente de perguntas/respostas
- `docs/product-specifications-schema.sql` — schema Directus (se manual)

### Modificar

- `src/App.tsx` — adicionar rota `/spec/:token/item/:itemId`
- `src/components/email/EmailProductSuggestions.tsx` — botão "Gerar formulário" + lógica de geração
- `src/integrations/directus/quotations.ts` — CRUD de `product_specifications`
- `src/integrations/ai/anthropicClient.ts` — novo prompt `promptProductSpecificationQuestions()`
- `CLAUDE.md` — atualizar regras & arquitetura

### Reutilizar

- `PublicQuotation.tsx` — padrão de token + autenticação pública
- `quotationPublic.ts` — funções `publicFetch()` e `directusAdminFetch()`
- `useMeilisearch()` — para buscar candidatos (se Q8 implementada)

---

## 12. Próximos passos (validação antes de código)

1. **Confirmar schema `product_specifications`** — campos, relações, permissões
2. **Confirmar rota pública** — `/spec/:token/item/:itemId` ou outro padrão?
3. **Confirmar prompt do IA** — formato JSON, 3–5 perguntas, validação de tipos
4. **Confirmar upload** — onde guardar fotos (R2)? Tamanho máximo? Nome de ficheiro?
5. **Confirmar notificação agente** — webhook n8n automático quando `product_specifications.status` muda para "submitted"?

---

## 13. Estimativa de complexidade

| Componente | Horas | Risco |
|---|---|---|
| Schema Directus | 0.5h | Baixo |
| Novo prompt IA + teste | 1h | Baixo |
| PublicProductSpecification.tsx | 4h | Médio (upload, validação) |
| Botão "Gerar formulário" + lógica | 2h | Baixo |
| CRUD `product_specifications` | 1h | Baixo |
| Upload de ficheiro (R2) | 1.5h | Médio (permissões S3) |
| Teste end-to-end | 2h | Médio |
| **Total** | **~11.5h** | — |

---

## Sumário & Recomendações

✅ **Reutilizar padrão público existente** — token opaco, `publicFetch()`, `directusAdminFetch()`

✅ **Nova coleção `product_specifications`** — guardar perguntas + respostas estruturadas

✅ **IA inline para perguntas** — Haiku gera 3–5 perguntas conforme contexto (produto + categoria + razão de revisão)

✅ **Complementa Fase 1** — não substitui "Pedir esclarecimento", apenas oferece alternativa estruturada

✅ **Upload de foto** — uma por item, via R2 (reutilizar padrão existente)

⚠️ **Decisão crítica:** Webhook n8n automático quando cliente responde? (recomendo sim, para notificar agente)

✅ **Validação design pronta para implementação** — avança directo para código.

---

**Documento preparado para validação.** Confirme padrões e permissões Directus antes de começar a codificar.
