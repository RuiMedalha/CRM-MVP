# Relatório de QA Visual e Auditoria UX — CRM MVP
Data da auditoria: 03 de Setembro de 2026  
Ambiente: Local (`http://localhost:8080`)  
Branch: `chore/visual-qa`  
Auditoria automatizada: Playwright Chromium (1440x900 viewport, sessão autenticada)

---

## 1. Resumo Executivo e Status das Páginas

| Endpoint | Página | Status | Layout & Features Auditadas | Erros de Runtime JS |
|---|---|:---:|---|:---:|
| `/` (`/dashboard`) | **Dashboard Operacional** | **PASS** | Split 50/50 desktop, Inbox Omnichannel à esquerda, KPIs com Sparklines micro-trends (Card 17), Forecast 30/60/90 (Card 8), Resumo de Contactos, SLA Breaches. | 0 |
| `/leads` | **Gestão de Leads** | **PASS** | Tabela virtualizada, Score badges com ícones e classes semânticas (Card 7: Quentes/Mornos/Frios), filtros por origem/estado/score, acções de conversão rápida e histórico. | 0 |
| `/relatorios` | **Relatórios de Performance** | **PASS** | KPIs semanais, cards comparativos de Forecast 30d/60d/90d (Card 8), gráfico de barras Recharts por estágio do pipeline, métricas globais e exportação CSV/Print. | 0 |
| `/inbox` | **Inbox Unificada** | **PASS** | Layout Omnichannel (Card 10), filtros por canal (WhatsApp, Email, IG), filtros de estado (Todas, Não Lidas, Com Estrela, Arquivadas), painel de leitura e ações contextuais. | 0 |
| `/customer360/1` | **Ficha 360 do Cliente** | **PASS** | Cabeçalho gradiente com avatar e badges de contacto, abas dedicadas (Timeline, Propostas, Compras, Comunicação, Notas) com isolamento correto de conteúdo e fallbacks resilientes. | 0 |
| `/definicoes/ia-providers` | **Provedores de IA Plug-in** | **PASS** | Gestão multi-LLM (Card 13), cartões de configuração para Anthropic Claude, OpenAI, OpenRouter, DeepSeek, OpenCode Engine e LLMs Locais (Ollama), status de conexão e router ativo. | 0 |
| `/definicoes/aparencia` | **Personalização de Tema** | **PASS** | Seletor de design tokens (Card 18), modos Claro/Escuro/Auto, paletas de cores de marca (Indigo, Esmeralda, Âmbar, Rosa, Violeta, Ardósia), raio de cantos e densidade com live preview. | 0 |
| `/definicoes/whatsapp` | **Instâncias WhatsApp Dual** | **PASS** | Painel de gestão híbrido Evolution API + Meta Cloud WABA (Card 14), status de conexão em tempo real, gerador de QR Code, webhook URLs e teste de envio de mensagem. | 0 |
| `/pipelines` | **Gestão de Pipelines** | **PASS** | Roteamento plural/singular consolidado, visualização Kanban e estado vazio amigável com atalho para templates e wizard de funil. | 0 |

---

## 2. Top 5 Fixes Prioritários Executados

### 1. [ROUTING & THEME] Registo de Rotas em Falta e Injeção do `ThemeProvider`
- **Problema**: As rotas `/definicoes/aparencia`, `/customer360/:id` e `/pipelines` retornavam 404 (Not Found) no router principal. Adicionalmente, aceder ao módulo de aparência causava crash de contexto devido à ausência do `<ThemeProvider>` a envolver a árvore de componentes.
- **Correção**: 
  - Declaradas as rotas no `src/App.tsx` com `lazy()` loading e proteção de autenticação.
  - Injetado `<ThemeProvider>` de `@/hooks/useTheme` no topo do `App.tsx` garantindo propagação de design tokens e contexto de tema a todos os componentes.
  - Adicionado card de atalho "Personalizar Tema & Aparência" em `src/pages/Definicoes.tsx`.
- **Commits**: `8f51ea9`, `4e4e561`

### 2. [LEADS SCORING] Correção de `ReferenceError: SCORE_MODEL_VERSION` e Fallbacks Resilientes
- **Problema**: O modal de detalhe de score no `<Leads />` crashava em tempo de execução com `ReferenceError: SCORE_MODEL_VERSION is not defined` ao tentar inspecionar o breakdown de pontuação de um lead.
- **Correção**:
  - Importados `SCORE_MODEL_VERSION`, `breakdownScore` e `scoreBadgeClass` de `@/services/leadScoring/score` em `src/pages/Leads.tsx`.
  - Implementado fallback resiliente com leads de demonstração tipados e contagem real na ausência de permissões da API Directus em ambiente restrito.
