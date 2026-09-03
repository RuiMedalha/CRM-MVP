-- Migration: Voice AI para Telecof
-- Cria a collection ai_call_runs e altera Historico_Chamadas

-- 1. Collection ai_call_runs
CREATE TABLE IF NOT EXISTS "ai_call_runs" (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
    call_id INTEGER REFERENCES "Historico_Chamadas"(id) ON DELETE SET NULL,
    provider VARCHAR(30) DEFAULT 'openai_whisper' CHECK (provider IN ('openai_whisper','deepgram','claude','openai_gpt')),
    model VARCHAR(100),
    transcript TEXT,
    summary TEXT,
    sentiment VARCHAR(10) DEFAULT 'unknown' CHECK (sentiment IN ('positive','neutral','negative','unknown')),
    next_action TEXT,
    key_topics JSONB,
    tokens_used INTEGER DEFAULT 0,
    cost_estimate DECIMAL(10,4) DEFAULT 0.0000,
    latency_ms INTEGER,
    raw_response JSONB,
    error_message TEXT,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_ai_call_runs_call_id ON ai_call_runs(call_id);
CREATE INDEX IF NOT EXISTS idx_ai_call_runs_sentiment ON ai_call_runs(sentiment);

-- Trigger para date_updated
CREATE OR REPLACE FUNCTION update_ai_call_runs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_call_runs_updated ON ai_call_runs;
CREATE TRIGGER trg_ai_call_runs_updated
    BEFORE UPDATE ON ai_call_runs
    FOR EACH ROW EXECUTE FUNCTION update_ai_call_runs_timestamp();

-- 2. ALTER Historico_Chamadas (add campos de audio se nao existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Historico_Chamadas' AND column_name = 'audio_url'
    ) THEN
        ALTER TABLE "Historico_Chamadas" ADD COLUMN audio_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Historico_Chamadas' AND column_name = 'duration_seconds'
    ) THEN
        ALTER TABLE "Historico_Chamadas" ADD COLUMN duration_seconds INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Historico_Chamadas' AND column_name = 'transcription_status'
    ) THEN
        ALTER TABLE "Historico_Chamadas" ADD COLUMN transcription_status VARCHAR(20) DEFAULT 'pending' CHECK (transcription_status IN ('pending','processing','done','failed'));
    END IF;
END;
$$;
