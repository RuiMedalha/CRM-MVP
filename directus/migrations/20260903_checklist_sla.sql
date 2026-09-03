-- Migration: 20260903_checklist_sla

-- Card 12

ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS sla_hours integer;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS escalate_to_employee_id uuid REFERENCES directus_users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS pipeline_stage_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    stage_id uuid NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    text text NOT NULL,
    done boolean NOT NULL DEFAULT false,
    due_at timestamptz,
    assigned_to_employee_id uuid REFERENCES directus_users(id) ON DELETE SET NULL,
    "order" integer NOT NULL DEFAULT 0,
    date_created timestamptz DEFAULT NOW(),
    date_updated timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stage_tasks_deal_order ON pipeline_stage_tasks (deal_id, "order");
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_tasks_stage ON pipeline_stage_tasks (stage_id);

CREATE TABLE IF NOT EXISTS sla_breaches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    stage_id uuid NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
    entered_stage_at timestamptz NOT NULL,
    sla_hours integer NOT NULL,
    breached_at timestamptz DEFAULT NOW(),
    escalated_to_employee_id uuid REFERENCES directus_users(id) ON DELETE SET NULL,
    notified boolean NOT NULL DEFAULT false,
    date_created timestamptz DEFAULT NOW(),
    date_updated timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_breaches_notified_breached ON sla_breaches (notified, breached_at);
