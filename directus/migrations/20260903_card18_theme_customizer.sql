-- ============================================================================
-- Card 18 — Temas customizáveis (light/dark + accent color por tenant)
-- Data: 2026-09-03
--
-- Adiciona colunas de temas à company_settings
-- ============================================================================

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS theme_accent text NOT NULL DEFAULT 'indigo';

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'auto'
    CHECK (theme_mode IN ('light', 'dark', 'auto'));

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS theme_radius text NOT NULL DEFAULT 'md'
    CHECK (theme_radius IN ('none', 'sm', 'md', 'lg'));

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS theme_density text NOT NULL DEFAULT 'comfortable'
    CHECK (theme_density IN ('compact', 'comfortable'));

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS theme_logo_url text;
