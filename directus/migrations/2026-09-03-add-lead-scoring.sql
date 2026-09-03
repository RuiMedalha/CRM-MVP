-- ============================================================================
-- Card 7 — Lead Scoring Top-of-Funnel
-- Data: 2026-09-03
--
-- 1) ALTERA tabela `leads` — adiciona colunas de scoring
-- 2) Cria collection nova `lead_score_history` — auditoria de cada recálculo
--
-- A collection `lead_score_history` é append-only: cada vez que o hook recalcula
-- o score de um lead, insere um registo novo (não atualiza). Isto permite
-- visualizar a evolução temporal do score no UI.
-- ============================================================================

-- ---------- 1) ALTER leads ----------
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0
    CHECK (score >= 0 AND score <= 100);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS score_factors jsonb;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS score_computed_at timestamp;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS score_model_version text;

-- Índice composto: usado pela página de Leads (default order by score desc)
-- e pelos filtros laterais Quentes/Mornos/Frios.
CREATE INDEX IF NOT EXISTS idx_leads_score_desc
  ON leads (score DESC, date_created DESC);

-- Índice simples no score para queries rápidas (filter score >= 61 etc.)
CREATE INDEX IF NOT EXISTS idx_leads_score
  ON leads (score);

-- ---------- 2) CREATE lead_score_history ----------
CREATE TABLE IF NOT EXISTS lead_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL,
  computed_at timestamp NOT NULL DEFAULT now()
);

-- Índice de leitura: histórico por lead, mais recente primeiro
CREATE INDEX IF NOT EXISTS idx_lead_score_history_lead
  ON lead_score_history (lead_id, computed_at DESC);

-- Índice opcional: análise global por versão do modelo (A/B testing)
CREATE INDEX IF NOT EXISTS idx_lead_score_history_model
  ON lead_score_history (model_version, computed_at DESC);

-- ---------- 3) Backfill: calcular score inicial para leads já existentes ----------
-- Apenas leads com score = 0 (default), uma única vez. O hook trata das próximas.
UPDATE leads
SET
  score = LEAST(100, GREATEST(0,
    COALESCE((CASE WHEN phone IS NOT NULL AND length(phone) > 0 THEN 25 ELSE 0 END), 0)
    + COALESCE((CASE WHEN email IS NOT NULL AND length(email) > 0 THEN 15 ELSE 0 END), 0)
    + COALESCE((CASE WHEN nif IS NOT NULL AND length(nif) > 0 THEN 10 ELSE 0 END), 0)
    + COALESCE((CASE WHEN status = 'qualified' THEN 10 ELSE 0 END), 0)
    + COALESCE((CASE WHEN status IN ('discarded', 'spam') THEN -50 ELSE 0 END), 0)
  )),
  score_model_version = 'v1',
  score_computed_at = now()
WHERE score = 0;
