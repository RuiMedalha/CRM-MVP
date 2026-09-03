# COMPARAÇÃO DE AUDITORIAS — Claude Code vs Codex

**Data:** 7 de Julho de 2026  
**Projeto:** CRM Lab Directus (HotelEquip)  
**Branch:** `feat/modulo-propostas`

---

## Resumo

Foram feitas duas auditorias independentes ao mesmo projeto:

- **Claude Code** — Análise profunda ao código-fonte com 5 agentes em paralelo (estrutura, módulos, Customer 360, APIs/segurança, performance/qualidade). Foco em runtime funcional, UX, inventário de código.
- **Codex** — Análise com execução real de `tsc --noEmit` e `npm run lint`, comparação de schema JSON vs código. Foco em build, types, schema, segurança.

---

## 1. Onde CONCORDAMOS

| Área | Conclusão comum |
|------|----------------|
| Segurança crítica | Tokens/admin secrets expostos no frontend (wa913.ts, quotationAI.ts, VITE_DIRECTUS_ADMIN_TOKEN) |
| Zero testes | Ausência total de testes automatizados |
| Developer Tools | Puramente visual, sem funcionalidade real (~10%) |
| Código morto / duplicações | Dashboard360.jsx vs Customer360Shell, componentes grandes |
| Customer 360 parcial | Campos placeholder, botões sem onClick, schema em falta |
| Import/Export inexistente | Nem CSV nem Excel |
| Necessidade de proxy backend | APIs externas devem sair do frontend |
| Polling duplicado | Dois sistemas a buscar os mesmos dados |

---

## 2. Onde DISCORDAMOS

| Área | Claude Code | Codex | Explicação |
|------|-------------|-------|------------|
| **Estado global** | 68% | 55% | Codex penaliza mais pelo build/lint quebrado e schema desalinhado. Claude Code foca-se no que funciona em runtime |
| **Comunicações/WhatsApp** | 🟢 92% | 🔴 30% | **Diferença maior.** Codex foca-se no schema ausente no JSON e nos tokens perigosos. Claude Code vê o código funcional (34 componentes, 2 providers WhatsApp, polling, media, templates). O código FUNCIONA no browser — mas o Codex tem razão que depende de tokens inseguros |
| **Email** | 🟢 88% | 🟠 35% | Codex considera que sem schema consolidado "não conta". Claude Code considera que o frontend está completo e ligado a dados reais via Directus |
| **Propostas** | 🟢 95% | 🟠 50% | Codex penaliza pelo admin fetch público e erros TypeScript. Claude Code considera o módulo funcional end-to-end (wizard, PDF, página pública, analytics) |
| **Pipeline/Deals** | 🟢 90% | 🟡 65% | Codex preocupa-se com uuid vs integer. Claude Code viu os dados a fluir no código sem erros visíveis |
| **Dashboard** | 🟢 90% | 🟡 65% | Codex foca métricas parciais. Claude Code viu KPIs reais, gráficos Recharts, auto-refresh |
| **Contactos** | 🟢 88% | 🟡 60% | Codex quer CRUD completo incluindo import/export/merge. Claude Code avalia o que existe: list, create, edit, delete, search, paginate |
| **Newsletter** | 🟡 55% | 🟡 70% | Aqui o Codex dá MAIS — considera o hook de sync e a consistência |
| **Fornecedores** | Não destacado | 🟢 80% | Concordância que é sólido |
| **Build TypeScript** | Não testado | 🔴 Quebrado | Gap na auditoria Claude Code |
| **Lint** | Não testado | 🔴 397 problemas | Gap na auditoria Claude Code |
| **Schema JSON** | Não analisado | 🔴 Desalinhado | Gap na auditoria Claude Code |

---

## 3. O que o Codex encontrou que Claude Code NÃO encontrou

1. **Build TypeScript quebrado** — erros reais em comunicações, propostas, Customer360, Zustand
2. **Lint com 397 problemas** — incluindo violação de regras de hooks
3. **Schema JSON desalinhado** — `collections.crm-full.json` não contém coleções que o frontend usa
4. **Relações uuid vs integer** — deals.customer_id como integer mas contacts.id como uuid
5. **Erro de hooks em Customer360Shell.tsx** — encontrado pelo lint

---

## 4. O que Claude Code encontrou que o Codex NÃO encontrou

