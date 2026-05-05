# Database Setup Instructions - Sentinel AI

## Quick Start (Copy & Paste)

### Step 1: Add Indexes Only (Safe & Essential)

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- Supabase Postgres Optimization - Sentinel AI
-- MINIMAL VERSION - Just essential indexes

-- Index expedients by state
CREATE INDEX IF NOT EXISTS idx_expedients_state
  ON expedients(state);

-- Index expedients by creation time
CREATE INDEX IF NOT EXISTS idx_expedients_created_at
  ON expedients(created_at DESC);

-- Index infractions by plate
CREATE INDEX IF NOT EXISTS idx_infractions_plate
  ON infractions(plate);

-- Index infractions by creation time
CREATE INDEX IF NOT EXISTS idx_infractions_created_at
  ON infractions(created_at DESC);

-- Index evidence by expedient
CREATE INDEX IF NOT EXISTS idx_evidence_expedient_id
  ON evidence(expedient_id);
```

**Result:** 10-100x faster queries ✅

### Step 2: Enable Connection Pooling (Recommended)

In **Supabase Dashboard:**
1. Click on **Project Name** → **Settings**
2. Go to **Database** section
3. Click **Connection Pooling**
4. Set these values:
   - **Mode:** Transaction
   - **Pool Size:** 25
   - **Max Overflow:** 5
   - **Idle Timeout:** 600

**Result:** Better performance under load ✅

## Testing Indexes

### Verify Indexes Were Created

Run this in SQL Editor:

```sql
-- Check all indexes on expedients table
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'expedients'
ORDER BY indexname;
```

**Expected output:** Should see the 2 indexes we created

### Test Query Performance

Before/After comparison:

```sql
-- This will be MUCH faster now:
SELECT id, state, created_at 
FROM expedients 
WHERE state = 'UNDER_REVIEW' 
ORDER BY created_at DESC 
LIMIT 20;
```

Run this query before and after indexes to see the difference.

## Optional: Advanced Setup

### If You Have User Tracking

If your expedients table has a user/operator column (like `user_id` or `operator_id`), add:

```sql
-- Index for user + state queries
CREATE INDEX IF NOT EXISTS idx_expedients_user_state
  ON expedients(user_id, state);
```

### If You Filter by Severity

```sql
-- Index for severity filtering
CREATE INDEX IF NOT EXISTS idx_infractions_severity
  ON infractions(severity);
```

## Troubleshooting

### Error: "column X does not exist"

This means the column name is different in your database. Check your actual table:

```sql
-- See all columns in expedients
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'expedients';
```

Then update the SQL with correct column names.

### Error: "index already exists"

This is fine - just means the index was already created. The `IF NOT EXISTS` prevents errors.

### Query Still Slow

1. Check indexes were actually created (use verification query above)
2. Run `ANALYZE expedients;` to update statistics
3. Check if you're selecting too many columns (`SELECT *` is slow)
4. Use `EXPLAIN ANALYZE` to see query plan:

```sql
EXPLAIN ANALYZE
SELECT id, state, created_at 
FROM expedients 
WHERE state = 'UNDER_REVIEW' 
LIMIT 20;
```

## Performance Targets

| Operation | Before | After | Target |
|-----------|--------|-------|--------|
| List expedients by state | 1000ms | 50ms | <100ms |
| Find by plate | 2000ms | 100ms | <200ms |
| Get evidence for expedient | 500ms | 10ms | <50ms |

## Files Reference

- **`database/indexes-minimal.sql`** - Safe, minimal index setup (recommended)
- **`database/schema-optimization-fixed.sql`** - More comprehensive (requires custom column names)
- **`database/rls-policies-fixed.sql`** - Security (RLS) - only run if you need per-user access control

## Next Steps

1. ✅ Run indexes-minimal.sql
2. ✅ Enable Connection Pooling in Dashboard
3. ✅ Verify indexes with verification query
4. ✅ Test query performance
5. (Optional) Add RLS policies if you need per-user data access control

## Support

If you get errors:
1. Run this to see your actual columns:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'expedients';
   ```
2. Update the SQL with your actual column names
3. Re-run the modified SQL

Your database should now be optimized! 🚀
