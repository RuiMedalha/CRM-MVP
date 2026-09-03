-- Criação das novas coleções para Multi-Pipeline
-- NOTA: Executar no SQL Editor do Directus ou via supabase cli

-- ============================================================
-- 1. pipelines
-- ============================================================
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    color TEXT DEFAULT '#6366f1',
    date_created TIMESTAMPTZ DEFAULT now(),
    date_updated TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. pipeline_stages
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#94a3b8',
    "order" INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    tasks_template JSONB,
    sla_hours INTEGER,
    date_created TIMESTAMPTZ DEFAULT now(),
    date_updated TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_order ON pipeline_stages(pipeline_id, "order");

-- ============================================================
-- 3. activity — expandir com campos de auditoria
-- ============================================================
ALTER TABLE activity ADD COLUMN IF NOT EXISTS collection TEXT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS item_id UUID;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS action TEXT CHECK (action IN ('create','update','delete'));
ALTER TABLE activity ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES directus_users(id);
ALTER TABLE activity ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS server_timestamp TIMESTAMPTZ;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS before_data JSONB;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS after_data JSONB;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('ui','api','webhook','system','ai'));
ALTER TABLE activity ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_activity_collection_item ON activity(collection, item_id);
CREATE INDEX IF NOT EXISTS idx_activity_server_timestamp ON activity(server_timestamp DESC);

-- ============================================================
-- 4. deals — adicionar pipeline_id e stage_id
-- ============================================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id);

-- ============================================================
-- 5. Default pipeline + 6 stages
-- ============================================================
INSERT INTO pipelines (name, description, is_default, "order", color)
SELECT 'Vendas Geral', 'Pipeline principal de vendas', true, 0, '#6366f1'
WHERE NOT EXISTS (SELECT 1 FROM pipelines WHERE is_default = true);

WITH default_pipeline AS (
    SELECT id FROM pipelines WHERE is_default = true LIMIT 1
)
INSERT INTO pipeline_stages (pipeline_id, name, "order", color, probability)
SELECT dp.id, s.*
FROM default_pipeline dp
CROSS JOIN (
    VALUES 
        ('Lead', 0, '#f59e0b', 10),
        ('Qualificação', 1, '#3b82f6', 25),
        ('Proposta', 2, '#8b5cf6', 50),
        ('Negociação', 3, '#ec4899', 75),
        ('Ganho', 4, '#22c55e', 100),
        ('Perdido', 5, '#ef4444', 0)
) AS s(name, "order", color, probability)
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps
    WHERE ps.pipeline_id = dp.id AND ps.name = s.name
);
