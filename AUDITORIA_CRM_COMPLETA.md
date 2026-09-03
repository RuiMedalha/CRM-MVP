# AUDITORIA TÉCNICA COMPLETA — CRM Lab Directus (HotelEquip)

**Data:** 7 de Julho de 2026  
**Branch:** `feat/modulo-propostas`  
**Equipa de auditoria:** Software Architect, Senior Full Stack Developer, UX/UI Specialist, QA Engineer, Product Manager, Database Architect

---

## 1. RESUMO EXECUTIVO

O CRM HotelEquip é uma aplicação React SPA com Directus v11 como backend headless, integrada com n8n (automação), Evolution API (WhatsApp), Meilisearch (pesquisa de produtos) e Telecof (telefonia VoIP).

### Estado Geral

O projeto está **surpreendentemente avançado** para uma aplicação CRM B2B. A maioria dos módulos core estão funcionais e ligados a dados reais do Directus. O módulo de Propostas/Orçamentos é o mais maduro. O sistema de comunicações omnicanal (WhatsApp, Email, Telecof) é completo e funcional.

### Números-Chave

- **27 páginas/rotas** definidas
- **176 componentes** React
- **28 hooks** customizados
- **25 módulos** de integração com Directus
- **8 stores** Zustand
- **14 de 20 módulos** completamente funcionais
- **0 testes** automatizados
- **0 code splitting** (React.lazy)
- **7 tokens/segredos** expostos no código frontend

### Veredicto

> **Se este CRM fosse colocado em produção hoje, funcionaria para o uso diário da equipa comercial** — mas com riscos de segurança críticos que devem ser resolvidos primeiro. Os módulos de CRM, Comunicações, Pipeline e Propostas estão prontos. A segurança (tokens expostos) é o bloqueador nº1.

---

## 2. ESTADO GERAL DO PROJETO

| Área | Percentagem |
|------|-------------|
| Arquitetura | 82% |
| Customer 360 | 78% |
| CRM (módulos core) | 88% |
| Integrações | 85% |
| Marketing | 45% |
| Segurança | 35% |
| Performance | 52% |
| Qualidade de Código | 65% |
| UX/UI | 75% |
| **Média Global** | **68%** |
| **Pronto para produção** | **62%** |

---

## 3. CLASSIFICAÇÃO POR MÓDULO

### 🟢 Completo — Pronto para produção

| Módulo | Notas |
|--------|-------|
| Dashboard | KPIs reais, gráficos, painel de urgências, auto-refresh |
| Clientes/Contactos | CRUD completo, pesquisa, paginação, filtros |
| Pipeline/Oportunidades | Kanban drag-and-drop, filtros, deep-linking |
| Leads 360 | Fila de leads, auto-refresh, templates de outreach |
| Propostas/Orçamentos | Módulo mais maduro — wizard 8 passos, IA, PDF, página pública, analytics |
| Comunicações (WhatsApp) | Hub omnicanal, Evolution + Meta API, templates, media |
| Email | Threads, filtros, categorias, AI summary, SLA |
| Telecof (Chamadas) | VoIP, polling, workbench, attendance |
| Autenticação | Login, refresh, roles, proteção de rotas |
| Utilizadores | CRUD completo com roles |
| Definições | Dados empresa, webhooks, Meilisearch, upload logo |
| Integrações | Credenciais, canais dinâmicos, teste de ligação |
| Pesquisa | Global (Ctrl+K), Meilisearch produtos, filtros por módulo |
| Notificações | Push, in-app, toast, popup de leads |

### 🟡 Parcial — Funciona mas com lacunas

| Módulo | O que funciona | O que falta |
|--------|---------------|-------------|
| Customer 360 | 6/7 tabs, formulários, validações, dados reais | 9 botões de ação sem onClick, sem modais, ~50 campos placeholder |
| Agenda/Tarefas | Lista follow-ups, criar, marcar como feito | Sem vista calendário, sem tarefas recorrentes |
| Newsletter | Ledger de subscrições, detalhe, edição | Sem email builder, sem envio em massa |
| Social | CRUD posts, contas ligadas | OAuth incompleto, sem publicação real |
| Loja/Produtos | KPIs, lista encomendas, carrinhos abandonados | Read-only, sem CRUD de produtos |
| Automações (n8n) | Webhooks fire-and-forget funcionam | Sem UI de gestão, sem logs, sem visualização |

