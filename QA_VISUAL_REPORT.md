# QA Visual — Dark Mode + Mobile (375px)

## Data do Teste: 10 Julho 2026
## Scope: /comunicacoes, /contactos, /pipeline, /agenda, painéis legacy

---

## ⚠️ PROBLEMAS ENCONTRADOS

### 1. /comunicacoes (Inbox Unificado)

#### Dark Mode
- **Ficheiro:** `src/components/communications/InboxFiltersBar.tsx`
  - **Linha:** ~45-60 (filter pills)
  - **Problema:** Badge com background `bg-amber-500/10` + text `text-amber-700` em dark mode fica ilegível (texto castanho-claro sobre fundo castanho escuro)
  - **Severidade:** Alta — filtros ativos não se distinguem bem
  - **Solução proposta:** usar `dark:text-amber-300` para melhor contraste

- **Ficheiro:** `src/components/communications/MessageBubble.tsx`
  - **Linha:** ~80-90 (timestamp)
  - **Problema:** Timestamp com `text-muted-foreground` fica muito desbotado em dark mode (praticamente invisível)
  - **Severidade:** Média — informação menos crítica mas prejudica legibilidade

#### Mobile (375px)
- **Ficheiro:** `src/components/communications/ConversationList.tsx`
  - **Linha:** ~120-150 (list items)
  - **Problema:** Nomes de contactos longos ultrapassam o espaço disponível sem truncate, sobrepõem-se ao status badge
  - **Severidade:** Média — UI quebrada em mobile com nomes longos

- **Ficheiro:** `src/components/communications/MessageContent.tsx`
  - **Linha:** ~200-250 (media attachments)
  - **Problema:** Imagens/vídeos em cards ficam muito pequenos (w-40 h-40) — difícil clickar em mobile, texto "Abrir" fica cortado
  - **Severidade:** Média — UX prejudicada mas funcional

---

### 2. /contactos (ContactosDirectus.tsx + Customer360Hub)

#### Dark Mode
- **Ficheiro:** `src/pages/ContactosDirectus.tsx`
  - **Linha:** 388-389 (IA Score filter pills — "cold")
  - **Problema:** Pill "Frio" com `bg-slate-200 border-border text-muted-foreground dark:bg-slate-700 dark:text-slate-300` — em dark mode, slate-700 é muito próximo do bg do card, resultando em baixo contraste
  - **Severidade:** Média — difícil distinguir qual pill está selected
  - **Status:** JÁ CORRIGIDO nesta sessão para `bg-muted`

- **Ficheiro:** `src/components/contacts/DuplicatePanel.tsx` (se existir)
  - **Linha:** TBD
  - **Problema:** Se painéis legacy usam cores hardcoded (slate/violet), podem ter contraste baixo
  - **Severidade:** Baixa — painel é de uso ocasional

#### Mobile (375px)
- **Ficheiro:** `src/pages/ContactosDirectus.tsx`
  - **Linha:** 453-598 (mobile cards)
  - **Problema:** Badges ("Em curso", "Negócios") ficam empilhadas verticalmente num espaço muito apertado (flex flex-col items-end gap-1), cortando-se
  - **Severidade:** Média — informação truncada

- **Ficheiro:** `src/pages/ContactosDirectus.tsx`
  - **Linha:** 516-594 (button row em mobile)
  - **Problema:** Botões "Orçamento", "Pipeline", "Ligar", "WhatsApp", "Email" (5 botões) num espaço de 375px ficam muito pequenos e sobrepostos (flex flex-wrap gap-2)
  - **Severidade:** Alta — botões praticamente não clicáveis

---

### 3. /pipeline (Pipeline.tsx)

#### Dark Mode
- **Ficheiro:** `src/pages/Pipeline.tsx`
  - **Linha:** 183-186 (filter badge)
  - **Problema:** Badge `variant="destructive"` com `bg-red-100 text-red-800` em dark mode fica muito desbotado — not clear que há filtros activos
  - **Severidade:** Baixa — visual feedback menos óbvio, mas ainda funcional

- **Ficheiro:** `src/components/deals/DealCard.tsx`
  - **Linha:** TBD (card backgrounds)
  - **Problema:** Se cards usam cores hardcoded para status (lead, proposta, ganho, perdido), podem ter contraste insuficiente em dark mode
  - **Severidade:** Média — informação de status pode ficar ilegível

#### Mobile (375px)
- **Ficheiro:** `src/pages/Pipeline.tsx`
  - **Linha:** 396-516 (desktop Kanban — not visible em mobile)
  - **Problema:** Mobile view (linhas 325-394) mostra lista em vez de Kanban — OK. MAS o collapsible filter panel (linhas 197-296) fica muito grande, ocupando quase todo o viewport
  - **Severidade:** Média — UX prejudicada, força o utilizador a fazer scroll para ver deals

---

### 4. /agenda (Agenda.tsx)

