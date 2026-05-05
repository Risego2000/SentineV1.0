-- Supabase Postgres Optimization - Sentinel AI (FIXED)
-- Adapted to actual Sentinel schema without deleted_at column

-- ============================================================================
-- CRITICAL: Add Missing Indexes for Query Performance
-- ============================================================================

-- Index on expedients table for fast filtering and sorting by state
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);

-- Index on expedients by creation date (for recent data queries)
CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC);

-- Composite index for user + state queries (common filter)
CREATE INDEX IF NOT EXISTS idx_expedients_user_state
  ON expedients(created_by, state);

-- Index on infractions table for plate lookups
CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate);

-- Index on infractions by severity (for filtering)
CREATE INDEX IF NOT EXISTS idx_infractions_severity
  ON infractions(severity);

-- Index on infractions by creation date
CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC);

-- Index for evidence lookups
CREATE INDEX IF NOT EXISTS idx_evidence_expedient_id
  ON evidence(expedient_id);

-- Index for evidence kind filtering
CREATE INDEX IF NOT EXISTS idx_evidence_kind
  ON evidence(kind);

-- ============================================================================
-- HIGH: Optimize Foreign Key Lookups
-- ============================================================================

-- Composite index for expedient-infraction joins
CREATE INDEX IF NOT EXISTS idx_expedients_infraction_id
  ON expedients(infraction_id, state);

-- Index for user lookups (for RLS)
CREATE INDEX IF NOT EXISTS idx_expedients_created_by
  ON expedients(created_by);

-- ============================================================================
-- MEDIUM: Partial Indexes for Common Queries
-- ============================================================================

-- Index for "pending" expedients (state != EXPORTED)
CREATE INDEX IF NOT EXISTS idx_expedients_pending
  ON expedients(state, created_at DESC)
  WHERE state != 'EXPORTED' AND state != 'ARCHIVED';

-- Index for expedients under review
CREATE INDEX IF NOT EXISTS idx_expedients_under_review
  ON expedients(created_at DESC)
  WHERE state = 'UNDER_REVIEW';

-- Index for signed expedients (for export queries)
CREATE INDEX IF NOT EXISTS idx_expedients_signed
  ON expedients(created_at DESC)
  WHERE state = 'SIGNED';

-- ============================================================================
-- HIGH: Vacuum and Analyze Configuration
-- ============================================================================
-- These are recommended settings for tables with frequent writes

ALTER TABLE expedients SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE expedients SET (autovacuum_analyze_scale_factor = 0.02);

ALTER TABLE infractions SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE evidence SET (autovacuum_vacuum_scale_factor = 0.05);

-- ============================================================================
-- UTILITY: Statistics and Analysis (Run periodically)
-- ============================================================================
-- These commands help Postgres optimize query plans
-- Run after adding indexes or significant data changes

-- ANALYZE expedients;
-- ANALYZE infractions;
-- ANALYZE evidence;

-- ============================================================================
-- PERFORMANCE MONITORING QUERIES
-- ============================================================================
-- Use these to check if indexes are being used

-- Find indexes that are never used (candidates for deletion)
-- SELECT schemaname, tablename, indexname
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Find most frequently used indexes
-- SELECT schemaname, tablename, indexname, idx_scan
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC LIMIT 20;

-- Find queries doing full table scans
-- SELECT schemaname, tablename, seq_scan, seq_tup_read
-- FROM pg_stat_user_tables
-- WHERE seq_scan > 100
-- ORDER BY seq_scan DESC;

-- ============================================================================
-- CONNECTION POOLING CONFIGURATION
-- ============================================================================
-- Configure these settings in Supabase Dashboard:
-- Project → Database → Connection Pooling
--
-- Recommended Settings:
-- - Mode: Transaction
-- - Pool Size: 20-30 (adjust based on concurrent users)
-- - Max Overflow: 5
-- - Idle Timeout: 600 seconds
-- - Session Timeout: 1800 seconds