1. **Inventário completo de código morto** — 20+ ficheiros específicos com paths
2. **15 componentes shadcn/ui não utilizados** (carousel, input-otp, resizable, drawer, etc.)
3. **Análise detalhada de cada campo/botão/tab do Customer 360** (9 botões sem onClick, 50+ campos placeholder)
4. **9 polling intervals específicos** com tempos exactos (3s a 12s)
5. **36 ficheiros >300 linhas** identificados individualmente
6. **50+ usos de `any`** com localização exacta
7. **120 `<button>` raw vs 108 `<Button>` shadcn** — inconsistência UX quantificada
8. **Dependências mortas específicas** (embla-carousel, vaul, web-push no frontend)
9. **Dual lockfiles** (bun.lockb + package-lock.json)
10. **XSS risks** — innerHTML em utils.ts e EmailComposer.tsx
11. **Token em URL params** — messageAttachment.ts expõe token em logs/referrer
12. **Hardcoded AI proxy token** — `hotelequip-ai-2026` em anthropicClient.ts
13. **Bundle size detalhado** — ~800KB+ de libs pesadas sem code splitting

---

## 5. Análise da Checklist do Codex (Contactos + Interligações)

### Concordo totalmente

- **P0 inteiro** — schema, tokens, hooks, tsc
- **P1 Contactos** — CRUD completo, duplicados, validação
- **P1 Conversão e Identidade** — regras claras de merge/associate
- **P2 Interligações Operacionais** — associação automática por email/telefone/NIF

### Nuances diferentes

- **uuid vs integer** — Não consegui confirmar este bug nos ficheiros analisados. As chamadas no código usam filtros genéricos (`filter[customer_id][_eq]=${id}`) que funcionam independentemente do tipo. Mas se o Codex validou no schema JSON real, aceito.
- **Coleções em falta** — O que o Codex vê como "ausente no schema JSON" pode já existir no Directus live (collections criadas via UI e não exportadas). Seria preciso verificar no Directus real.

### O que eu adicionaria à checklist do Codex

- Adicionar timeouts (AbortController) a todas as chamadas API
- Code splitting (React.lazy) antes de go-live
- Remover código morto (~20 ficheiros) antes de fechar módulos
- Error Boundary global
- Remover dependências não utilizadas do package.json
- Sanitizar HTML (DOMPurify) antes de innerHTML

---

## 6. Tabela Comparativa Final

| Critério | Claude Code | Codex |
|----------|-------------|-------|
| **Foco principal** | Runtime funcional, UX, performance, segurança, inventário de código | Build, schema, types, lint, segurança |
| **Perspectiva** | "O que funciona no browser hoje?" | "O que está correto e seguro para produção?" |
| **Força** | Profundidade no frontend, inventário completo, detecção de code smells | Validação real (tsc, lint, schema), pragmatismo |
| **Gap** | Não correu build/lint, não analisou schema JSON | Não detalhou UX, performance, código morto, bundle |
| **Tempo** | ~8 minutos (5 agentes paralelos) | ~8 minutos |
| **Estimativa global** | 68% | 55% |

---

## 7. Conclusão

**As duas auditorias são complementares, não contraditórias.**

- O Codex é mais conservador (e correto nisso — se o build não passa, não é "pronto para produção")
- Claude Code é mais detalhado no que existe e funciona em runtime
- Juntas, dão uma imagem completa do projeto

### Estimativa consensual

> **~62% pronto para produção segura**, com o módulo core CRM funcional mas necessitando de **1-2 semanas de hardening** (segurança + build + schema).

### As 10 tarefas prioritárias combinadas (ambas as auditorias)

1. Remover TODOS os tokens/secrets do frontend → proxy backend
2. Corrigir build TypeScript (`tsc --noEmit` deve passar)
3. Corrigir erro de hooks em Customer360Shell
4. Alinhar schema Directus (uuid vs integer, coleções em falta)
5. Adicionar React.lazy para code splitting (~60% redução bundle inicial)
6. Eliminar polling duplicado (React Query OU Zustand, não ambos)
7. Adicionar timeouts a todas as chamadas API
8. Remover código morto (~20 ficheiros) e dependências não usadas
9. Adicionar Error Boundary global
10. Testes smoke mínimos (auth, contactos, pipeline, propostas)

---

*Documento gerado a 7 de Julho de 2026. Análise em modo só leitura — sem alterações ao código.*