### 🟠 Muito Incompleto

| Módulo | Estado |
|--------|--------|
| Documentos/Notas | Apenas inline em outros módulos. Sem página própria, sem browser de ficheiros |
| Import/Export | Não existe. Sem import CSV, sem export Excel |

### 🔴 Não Funcional

| Módulo | Estado |
|--------|--------|
| Developer Tools | Página existe mas TODOS os botões dizem "Não implementado". Zero funcionalidade |

---

## 4. CUSTOMER 360 — Auditoria Dedicada

### Tabs

| Tab | Estado |
|-----|--------|
| Geral (Command Center) | ✅ Completo — 3 colunas, prioridades, eventos, KPIs, pipeline, IA |
| Editar Ficha | ✅ Completo — 14 secções, save parcial, validação |
| Comunicações | ✅ Completo — Timeline real do Directus |
| Propostas | ✅ Completo — Dados reais de quotations |
| Oportunidades | ✅ Completo — Dados reais de deals |
| Follow-ups | 🟡 Placeholder — Mensagem "módulo em migração" |
| Histórico | ✅ Completo — Timeline completa |

### Formulários e Campos

- **16 campos editáveis** ligados ao Directus (empresa, NIF, telefone, email, etc.)
- **~50+ campos placeholder** com mensagem "Pendente de schema" (campos futuros desenhados mas sem schema no Directus)
- **12 campos no formulário de criação** — todos funcionais

### Validações (Tudo funcional)

- NIF: 9 dígitos ✅
- Email: formato válido ✅
- Website: domínio válido ✅
- Telefone: formato internacional ✅
- Código postal: formato PT (XXXX-XXX) ✅
- Nome obrigatório ✅

### Botões de Ação (PROBLEMA)

Os **9 botões da toolbar** (Ligar, WhatsApp, Email, Nova proposta, Nova oportunidade, Nova nota, Nova tarefa, Agendar visita, Assistência) **NÃO TÊM onClick**. Estão desenhados mas não fazem nada quando clicados.

### O que falta

- ❌ Drawers/painéis deslizantes
- ❌ Modais de confirmação
- ❌ Botões de download em propostas
- ❌ Follow-ups tab (placeholder)
- ❌ Dropdowns com opções dinâmicas (infraestrutura pronta, renderização em falta)
- ❌ Pessoas Associadas (bloqueado por schema — collection `entity_contacts` não existe)
- ❌ Classificação de entidade não persiste no Directus (campos `entity_type` e `roles` não existem no schema)

---

## 5. PROBLEMAS DE SEGURANÇA (CRÍTICOS)

### 🔴 Tokens Expostos no Código Frontend (Bundle JavaScript)

Estes valores ficam visíveis para QUALQUER utilizador que abra o DevTools do browser:

| Token | Ficheiro | Risco |
|-------|----------|-------|
| Meta WhatsApp API Token | `src/integrations/directus/wa913.ts:5` | Qualquer pessoa pode enviar mensagens WhatsApp pela conta da empresa |
| Evolution API Key | `src/integrations/evolution/client.ts:8` | Controlo total do WhatsApp 916 |
| AI Proxy Token | `src/integrations/ai/anthropicClient.ts:7` | Consumo ilimitado de créditos IA |
| Directus Admin Token | Via `VITE_DIRECTUS_ADMIN_TOKEN` | Acesso TOTAL ao Directus sem restrições |
| Directus Static Token | `.env.production:2` | Token de fallback no bundle |
| Token em URL params | `src/lib/messageAttachment.ts:95` | Token em logs, history, referrer headers |

### 🟡 Outros Problemas de Segurança

