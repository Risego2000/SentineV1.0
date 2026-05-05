# Supabase Postgres Optimization Guide - Sentinel AI

## Overview

This guide covers critical Postgres optimizations for Sentinel AI using Supabase, focused on:
- Query performance (indexes, query patterns)
- Connection management (pooling, connection limits)
- Security (Row-Level Security)
- Schema design and scaling

## Quick Wins (Implement First)

### 1. Enable Connection Pooling
**Impact:** 🟢 CRITICAL - Reduces connection overhead

Go to Supabase Dashboard:
1. Project → Database → Connection Pooling
2. Set Mode: **Transaction**
3. Set Pool Size: **20-30** (adjust based on concurrency)
4. Enable SSL: **Yes**

### 2. Add Missing Indexes
**Impact:** 🟢 CRITICAL - 10-100x query speed improvement

```sql
-- Run in SQL Editor
CREATE INDEX idx_expedients_state ON expedients(state)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_expedients_created_at ON expedients(created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_infractions_plate ON infractions(plate)
  WHERE deleted_at IS NULL;
```

See `database/schema-optimization.sql` for all indexes.

### 3. Enable Row-Level Security (RLS)
**Impact:** 🟢 HIGH - Automatic data isolation + security

```sql
-- Run in SQL Editor
ALTER TABLE expedients ENABLE ROW LEVEL SECURITY;
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
```

See `database/rls-policies.sql` for RLS policies.

## Rule Categories

### 1. Query Performance (CRITICAL)

**Problem 1: N+1 Queries**
```javascript
// ❌ SLOW: 21 queries (1 for expedients + 20 for each infraction)
const expedients = await supabase
  .from('expedients')
  .select('*')
  .eq('user_id', userId)
  .limit(20);

for (const exp of expedients.data) {
  const infraction = await supabase
    .from('infractions')
    .select('*')
    .eq('id', exp.infraction_id);
  // ... 20 more queries
}

// ✅ FAST: 1 query with JOIN
const expedients = await supabase
  .from('expedients')
  .select(`
    *,
    infractions(*),
    evidence(count)
  `)
  .eq('user_id', userId)
  .limit(20);
```

**Problem 2: Missing Indexes**
- Index every column used in WHERE, ORDER BY, JOIN
- Use partial indexes for filtered queries
- Use composite indexes for common filter combinations

```sql
-- Instead of searching all 1M rows
SELECT * FROM expedients WHERE state = 'DETECTED';

-- With index, searches only 5K rows
CREATE INDEX idx_expedients_state ON expedients(state);
```

**Problem 3: Inefficient Pagination**
```javascript
// ❌ SLOW: OFFSET 10000 scans 10000 rows
const page2 = await supabase
  .from('expedients')
  .select('*')
  .order('created_at', { ascending: false })
  .range(10000, 10020);

// ✅ FAST: Keyset pagination (cursor-based)
const page2 = await supabase
  .from('expedients')
  .select('*')
  .order('created_at', { ascending: false })
  .lt('created_at', cursor_date)
  .limit(20);
```

### 2. Connection Management (CRITICAL)

**Connection Pool Settings:**
```
Mode: Transaction (for serverless/Electron)
Pool Size: 20-30 (adjust for concurrency)
Max Overflow: 5
Idle Timeout: 600 seconds
```

**Best Practices:**
- ✅ Use connection pooling (not direct connection)
- ✅ Reuse connections (connection pools handle this)
- ✅ Set timeouts to prevent hung connections
- ❌ Don't open connections for every request

### 3. Row-Level Security (CRITICAL)

**RLS Benefits:**
- ✅ Automatic data isolation (operators only see own data)
- ✅ Security enforcement at database level
- ✅ Works with Supabase auth automatically

**Implementation Pattern:**
```sql
-- Operators see only their expedients
CREATE POLICY "operators_select_own"
  ON expedients FOR SELECT
  USING (auth.uid() = created_by);

-- Supervisors see all
CREATE POLICY "supervisors_select_all"
  ON expedients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPERVISOR'
    )
  );
```

### 4. Schema Design (HIGH)

**Good Schema Design:**
```sql
-- ✅ Normalized, index-friendly
CREATE TABLE expedients (
  id UUID PRIMARY KEY,
  infraction_id UUID REFERENCES infractions(id),
  state VARCHAR(20),  -- Easy to index
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_expedients_user_state
  ON expedients(created_by, state)
  WHERE deleted_at IS NULL;
```

**Bad Schema Design:**
```sql
-- ❌ Denormalized, hard to query
CREATE TABLE expedients (
  id UUID PRIMARY KEY,
  data JSONB,  -- Entire infraction nested
  created_at TIMESTAMP
);
-- Queries like WHERE data->>'state' = 'DETECTED' don't use indexes
```

