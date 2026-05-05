-- Supabase Postgres Optimization - Sentinel AI
-- Schema improvements and index recommendations

-- ============================================================================
-- CRITICAL: Add Missing Indexes for Query Performance
-- ============================================================================

-- Index on expedients table for fast filtering and sorting
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expedients_user_id_state
  ON expedients(created_by, state)
  WHERE deleted_at IS NULL;

-- Index on infractions table for common queries
CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_infractions_severity
  ON infractions(severity)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC)
  WHERE deleted_at IS NULL;

-- Index for evidence lookups
CREATE INDEX IF NOT EXISTS idx_evidence_expedient_id
  ON evidence(expedient_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_kind
  ON evidence(kind)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- HIGH: Optimize Foreign Key Constraints
-- ============================================================================

-- Add composite index for expedient-infraction joins
CREATE INDEX IF NOT EXISTS idx_expedients_infraction_id_state
  ON expedients(infraction_id, state)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- CRITICAL: Connection Pooling Configuration
-- ============================================================================
-- Note: Configure in Supabase dashboard
-- Connection Pool Mode: Transaction
-- Pool Size: 20-30 (adjust based on concurrent users)

-- ============================================================================
-- HIGH: Analyze Query Performance
-- ============================================================================

-- Run these to get query stats (admin only)
-- SELECT query, calls, mean_time, max_time
-- FROM pg_stat_statements
-- ORDER BY mean_time DESC
-- LIMIT 20;

-- ============================================================================
-- MEDIUM: Partial Indexes for Common Filters
-- ============================================================================

-- Index only active expedients (common case)
CREATE INDEX IF NOT EXISTS idx_expedients_active
  ON expedients(state, created_at DESC)
  WHERE state != 'EXPORTED' AND deleted_at IS NULL;

-- Index for pending reviews
CREATE INDEX IF NOT EXISTS idx_expedients_pending_review
  ON expedients(created_at DESC)
  WHERE state = 'DETECTED' AND deleted_at IS NULL;

-- ============================================================================
-- MEDIUM: Vacuum and Analyze Configuration
-- ============================================================================
-- Ensure autovacuum is enabled (default)
-- ALTER TABLE expedients SET (autovacuum_vacuum_scale_factor = 0.05);
-- ALTER TABLE expedients SET (autovacuum_analyze_scale_factor = 0.02);

-- ============================================================================
-- LOW: Statistics Update
-- ============================================================================
-- Run periodically to update planner statistics
-- ANALYZE expedients;
-- ANALYZE infractions;
-- ANALYZE evidence;