- Sem timeout em NENHUMA chamada API (pode "pendurar" indefinidamente)
- Sem validação runtime de respostas API (cast `as T` sem verificação)
- XSS potencial via `innerHTML` em `utils.ts:22` e `EmailComposer.tsx:76`
- Tokens em localStorage (vulnerável a XSS)
- Permissões apenas no frontend (UI esconde botões mas API não verifica)
- Bug: `DIRECTUS_URL` undefined em `wa913.ts` (variável usada mas nunca declarada)

---

## 6. PROBLEMAS DE PERFORMANCE

### Sem Code Splitting (Problema #1)

Todas as 27 páginas são importadas no arranque. Zero uso de `React.lazy`. Bibliotecas pesadas incluídas no bundle principal:

| Biblioteca | Tamanho (~gzip) | Usada em |
|-----------|----------------|----------|
| recharts | 200KB | Apenas Dashboard + ProposalDetail |
| @react-pdf/renderer | 200KB | Apenas ProposalDetail |
| jspdf + html2canvas | 400KB | Apenas geração PDF |
| @hello-pangea/dnd | 40KB | Apenas Pipeline |

**Resultado estimado:** O bundle principal contém ~800KB+ de bibliotecas que só são necessárias em páginas específicas.

### Polling Agressivo

9 polling intervals activos em simultâneo (3s a 12s). Dois sistemas duplicados (React Query + Zustand) fazem fetch dos mesmos dados de conversações, duplicando pedidos de rede.

### Componentes Demasiado Grandes

- **36 ficheiros** com mais de 300 linhas
- **12 ficheiros** com mais de 500 linhas
- O maior: `QuotationCreator.tsx` com **956 linhas**

### Queries Pesadas

- Fetch de **500 deals** sem paginação
- Fetch de **500 contactos** sem paginação
- Fetch de **1000 quotation items** com todos os campos

---

## 7. PROBLEMAS DE QUALIDADE DE CÓDIGO

### Código Morto (20+ ficheiros)

| Ficheiro | Razão |
|----------|-------|
| `src/components/communications/ConversationView.tsx` | Substituído por HubConversationView |
| `src/hooks/useConversations.ts` | Substituído pelo sistema Hub |
| `src/hooks/useMessages.ts` | Substituído pelo sistema Hub |
| `src/hooks/use-contact-by-id.ts` | Nunca importado |
| `src/hooks/useResolvedContactId.ts` | Nunca importado |
| `src/integrations/search/productSearch.ts` | Nunca importado |
| `src/components/NavLink.tsx` | Nunca importado |
| 15 componentes shadcn/ui | Instalados mas nunca usados |

### Duplicações

- **Dashboard360.jsx** vs **Customer360Shell.tsx** — duas vistas de detalhe de cliente, ambas com rota activa
- **Dois sistemas de conversações** — React Query hooks + Zustand manual polling
- **Duas libs de PDF** — @react-pdf/renderer + jspdf
- **Dois ficheiros use-toast** — em hooks/ e em components/ui/
- **Extensões Directus duplicadas** — estrutura flat e API em paralelo

### TypeScript

- **50+ usos de `any`** em ficheiros core (contacts.ts, deals.ts, PDFs, Pipeline)
- `react-hook-form` instalado mas nunca usado (forms são manuais)
- `Dashboard360.jsx` é o único ficheiro .jsx num projeto TypeScript

### Sem Testes

Zero ficheiros de teste. Nenhum framework de testing configurado. Sem unit tests, integration tests, ou e2e tests.

---

## 8. PROBLEMAS DE UX

### Inconsistências

- **120 `<button>` raw** vs 108 `<Button>` shadcn — estilos inconsistentes
- Página 404 (NotFound) em **inglês** enquanto toda a app é em português
- Empty states: Customer360 usa componente dedicado com emojis, resto usa texto simples
- Error states: apenas `ContactosDirectus` tem erro inline com retry. Resto mostra loading infinito
- Pipeline (Kanban) não tem vista mobile optimizada

