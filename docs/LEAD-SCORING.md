# Lead Scoring — Top-of-Funnel (Card 7)

Modelo determinístico que atribui um inteiro 0-100 a cada lead, priorizando
a fila comercial. Recalculado automaticamente pelo hook Directus em qualquer
`items.create` ou `items.update` da collection `leads`.

## Fórmula (modelo v1)

| Factor                          | Peso        | Descrição                                            |
| ------------------------------- | ----------- | ---------------------------------------------------- |
| `has_phone`                     | **+25**     | Lead tem telefone                                    |
| `has_email`                     | **+15**     | Lead tem email                                       |
| `has_nif`                       | **+10**     | Lead tem NIF                                         |
| `whatsapp_replies`              | **+20 cada**| Respostas do lead no WhatsApp (count)               |
| `email_opens`                   | **+15 cada**| Aberturas de email de marketing (count)             |
| `status_qualified`              | **+10**     | `status === "qualified"`                            |
| `decay_per_day_after_7d`        | **−5 / dia**| Por cada dia *sem follow-up* após 7 dias de silêncio |
| `penalty_discarded_or_spam`     | **−50**     | `status === "discarded"` ou `"spam"`                |

Score final = soma dos positivos + soma dos negativos, com **clamp [0, 100]**.

> **"sem follow-up"**: medido por `last_attempt_at` ou `date_updated` ou
> `date_created` (fallback em ordem).

## Buckets (filtros laterais UI)

| Bucket   | Range   | Cor badge     | Ícone         |
| -------- | ------- | ------------- | ------------- |
| Quentes  | 61-100  | verde         | Flame         |
| Mornos   | 31-60   | âmbar         | Thermometer   |
| Frios    | 0-30    | vermelho      | Snowflake     |

## Arquitectura

```
items.create/update(items/leads) ─► Directus Hook lead-scoring
                                      ├─ computeBreakdown() (JS mirror da formula)
                                      ├─ actualiza leads.{score,score_factors,
                                      │                   score_computed_at,
                                      │                   score_model_version=v1}
                                      └─ INSERT em lead_score_history (append-only)

UI (Leads.tsx)
   ↳ query sort=-score (default)
   ↳ chip filters Quentes/Mornos/Frios
   ↳ badge no card (mobile-first, min-w 52px)
   ↳ click → dialog com breakdown por factor
   ↳ score.ts formula (espelho do hook, exibe preview)

UI (settings/ScoringRules.tsx)
   ↳ Modelo A (baseline v1 — production) + Modelo B (variante)
   ↳ sliders por factor (8 regras)
   ↳ distribuição preview em tempo real (n=200 últimos leads)
   ↳ "Recalibrar todos" → PATCH em batch
```

## Schema Directus

### ALTER `leads`

```sql
ALTER TABLE leads
  ADD COLUMN score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  ADD COLUMN score_factors jsonb,
  ADD COLUMN score_computed_at timestamp,
  ADD COLUMN score_model_version text;

CREATE INDEX idx_leads_score_desc ON leads (score DESC, date_created DESC);
CREATE INDEX idx_leads_score       ON leads (score);
```

Migration aplicada por `directus/migrations/2026-09-03-add-lead-scoring.sql`
(inclui backfill de leads existentes via SQL determinístico).

### CREATE `lead_score_history`

Collection append-only. Cada recálculo do hook insere um registo novo — nunca
actualiza. Permite visualizar a evolução temporal do score e alimentar o
A/B test por `model_version`.

```sql
CREATE TABLE lead_score_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score         integer NOT NULL CHECK (score >= 0 AND score <= 100),
  factors       jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL,
  computed_at   timestamp NOT NULL DEFAULT now()
);
```

## Hook Directus

`directus/extensions/hooks/lead-scoring/index.js`

- Trigger: `action("items.create", { collection: "leads" })` e
  `action("items.update", { collection: "leads" })`.
- Calcula score usando **a mesma fórmula** (mirror JS de `src/services/leadScoring/score.ts`).
- Actualiza o lead com `score`, `score_factors`, `score_computed_at`,
  `score_model_version`.
