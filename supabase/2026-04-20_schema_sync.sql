-- Sentinel V16 - Schema sync (2026-04-20)
-- Idempotent migration: safe to run multiple times.

BEGIN;

-- =========================================================
-- infractions / incidents: expediente_num support
-- =========================================================
ALTER TABLE IF EXISTS infractions
  ADD COLUMN IF NOT EXISTS expediente_num TEXT;

ALTER TABLE IF EXISTS incidents
  ADD COLUMN IF NOT EXISTS expediente_num TEXT;

CREATE INDEX IF NOT EXISTS idx_infractions_expediente_num
  ON infractions(expediente_num);

CREATE INDEX IF NOT EXISTS idx_incidents_expediente_num
  ON incidents(expediente_num);

-- incidents: parity with current insert payload
ALTER TABLE IF EXISTS incidents
  ADD COLUMN IF NOT EXISTS plate_ocr_candidates TEXT[];

-- =========================================================
-- lugares_infraccion: fields used by EvidenceDB
-- =========================================================
ALTER TABLE IF EXISTS lugares_infraccion
  ADD COLUMN IF NOT EXISTS tipo_via TEXT DEFAULT 'urbana',
  ADD COLUMN IF NOT EXISTS coordenadas JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS operator_id TEXT;

COMMIT;

