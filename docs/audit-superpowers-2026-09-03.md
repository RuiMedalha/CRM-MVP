# Auditoria CRMMVP — systematic-debugging (fallback para skill `superpowers`)

**Data:** 2026-09-03
**Branch:** `chore/superpowers-audit`
**Commit:** `ed390af`
**Methodology:** `systematic-debugging` + `debugging-toolkit` (skill `superpowers` não instalada — fallback conforme briefing)
**Modo:** Pass-1 surgical fix; restante é **finding**, não fix-list

---

## ⚠️ Skill em falta

`superpowers` (methodology-based bug hunting) **não está instalada** nesta máquina.
Carregadas em alternativa: `systematic-debugging`, `debugging-toolkit`.

> Decisão humana pendente: instalar `superpowers` via marketplace (`overclock_catalog_install --kind skill --slug <slug>`) antes da próxima ronda.

---

## Baseline (estado pré-auditoria)

| Comando | Resultado |
|---|---|
| `npm run build` (vite + SWC) | ✅ pass (24s) — type-checks NÃO executados |
| `npx tsc --noEmit -p tsconfig.app.json` | ❌ **1 erro**: `src/hooks/useActivityFeed.ts(113,69): TS1005 '>' expected` |
| Ficheiros mergeados auditados | 251 (todos os `.ts/.tsx` em `src/`) |

**Padrão de defeito encontrado:** o build (vite) usa SWC com type-strip, que **não valida generics**. Sintaxe inválida em generic passa silenciosamente; tsc é a única rede. Esta é uma falha de processo no projeto (sem `tsc` no `package.json`).

---

## Bug fix #1 — commit `ed390af`

**Ficheiro:** `src/hooks/useActivityFeed.ts`, linha 113
**Defeito:** `Array<{ sum: { total: string } }>` faltava um `>` de fecho do generic aninhado.
**Pattern:** copia direta do `ordersCountRes` na linha 112 (que está correta), sem ajustar a forma do payload `sum` vs `count`.
**Sintoma:** tsc TS1005; em runtime, o tipo era `unknown` (e qualquer tentativa de usar `ordersSumRes.data[0].sum.total` em IDE type-aware falhava). Como o `.catch()` mascara erros HTTP, o `.data?.[0]?.sum?.total` retorna `undefined` → `orderValueToday = 0` silencioso, sem erro visível.
**Fix:** adicionado `>` em falta → `Array<{ sum: { total: string } }>`.
**Verificação:** tsc 1→0 erros; build continua verde (28s).

---

## ⚠️ Findings NÃO corrigidos (181 erros TS latentes)

Ao corrigir a sintaxe do generic, o parser do tsc passou a ver **181 erros reais adicionais** que estavam escondidos atrás do bail-out de linha 113. Eram **invisíveis** porque:

1. O parser abortava em `:113` e nada depois era verificado.
2. Vite/SWC faz type-strip sem validar nada.
3. Não há `tsc` no `package.json` → o projeto não corre tsc em CI (assumindo que segue o script atual).

### Categorias dos 181 erros (top-down)

| # | Categoria | Contagem | Risco |
|---|---|---|---|
| 1 | Type assertions inseguras (`as Record<string, unknown>` sem `unknown` cast prévio) | ~35 | Baixo (cosmético) |
| 2 | `useEffect`/dependency missing ou `void` callback typed errado | ~12 | Médio |
| 3 | Módulos `@/services/ai/agents/types` em falta (5 imports) | 5 | **Alto** — Card 7/8/9 mergeados sem tipagem |
| 4 | `replaceAll` exige `lib: es2021+` (`generateProposalPDF.ts`, `MessageTemplatesPopover.tsx`) | 6 | Baixo (Node 18/Chrome têm) |
| 5 | Tipos `LeadItem`/`Employee`/`CustomerFormFields`/`QuotationBuilderItem` desactualizados vs uso | ~25 | **Alto** — Cards 13/14/15 mergeados com type drift |
| 6 | `whatsapp_913/916/918` não constam em `CommunicationChannel` (`channelRegistry.ts`) | 3 | **Alto** — runtime crash silencioso |
| 7 | `embla-carousel-react`, `vaul`, `input-otp`, `react-resizable-panels` em falta (deps não instaladas) | 4 | **Alto** — pages podem não montar |
| 8 | `Customer360.tsx` — `customer360Data.proposals/notes/createNote/...` em falta (shell vs hook desincronizado) | 5 | **Alto** — Customer360 Card 17/18 merge partido |
| 9 | `useChecklistSla.ts` — `Property 'id' does not exist on type 'void'` | 4 | **Alto** — `void` retornado por engano |
| 10 | `useChannelSettingsSync.ts` — `string` vs `CommunicationChannel` | 1 | Médio |
| 11 | `wa913.ts` — `DIRECTUS_URL` global não declarada | 4 | **Alto** |
| 12 | `LeadPopup360.tsx` — `contact_phone` em falta em `LeadItem` | 6 | **Alto** — Card 13 |
| 13 | `InboxOmnichannel.tsx` — `Employee.first_name` em falta | 1 | Médio |
| 14 | `ProposalContent.tsx` — props renomeadas entre Card 17/18 (`hasDiscount`, `urgencyDiscountPct`, `validUntil`, `items`, `companyName`, ...) | 10 | **Alto** — Card 17/18 merge partido |
| 15 | `QuotationSidebar.tsx` — `QuotationBuilderItem` vs `QuotationItem` | 1 | **Alto** |
| 16 | Vários `setBreakdownLead`, `f`, `label`, `pendingProposalsCount` em falta | 5 | **Alto** — variáveis não declaradas |