- Insere um row em `lead_score_history` (append-only).
- **Anti-loop**: envia `__skipScoreRecalc: true` no PATCH para que o hook
  não se dispare a si próprio quando actualiza o score.

## UI — Página `Leads`

### Filtros laterais (chips)

`Quentes` | `Mornos` | `Frios` | `Todos` — visíveis em mobile (mobile-first).

### Badge no card

Cada lead tem um badge compacto à direita com o número do score e ícone
do bucket. Clicar abre o **breakdown dialog**. Layout garante que o badge
**não desaparece** quando o card é apertado (em landscape phone ou
tablet com sidebar 220px): `shrink-0 min-w-[52px]`.

### Breakdown Dialog

Mostra score grande + bucket + range, lista de componentes (positivos
e negativos) com `+N` ou `−N` ordenado por magnitude, e totais. Recalcula
em tempo real (live) usando `breakdownScore()` com os campos actuais.

### Default sort

A query default é `/items/leads?sort=-score,-date_created` — os leads
mais quentes aparecem primeiro. Substitui o anterior `-date_created`
porque o objectivo da página é **triagem comercial**, não arquivo.

## UI — Página `ScoringRules`

`/definicoes/scoring-rules`.

Layout em **duas colunas lado a lado**:

- **Modelo A (Baseline v1)**: badge verde `PRODUCTION`. Edita os pesos
  default (os do hook Directus).
- **Modelo B (Variante)**: badge âmbar `EXPERIMENT`. Pré-populado com
  valores diferentes (`+30 phone`, `+20 email`, `−8 decay`). Editável.

Cada modelo tem 8 sliders (um por factor), com min/max adaptado a cada
peso. Abaixo de cada modelo, **distribuição preview** com os últimos
200 leads não-convertidos (contagem e % por bucket).

**Botões**:
- **Recarregar**: refaz o sample dos últimos 200 leads.
- **Guardar pesos (localStorage)**: snapshot A e B.
- **Recalibrar todos**: dispara PATCH em batch com
  `__skipScoreRecalc=false` para forçar o hook a recomputar cada lead.

## A/B Test (estratégia)

O **modelo v1 é a baseline**. Para experimentar:

1. Abrir `/definicoes/scoring-rules`
2. Ajustar o **Modelo B** (variante) com os novos pesos
3. Observar a **distribuição preview** — comparar Quentes/Mornos/Frios
   lado a lado com o Modelo A
4. Quando decidir promover:
   - Editar `src/services/leadScoring/score.ts` e
     `directus/extensions/hooks/lead-scoring/index.js` para usar os
     novos pesos
   - Bump `SCORE_MODEL_VERSION` (v1 → v2)
   - Fazer deploy
   - O histórico `lead_score_history` separa runs por `model_version`,
     permitindo comparar distribuições passadas vs novas

## Ficheiros tocados

```
directus/collections.crm-full.json                       (+fields leads, +collection lead_score_history)
directus/migrations/2026-09-03-add-lead-scoring.sql      (novo)
directus/extensions/hooks/lead-scoring/index.js          (novo)
directus/extensions/hooks/lead-scoring.js                (novo — entrypoint)
src/services/leadScoring/score.ts                        (novo — fórmula + helpers)
src/pages/Leads.tsx                                      (badge, filtros, breakdown dialog)
src/pages/settings/ScoringRules.tsx                      (novo — A/B test + sliders)
src/App.tsx                                              (lazy import + route)
docs/LEAD-SCORING.md                                     (este documento)
```

## Próximos passos

- [ ] Persistir pesos A/B numa collection `lead_scoring_settings` (em vez
      de localStorage) com timestamps e quem alterou
- [ ] Adicionar cron job diário que recalcula decay (hoje só recalcula
      em write)
- [ ] Visualizar `lead_score_history` num sparkline no Customer360
- [ ] Notificar vendedor por WhatsApp quando um lead cruza o threshold
      para "Quente" pela primeira vez
- [ ] Excluir de "por converter" os leads com `score=0` E criados há >30d