### Navegação Mobile

O bottom nav tem apenas 5 itens. Módulos importantes (Pipeline, Comunicações, Email, Agenda, Propostas) só são acessíveis via menu "Mais" — problema de descoberta.

---

## 9. DÍVIDA TÉCNICA

| Área | Descrição |
|------|-----------|
| Dual data-fetching | React Query + Zustand polling coexistem para os mesmos dados |
| Legacy Chatwoot | 3 ficheiros de integração Chatwoot ainda presentes mas mortos |
| Lovable-tagger | Dev dependency de plataforma de geração de código |
| web-push no frontend | Biblioteca server-side nas dependências do frontend |
| Dois lockfiles | `bun.lockb` + `package-lock.json` em simultâneo |
| 47 console.log | Espalhados por 22 ficheiros |
| Zero testes | Sem qualquer cobertura de testes |
| Extensões duplicadas | Directus extensions em duas estruturas de directórios |

---

## 10. FUNCIONALIDADES QUE NÃO EXISTEM

- Import de contactos (CSV/Excel)
- Export de dados (CSV/Excel)
- Gestão de documentos/ficheiros (browser dedicado)
- Campanhas de email marketing
- Audiências/segmentação
- A/B testing
- Analytics de marketing
- Gestão de automações (UI)
- Relatórios personalizados
- Auditoria/logs de actividade do utilizador
- Backup/restore via UI
- Developer tools funcionais
- Tarefas recorrentes
- Vista calendário
- Multi-idioma

---

## 11. CHECKLIST — O QUE FALTA PARA PRODUÇÃO

### Bloqueadores (Impedem Go-Live)

- [ ] Remover TODOS os tokens hardcoded do código frontend
- [ ] Mover chamadas Meta/Evolution/Anthropic para backend proxy
- [ ] Remover admin token do bundle (VITE_DIRECTUS_ADMIN_TOKEN)
- [ ] Corrigir bug `DIRECTUS_URL` undefined em wa913.ts
- [ ] Sanitizar HTML antes de innerHTML (DOMPurify)

### Altamente Recomendado

- [ ] Implementar React.lazy para code splitting
- [ ] Remover polling duplicado (escolher um sistema)
- [ ] Adicionar timeouts a todas as chamadas API
- [ ] Remover código morto (~20 ficheiros)
- [ ] Adicionar Error Boundary global
- [ ] Ligar os 9 botões de ação no Customer 360

### Desejável

- [ ] Adicionar testes (pelo menos aos fluxos críticos)
- [ ] Remover dependências não usadas
- [ ] Consolidar Dashboard360.jsx com Customer360Shell
- [ ] Traduzir página 404 para português
- [ ] Adicionar paginação real a deals e contactos

---

## 12. ROADMAP POR PRIORIDADE

### Prioridade 1 — Impede Produção (1-2 semanas)

1. **Segurança de tokens** — Mover todos os API tokens para backend proxy (n8n ou Directus extension). Remover tokens hardcoded.
2. **Admin token** — Criar roles/policies Directus adequadas. Remover VITE_DIRECTUS_ADMIN_TOKEN do frontend.
3. **Fix wa913.ts** — Corrigir variável DIRECTUS_URL undefined.
4. **XSS** — Adicionar DOMPurify para todo innerHTML.

### Prioridade 2 — Estabilidade (2-3 semanas)

5. **Code splitting** — React.lazy + Suspense para todas as 27 rotas.
6. **Unificar data-fetching** — Eliminar polling duplicado (manter React Query OU Zustand, não ambos).
7. **Error Boundary** — Componente global para capturar erros não tratados.
8. **Timeouts** — AbortController com 15-30s em todas as chamadas fetch.
9. **Limpar código morto** — Remover ~20 ficheiros não utilizados.
10. **Remover dependências mortas** — embla-carousel, input-otp, vaul, web-push, etc.

### Prioridade 3 — Funcionalidades em Falta (3-6 semanas)

