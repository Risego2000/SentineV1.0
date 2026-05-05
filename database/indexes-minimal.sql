-- Supabase Postgres Optimization - Sentinel AI
-- MINIMAL VERSION - Just essential indexes
-- No user tracking columns assumed

-- ============================================================================
-- CRITICAL INDEXES (10-100x query speed improvement)
-- ============================================================================

-- Index expedients by state (most common filter)
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);

-- Index expedients by creation time (for sorting/pagination)
CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC);

-- Index infractions by plate (exact match lookups)
CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate);

-- Index infractions by creation time
CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC);

-- Index evidence by expedient (for joins)
CREATE INDEX IF NOT EXISTS idx_evidence_expedient_id
  ON evidence(expedient_id);

-- ============================================================================
-- PERFORMANCE TUNING
-- ============================================================================

-- Enable autovacuum for frequently modified tables
ALTER TABLE expedients SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE infractions SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE evidence SET (autovacuum_vacuum_scale_factor = 0.05);

-- ============================================================================
-- OPTIONAL: Additional indexes based on your queries
-- Uncomment if you use these filters:
-- ============================================================================

-- If you filter by severity frequently:
-- CREATE INDEX IF NOT EXISTS idx_infractions_severity
--   ON infractions(severity);

-- If you filter by state + created_at:
-- CREATE INDEX IF NOT EXISTS idx_expedients_state_date
--   ON expedients(state, created_at DESC);

-- If you have a user/operator tracking column:
-- CREATE INDEX IF NOT EXISTS idx_expedients_user_id
--   ON expedients(user_id);
--
-- CREATE INDEX IF NOT EXISTS idx_expedients_user_state
--   ON expedients(user_id, state);

-- ============================================================================
-- VERIFY INDEXES WERE CREATED
-- ============================================================================
-- Run this query to check indexes on expedients:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'expedients';

-- ============================================================================
-- CONNECTION POOLING (Configure in Supabase Dashboard)
-- ============================================================================
-- Project → Database → Connection Pooling
-- Settings:
-- - Mode: Transaction
-- - Pool Size: 20-30
-- - Max Overflow: 5
-- - Idle Timeout: 600