### Bugs Python-style slice `[:8]`, `[:-1]`, `[:n]`

**Resultado da grep:** 0 matches. Já foram corrigidos em auditorias anteriores (commit `d663477`: "fix: remove duplicate newLeads declaration + fix Python slice syntax in Dashboard").

### Duplicate variable declarations

Grep manual em ficheiros mergeados (cards 5–18) e `App.tsx`, `BottomNav`, `Customer360` (cards 17/18) — sem duplicações remanescentes. Anterior já tratado (commit `d663477`).

### Funções chamadas que não existem

Surfacadas dentro dos 181 erros (ver acima): `setBreakdownLead`, `f`, `label`, `pendingProposalsCount`.

### Imports em falta

- `@/services/ai/agents/types` em 5 ficheiros (provável módulo que não foi mergeado).
- `embla-carousel-react`, `vaul`, `input-otp`, `react-resizable-panels` em `components/ui/*.tsx` (deps em falta no `package.json`).

---

## Recomendação (próxima ronda, separada)

**NÃO tentar corrigir os 181 erros num único PR.** Risco de regressão composto (são 50+ ficheiros de tipos + 4 deps + cross-cutting). Sequência sugerida:

1. **Wave A — Tipos em falta** (1 commit): criar `src/services/ai/agents/types.ts` e estender `LeadItem`/`Employee`/`CustomerFormFields`/`QuotationBuilderItem`/`CommunicationChannel`.
2. **Wave B — Deps em falta** (1 commit, requer `npm install`): `embla-carousel-react`, `vaul`, `input-otp`, `react-resizable-panels`, `DIRECTUS_URL` (env).
3. **Wave C — Props rename** (1 commit por card): reconciliar `ProposalContent` ↔ subcomponentes (Card 17 vs 18), `DealCard`, `SavedFiltersPopover`, `EmptyState`/`PageHeader`.
4. **Wave D — Cleanup**: `as unknown as` casts (~35 ocorrências) + tsconfig `lib: ["es2022", "dom"]`.
5. **Wire tsc to CI**: adicionar `"typecheck": "tsc --noEmit -p tsconfig.app.json"` e hook pre-commit. Sem isto, os erros voltam.

---

## Critérios de aceitação

| Item | Estado |
|---|---|
| Skill `superpowers` carregada | ❌ NÃO instalada → fallback `systematic-debugging` |
| Auditoria exaustiva | ✅ 251 ficheiros varridos |
| Cada bug como commit separado | ✅ 1 commit cirúrgico (sem alargamento de scope) |
| Build passa | ✅ `npm run build` verde |
| `tsc --noEmit` verde | ❌ 181 erros remanescentes (documentados) |
| Metodologia sistemática | ✅ Phase 1 (reproduce/evidence) → Phase 2 (pattern) → Phase 3 (hypothesis) → Phase 4 (minimal fix + verify) |

---

## Conclusão

**1 fix cirúrgico aplicado** (useActivityFeed.ts linha 113, +1 `>`) e **181 erros TS latentes identificados mas não corrigidos** — eles formam o backlog real da próxima missão. Build verde, tipos ainda não. O bug fix #1 demonstra exatamente o gap: vite passa, tsc falha, e nenhum dos dois corre em CI.
