-- P3 Fase 2 — product_specifications
-- Aplicar conforme CLAUDE.md:
-- docker exec db-hotelequip psql -U directus -d directus -f /tmp/add-product-specifications-schema.sql
-- Depois: POST /utils/cache/clear e aguardar 3 segundos.

CREATE TABLE IF NOT EXISTS product_specifications (
  id SERIAL PRIMARY KEY,
  quotation_item_id INTEGER NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_specifications_item_id
  ON product_specifications (quotation_item_id);

CREATE INDEX IF NOT EXISTS idx_product_specifications_status
  ON product_specifications (status);

COMMENT ON TABLE product_specifications IS 'P3 Fase 2: mini-formularios publicos de especificacao por quotation_item';
COMMENT ON COLUMN product_specifications.questions IS 'JSON array: [{question,type,choices?}]';
COMMENT ON COLUMN product_specifications.answers IS 'JSON array: [{answer_text,answer_number,answer_choice}]';
COMMENT ON COLUMN product_specifications.status IS 'draft | submitted | reviewed';
