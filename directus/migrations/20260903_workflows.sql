-- Directus Migration: Workflows and Workflow Executions
-- Date: 2026-09-03
-- Description: Visual workflow automation (if-this-then-that) tables with triggers, conditions, actions, and execution logs.

-- 1. Table: workflows
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_collection VARCHAR(100) NOT NULL,
    trigger_event VARCHAR(50) NOT NULL DEFAULT 'create', -- create, update, delete, stage_changed, no_followup_days
    trigger_conditions JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {field, op, value}
    actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {type, params}
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices for workflows
CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON workflows (is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows (trigger_collection, trigger_event);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows (created_by);

-- 2. Table: workflow_executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_item_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    log JSONB NOT NULL DEFAULT '[]'::jsonb, -- step logs: [{ step, action_type, status, message, result, timestamp }]
    error TEXT,
    date_created TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices for workflow_executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_started ON workflow_executions (workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions (status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_item ON workflow_executions (trigger_item_id);

-- Optional Directus metadata registration helper comments:
COMMENT ON TABLE workflows IS 'CRM Visual Workflow Automation rules (if-this-then-that)';
COMMENT ON TABLE workflow_executions IS 'Audit trail and step execution logs for CRM workflows';