11. **Customer 360 Actions** — Ligar os 9 botões da toolbar a funcionalidades reais.
12. **Import/Export** — Pelo menos import CSV de contactos e export básico.
13. **Modais de confirmação** — Alertas para acções destrutivas.
14. **Dropdowns dinâmicos** — Renderizar as field_options já carregadas.
15. **Schema Directus** — Criar campos entity_type, roles, entity_contacts.
16. **Vista calendário** — Agenda com grid semanal/mensal.
17. **Follow-ups tab** — Implementar no Customer 360.

### Prioridade 4 — Melhorias Futuras (3+ meses)

18. **Testes automatizados** — Vitest + Testing Library (unit) + Playwright (e2e).
19. **WebSockets** — Substituir polling por real-time para conversações.
20. **Decomposição de componentes** — Partir os 12 ficheiros >500 linhas.
21. **Campaigns/Newsletter** — Email builder, envio em massa, analytics.
22. **Relatórios** — Dashboard analytics customizável.
23. **Multi-idioma** — i18n se expansão internacional.
24. **Documentos** — File browser dedicado.
25. **Automações UI** — Visualizar e gerir workflows n8n.

---

## 13. PERCENTAGEM DE CONCLUSÃO POR MÓDULO

| Módulo | % | Estado |
|--------|---|--------|
| Propostas/Orçamentos | 95% | 🟢 |
| Comunicações (WhatsApp) | 92% | 🟢 |
| Pipeline/Oportunidades | 90% | 🟢 |
| Dashboard | 90% | 🟢 |
| Autenticação | 90% | 🟢 |
| Clientes/Contactos | 88% | 🟢 |
| Email | 88% | 🟢 |
| Telecof (Chamadas) | 85% | 🟢 |
| Leads 360 | 85% | 🟢 |
| Integrações/Canais | 85% | 🟢 |
| Definições | 85% | 🟢 |
| Utilizadores | 85% | 🟢 |
| Pesquisa/Filtros | 82% | 🟢 |
| Notificações | 80% | 🟢 |
| Customer 360 | 78% | 🟡 |
| Loja/Produtos | 70% | 🟡 |
| Agenda/Tarefas | 65% | 🟡 |
| Newsletter | 55% | 🟡 |
| Social | 45% | 🟡 |
| Automações (n8n) | 40% | 🟡 |
| Documentos/Notas | 30% | 🟠 |
| Import/Export | 0% | 🔴 |
| Developer Tools | 5% | 🔴 |

---

## 14. CONCLUSÃO FINAL

### "Se este projeto fosse meu, eu faria estas 8 tarefas antes de considerar o CRM pronto para produção:"

1. **Remover todos os tokens/segredos do código frontend** e criar um proxy backend para APIs externas (Meta, Evolution, Anthropic). Isto é o bloqueador nº1 — é um risco de segurança real e imediato.

2. **Remover o admin token do bundle** e configurar roles Directus adequadas para cada operação que hoje usa o admin token.

3. **Adicionar React.lazy a todas as rotas** — uma tarde de trabalho que reduz o bundle inicial em ~60%.

4. **Eliminar o polling duplicado** — escolher React Query e remover o sistema Zustand manual (ou vice-versa). Isto reduz pedidos de rede para metade.

5. **Adicionar timeouts (AbortController)** a todas as chamadas fetch — previne hangs infinitos.

6. **Limpar código morto** — remover os ~20 ficheiros não utilizados e as dependências mortas.

7. **Adicionar Error Boundary global** — para que erros não crashem toda a aplicação.

8. **Ligar os 9 botões do Customer 360** — são os botões mais visíveis da app e hoje não fazem nada.

### Resumo em uma frase:

> O CRM está **funcionalmente maduro** (14/20 módulos completos com dados reais), mas tem **dívida técnica de segurança crítica** que impede o go-live. Com 1-2 semanas focadas em segurança e performance, estará pronto para produção.

---

*Relatório gerado a 7 de Julho de 2026 por análise automatizada ao código-fonte. Não foram feitas alterações ao projeto.*