#### Dark Mode
- **Ficheiro:** `src/pages/Agenda.tsx` (se tiver vista de calendário)
  - **Linha:** TBD
  - **Problema:** Se o calendário usa cores hardcoded (event backgrounds, borders), podem ter contraste baixo
  - **Severidade:** Desconhecido — não foi confirmado se há calendário visual ou se é lista

#### Mobile (375px)
- **Ficheiro:** `src/pages/Agenda.tsx`
  - **Problema:** Calendários (se implementado com library tipo `react-calendar`) podem ter UI cortada ou ilegível em 375px (células de data muito pequenas)
  - **Severidade:** Desconhecido — depende da implementação

---

### 5. Painéis Legacy (Customer360Hub, etc.)

#### Dark Mode
- **Ficheiro:** `src/components/customer360/FollowUpsPanel.tsx`
  - **Linha:** 40-42 (status badges)
  - **Problema:** `cancelled: "bg-slate-100 text-muted-foreground border-border"` (JÁ CORRIGIDO nesta sessão para `bg-muted`, mas o campo original era hardcoded slate)
  - **Severidade:** Baixa — já corrigido

- **Ficheiro:** `src/components/customer360/TimelinePanel.tsx`
  - **Linha:** 18-33 (TYPE_CONFIG)
  - **Problema:** Cores de eventos (email: blue-50/blue-600, whatsapp: green-50/green-600, etc.) — em dark mode, os bg com `/50` (muito claros) ficam ilegíveis
  - **Severidade:** Alta — timeline fica confusa em dark mode
  - **Exemplo:** `email: { bg: "bg-blue-50" }` em dark mode parece estar "off" (fundo muito claro)

- **Ficheiro:** `src/components/email/EmailProductSuggestions.tsx`
  - **Linha:** 81 (IA button)
  - **Problema:** IA button com `bg-violet-50 text-violet-700 border-violet-200` em dark mode (JÁ CORRIGIDO nesta sessão para `bg-primary/10`)
  - **Severidade:** Baixa — já corrigido

#### Mobile (375px)
- **Ficheiro:** `src/components/customer360/TimelinePanel.tsx`
  - **Linha:** 76-120 (timeline items)
  - **Problema:** Timeline layout (grid com ícone + texto + timestamp) fica apertado em 375px — timestamp pode ficar wrapped ou cortado
  - **Severidade:** Baixa — informação ainda presente, só esteticamente menos elegante

- **Ficheiro:** `src/components/customer360/edit/EditGeneralTab.tsx`
  - **Linha:** TBD
  - **Problema:** Formulários podem ter inputs ou selects largos demais para 375px
  - **Severidade:** Desconhecido — depende da implementação de form layout

---

## 📋 SUMÁRIO POR SEVERIDADE

### 🔴 Alta (UX quebrada / informação ilegível)
1. **/contactos mobile:** 5 botões sobrepostos (Orçamento, Pipeline, Ligar, WA, Email) — botões não clicáveis
2. **/comunicacoes dark:** Badge amber em filter pills com baixo contraste
3. **/customer360 dark:** Timeline colors (bg-blue-50, etc.) ilegível em dark mode

### 🟡 Média (UX prejudicada mas funcional)
1. **/comunicacoes mobile:** Nomes de contactos ultrapassam espaço, sobrepõem-se a badges
2. **/comunicacoes mobile:** Media attachments (images) muito pequenos para mobile
3. **/contactos mobile:** Badges empilhadas e cortadas
4. **/pipeline dark:** Filter badge destructive muito desbotado
5. **/pipeline mobile:** Filter panel collapsa todo o viewport
6. **/comunicacoes dark:** Timestamps muito desbotados (text-muted-foreground)

### 🟢 Baixa (visual menos elegante / info de menos relevância)
1. **/customer360 mobile:** Timeline items ficam apertados (timestamp wrapped)
2. **/agenda:** Depende da implementação — requer inspecção

---

## 🔧 RECOMENDAÇÕES IMEDIATAS

1. **TimelinePanel.tsx (dark mode):** Substituir `bg-*-50` por `bg-*-900/20` ou `bg-*-700` para melhor contraste
   - Exemplo: `email: { bg: "dark:bg-blue-900/30 bg-blue-50" }`

2. **/contactos mobile (button layout):** Considerar layout em 2x3 grid (2 colunas) em vez de flex row para buttons
   - Ou usar `flex flex-col gap-1` para empilhar verticalmente

3. **/pipeline mobile:** Fazer o filter panel colapsado por defeito em viewport < 768px

4. **Comunicacoes mobile (contact names):** Adicionar `truncate` ao nome + usar `flex-1 min-w-0`

---

## 📸 COMO REPRODUZIR

1. Abrir DevTools → F12
2. Togcar dark mode: `Appearance` tab ou `prefers-color-scheme`
3. Device toolbar: width 375px, height 800px (mobile portrait)
4. Navegar para cada página e verificar os pontos acima

---

## PRÓXIMOS PASSOS

1. Utilizador revê a lista e decide quais problemas corrigir
2. Priorizar por severidade (Alta → Média → Baixa)
3. Criar tasks para cada correção
4. Testar em dark mode + mobile após cada correção
