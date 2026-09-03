# Migration: ai_agent_runs

Card 16 — collection append-only para auditoria e revisão humana de
invocações dos agentes AI (qualificação, email, follow-up).

```sql
-- PostgreSQL migration applied by Directus on bootstrap
CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id BIGSERIAL PRIMARY KEY,
  agent_type VARCHAR(64) NOT NULL,
  input_payload JSONB,
  output_payload JSONB,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  confidence_score NUMERIC(3,2),
  human_reviewed_by UUID REFERENCES directus_users(id) ON DELETE SET NULL,
  human_approved BOOLEAN,
  human_reject_reason TEXT,
  provider VARCHAR(128),
  model VARCHAR(128),
  tokens_used INTEGER,
  latency_ms INTEGER,
  error TEXT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  follow_up_id INTEGER REFERENCES follow_ups(id) ON DELETE SET NULL,
  date_created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_type_status
  ON ai_agent_runs (agent_type, status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_awaiting_human
  ON ai_agent_runs (status)
  WHERE status = 'awaiting_human';

INSERT INTO directus_collections (collection, icon, note, display_template, hidden, singleton, sort)
  (('ai_agent_runs', 'auto_awesome', 'Card 16 — auditoria de agentes AI', '{{agent_type}} · {{status}}', false, false, 1))
  ON CONFLICT (collection) DO NOTHING;
```

> O hook Directus `aiAgent.js` regista a collection automaticamente quando
> corre pela primeira vez — o snapshot acima é a referência canónica.