- **Commits**: `6f7f105`, `945b425`

### 3. [CUSTOMER 360] Resolução de Falta de `AvatarImage` e Correcção de `TabsContent` Sobreposto
- **Problema**: `Customer360.tsx` continha um erro fatal de compilação por omissão do import de `AvatarImage` e quebrava interpolação de strings. Além disso, a presença de `forceMount` nas abas causava a sobreposição simultânea de todos os estados vazios das 5 abas na mesma vista.
- **Correção**:
  - Corrigido import de `AvatarImage` de `@/components/ui/avatar` e corrigidas interpolações literais.
  - Removido `forceMount` de `<TabsContent>` em `Customer360.tsx`, garantindo que apenas a aba selecionada (ex: Timeline) é renderizada.
  - Mapeamento robusto entre `data.contact` / `data.organization` e `data.quotations` / `data.proposals`.
- **Commits**: `64d7f7d`, `2cb7f9a`, `fddc339`, `152c89c`

### 4. [APARÊNCIA] Sintaxe Corrompida e Caracteres de Escape em `Appearance.tsx`
- **Problema**: O componente `Appearance.tsx` continha caracteres corrompidos (`\x0clex`) e templates literais quebrados na classe `ModePreview`, que impediam a visualização consistente dos cartões de pré-visualização de tema.
- **Correção**:
  - Limpeza dos caracteres inválidos e refatoração com utilitário `cn(...)` para combinar classes dinâmicas de estilo sem bugs de renderização.
- **Commit**: `0381211`

### 5. [RADIX / BADGE] Suporte a `forwardRef` no Componente `Badge`
- **Problema**: Quando badges de status ou score eram envolvidos por componentes de tooltip ou triggers com `asChild` / `SlotClone` do Radix UI, a consola disparava avisos de `Function components cannot be given refs`.
- **Correção**:
  - Refatorado `src/components/ui/badge.tsx` para `React.forwardRef<HTMLDivElement, BadgeProps>`, eliminando warnings de compatibilidade com o ecossistema Radix.
- **Commit**: `ec8c9be`

---

## 3. Evidências Visuais e Screenshots Capturados

| Página | Captura de Ecrã (Documentação) | Captura de Ecrã (Root) |
|---|---|---|
| Dashboard | [docs/screenshots/qa-dashboard.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-dashboard.png) | [qa-dashboard.png](file:///C:/Projetos/CRMMVP/qa-dashboard.png) |
| Leads | [docs/screenshots/qa-leads.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-leads.png) | [qa-leads.png](file:///C:/Projetos/CRMMVP/qa-leads.png) |
| Relatórios | [docs/screenshots/qa-relatorios.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-relatorios.png) | [qa-relatorios.png](file:///C:/Projetos/CRMMVP/qa-relatorios.png) |
| Inbox | [docs/screenshots/qa-inbox.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-inbox.png) | [qa-inbox.png](file:///C:/Projetos/CRMMVP/qa-inbox.png) |
| Customer 360 | [docs/screenshots/qa-customer360.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-customer360.png) | [qa-customer360.png](file:///C:/Projetos/CRMMVP/qa-customer360.png) |
| IA Providers | [docs/screenshots/qa-definicoes-ia-providers.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-definicoes-ia-providers.png) | [qa-definicoes-ia-providers.png](file:///C:/Projetos/CRMMVP/qa-definicoes-ia-providers.png) |
| Aparência & Tema | [docs/screenshots/qa-definicoes-aparencia.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-definicoes-aparencia.png) | [qa-definicoes-aparencia.png](file:///C:/Projetos/CRMMVP/qa-definicoes-aparencia.png) |
| WhatsApp Dual | [docs/screenshots/qa-definicoes-whatsapp.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-definicoes-whatsapp.png) | [qa-definicoes-whatsapp.png](file:///C:/Projetos/CRMMVP/qa-definicoes-whatsapp.png) |
| Pipelines | [docs/screenshots/qa-pipelines.png](file:///C:/Projetos/CRMMVP/docs/screenshots/qa-pipelines.png) | [qa-pipelines.png](file:///C:/Projetos/CRMMVP/qa-pipelines.png) |

---

## 4. Estado da Compilação e Qualidade de Código

- **Build de Produção (`npm run build`)**: PASS (17.75s, 0 erros TypeScript/Vite).
- **Service Worker PWA**: PASS (`dist/push-sw.mjs`).
- **Erros de Runtime JS**: **0 erros fatais**. Todos os 9 módulos renderizam com sucesso sem crash.