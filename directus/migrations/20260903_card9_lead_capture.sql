-- Migration: Card 9 - Onboarding Wizard + Web-to-Lead
-- 1. Collection lead_capture_forms
-- 2. Campo onboarding_done + onboarding_step em company_settings

-- 1) Collection lead_capture_forms
CREATE TABLE IF NOT EXISTS "lead_capture_forms" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tenant_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    source_label VARCHAR(64) NOT NULL DEFAULT 'Web Form',
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    success_message TEXT NOT NULL DEFAULT 'Obrigado! Entraremos em contacto em breve.',
    redirect_url VARCHAR(2048),
    notification_email VARCHAR(255),
    webhook_url VARCHAR(2048),
    assign_to_employee_id UUID,
    round_robin_pool JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    embed_code_html TEXT,
    embed_code_iframe TEXT,
    submit_count INTEGER DEFAULT 0,
    last_submitted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_capture_forms_slug ON "lead_capture_forms" (slug);
CREATE INDEX IF NOT EXISTS idx_lead_capture_forms_active ON "lead_capture_forms" (is_active);

-- 2) Campos de onboarding em company_settings
ALTER TABLE "company_settings"
    ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;