### 5. Concurrency & Locking (MEDIUM-HIGH)

**Avoid Long Transactions:**
```javascript
// ❌ SLOW: Long transaction, blocks other users
const trans = await supabase.rpc('begin_transaction');
const exp = await supabase.from('expedients').select('*').eq('id', id);
// ... long processing (5 seconds)
await supabase.from('expedients').update({state: 'SIGNED'}).eq('id', id);

// ✅ FAST: Short transactions
const exp = await supabase.from('expedients').select('*').eq('id', id);
// ... long processing outside transaction
await supabase.from('expedients').update({state: 'SIGNED'}).eq('id', id);
```

### 6. Data Access Patterns (MEDIUM)

**Efficient Filtering:**
```javascript
// ❌ SLOW: Fetch all, filter in application
const all = await supabase.from('expedients').select('*');
const pending = all.data.filter(e => e.state === 'DETECTED');

// ✅ FAST: Filter at database level
const pending = await supabase
  .from('expedients')
  .select('*')
  .eq('state', 'DETECTED');
```

**Batch Operations:**
```javascript
// ❌ SLOW: 20 individual updates
for (const exp of expedients) {
  await supabase
    .from('expedients')
    .update({validated_at: now})
    .eq('id', exp.id);
}

// ✅ FAST: Single batch update
const ids = expedients.map(e => e.id);
await supabase
  .from('expedients')
  .update({validated_at: now})
  .in('id', ids);
```

### 7. Monitoring & Diagnostics (LOW-MEDIUM)

**Monitor Query Performance:**
```sql
-- Find slow queries
SELECT
  mean_time,
  calls,
  query
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

**Supabase Monitoring:**
- Go to Dashboard → Project → Logs → Database
- Monitor slow queries (>1000ms)
- Check connection pool status
- Monitor row counts

## Files Provided

1. **`database/schema-optimization.sql`**
   - Index creation for all tables
   - Connection pooling config
   - Vacuum settings

2. **`database/rls-policies.sql`**
   - RLS policies for expedients
   - RLS policies for infractions
   - RLS policies for evidence
   - RLS policies for custody logs

3. **`database/query-optimization.sql`**
   - Optimized query patterns
   - N+1 query examples
   - Pagination patterns
   - Performance monitoring queries

## Implementation Checklist

- [ ] Enable connection pooling (Supabase Dashboard)
- [ ] Run `schema-optimization.sql` to add indexes
- [ ] Run `rls-policies.sql` to add RLS policies
- [ ] Update queries to use JOINs instead of N+1
- [ ] Use parameterized queries (Supabase client handles this)
- [ ] Monitor slow queries in Supabase logs
- [ ] Set up alerts for slow queries
- [ ] Test pagination with cursor-based approach
- [ ] Verify RLS policies work correctly
- [ ] Benchmark before/after improvements

## Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Expedient List Query | <100ms | TBD | 🟡 |
| Single Expedient | <50ms | TBD | 🟡 |
| Create Expedient | <200ms | TBD | 🟡 |
| Export 100 Items | <1000ms | TBD | 🟡 |
| Connection Pool Util | <80% | TBD | 🟡 |

## Common Issues & Solutions

### Issue: Slow expedient list query
**Solution:**
- Add index on state: `CREATE INDEX idx_expedients_state ON expedients(state)`
- Use pagination
- Select only needed columns

### Issue: Connection pool exhaustion
**Solution:**
- Increase pool size in Supabase Dashboard
- Close idle connections (set timeout)
- Use transaction mode pooling

### Issue: RLS slowing down queries
**Solution:**
- RLS adds minimal overhead (<5%)
- Ensure RLS policies use indexed columns
- Avoid complex RLS logic in hot paths

### Issue: N+1 queries from SDK
**Solution:**
- Use `.select('*, relationship(*)')` instead of multiple queries
- Batch updates with `.in('id', ids)`
- Use computed columns for aggregates

## Next Steps

1. **Immediate (This Week):**
   - [ ] Enable connection pooling
   - [ ] Add indexes from schema-optimization.sql
   - [ ] Enable RLS policies

2. **Short-term (This Month):**
   - [ ] Optimize top 5 slow queries
   - [ ] Implement cursor-based pagination
   - [ ] Add monitoring alerts

3. **Long-term (This Quarter):**
   - [ ] Achieve sub-100ms query times
   - [ ] Set up automated performance testing
   - [ ] Plan vertical scaling if needed

## Resources

- [Supabase Database Docs](https://supabase.com/docs/guides/database/overview)
- [Postgres Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Supabase Indexes Guide](https://supabase.com/docs/guides/database/indexes)
- [RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting/connection-pooling)
