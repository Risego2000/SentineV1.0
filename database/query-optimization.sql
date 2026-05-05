-- Supabase Query Optimization - Common Patterns
-- Optimized queries for Sentinel AI

-- ============================================================================
-- QUERY 1: Get expedient with all related data (OPTIMIZED)
-- ============================================================================

-- ❌ SLOW: N+1 query problem - fetches expedient, then n queries for infractions
SELECT *
FROM expedients
WHERE user_id = $1
LIMIT 20;
-- Then: SELECT * FROM infractions WHERE expedient_id = $expedient_id (20 times!)

-- ✅ FAST: Single query with JOIN
SELECT
  e.id,
  e.state,
  e.created_at,
  e.created_by,
  i.plate,
  i.severity,
  i.make_model,
  COUNT(ev.id) as evidence_count
FROM expedients e
LEFT JOIN infractions i ON e.infraction_id = i.id
LEFT JOIN evidence ev ON e.id = ev.expedient_id
WHERE e.created_by = $1
  AND e.deleted_at IS NULL
GROUP BY e.id, i.id
ORDER BY e.created_at DESC
LIMIT 20;

-- ============================================================================
-- QUERY 2: Efficient filtering with indexes
-- ============================================================================

-- ❌ SLOW: No index, full table scan
SELECT *
FROM expedients
WHERE state = 'UNDER_REVIEW'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ✅ FAST: With index on (state, created_at)
-- Index: idx_expedients_state_created_at
-- Same query, but uses index for filtering

-- ============================================================================
-- QUERY 3: Pagination with offset/limit
-- ============================================================================

-- ❌ SLOW: OFFSET becomes expensive with large numbers
SELECT *
FROM expedients
WHERE deleted_at IS NULL
ORDER BY created_at DESC
OFFSET 10000
LIMIT 20;

-- ✅ FAST: Use keyset pagination (cursor-based)
SELECT *
FROM expedients
WHERE deleted_at IS NULL
  AND created_at < $cursor_date
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- QUERY 4: Aggregations with GROUP BY
-- ============================================================================

-- ✅ FAST: Get statistics by state
SELECT
  state,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM expedients
WHERE created_at > NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL
GROUP BY state
ORDER BY count DESC;

-- ✅ FAST: With partial index for common filter
CREATE INDEX idx_expedients_recent
  ON expedients(state)
  WHERE created_at > NOW() - INTERVAL '30 days'
    AND deleted_at IS NULL;

-- ============================================================================
-- QUERY 5: Searching with LIKE (avoid if possible)
-- ============================================================================

-- ❌ SLOW: LIKE with leading wildcard (no index)
SELECT *
FROM infractions
WHERE plate LIKE '%ABC%'
LIMIT 20;

-- ✅ FAST: Use exact match with index
SELECT *
FROM infractions
WHERE plate = 'ABC123'
LIMIT 20;

-- ✅ FAST: Use prefix search (uses index)
SELECT *
FROM infractions
WHERE plate LIKE 'ABC%'
LIMIT 20;
-- Index: idx_infractions_plate (btree default works for prefix)

-- ✅ FASTER: Use full-text search for complex patterns
CREATE INDEX idx_infractions_plate_text
  ON infractions USING GIN (to_tsvector('spanish', plate));

SELECT *
FROM infractions
WHERE to_tsvector('spanish', plate) @@ plainto_tsquery('spanish', 'ABC')
LIMIT 20;

-- ============================================================================
-- QUERY 6: Batch operations (better than individual inserts)
-- ============================================================================

-- ❌ SLOW: Multiple roundtrips
INSERT INTO evidence (expedient_id, kind, url) VALUES ($1, 'ORIGINAL', $2);
INSERT INTO evidence (expedient_id, kind, url) VALUES ($3, 'PROCESSED', $4);
INSERT INTO evidence (expedient_id, kind, url) VALUES ($5, 'SNAPSHOT', $6);

-- ✅ FAST: Single batch insert
INSERT INTO evidence (expedient_id, kind, url)
VALUES
  ($1, 'ORIGINAL', $2),
  ($3, 'PROCESSED', $4),
  ($5, 'SNAPSHOT', $6)
ON CONFLICT (expedient_id, kind) DO UPDATE
SET url = EXCLUDED.url, updated_at = NOW();

-- ============================================================================
-- QUERY 7: Avoid SELECT * for performance
-- ============================================================================

-- ❌ SLOW: Fetches all columns including large blobs
SELECT * FROM expedients WHERE id = $1;

-- ✅ FAST: Select only needed columns
SELECT
  id,
  state,
  created_at,
  created_by,
  infraction_id
FROM expedients
WHERE id = $1;

-- ============================================================================
-- QUERY 8: Use LIMIT in subqueries
-- ============================================================================

-- ❌ SLOW: Gets all users, then sorts
SELECT *
FROM users u
WHERE id IN (
  SELECT DISTINCT created_by
  FROM expedients
  WHERE state = 'SIGNED'
)
LIMIT 10;

-- ✅ FAST: Limit first, then get users
SELECT u.*
FROM users u
WHERE id IN (
  SELECT DISTINCT created_by
  FROM expedients
  WHERE state = 'SIGNED'
  LIMIT 10
);

-- ============================================================================
-- QUERY 9: Efficient COUNT queries
-- ============================================================================

-- ❌ SLOW: Counts all rows
SELECT COUNT(*) FROM expedients WHERE state = 'DETECTED';

-- ✅ FAST: Use table statistics
SELECT reltuples::bigint FROM pg_class WHERE relname = 'expedients';

-- ✅ FAST: For filtered counts, use approximate
SELECT
  (CASE WHEN EXISTS(SELECT 1 FROM expedients WHERE state = 'DETECTED' LIMIT 1)
    THEN true
    ELSE false
  END) as has_detected;

-- ============================================================================
-- QUERY 10: Connection pooling awareness
-- ============================================================================

-- Use prepared statements to benefit from pooling
PREPARE get_expedient(uuid) AS
SELECT
  id,
  state,
  created_at,
  created_by
FROM expedients
WHERE id = $1;

-- Execute prepared statement
EXECUTE get_expedient('550e8400-e29b-41d4-a716-446655440000');

-- ============================================================================
-- PERFORMANCE MONITORING QUERIES
-- ============================================================================

-- View slowest queries (requires pg_stat_statements extension)
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_time DESC
LIMIT 20;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find missing indexes (queries using seq scans)
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_scan DESC;
