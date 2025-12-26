# Performance Monitoring Checklist

## Purpose

Monitor Party-related queries and endpoints for performance regressions after migration. Party joins and lookups introduce different query patterns that require monitoring.

## Key Metrics to Monitor

### 1. API Endpoint Response Times

Monitor these Party-touched endpoints for latency increases:

| Endpoint | Expected p95 | Alert Threshold | Notes |
|----------|--------------|-----------------|-------|
| `GET /api/v1/waitlist` | < 200ms | > 500ms | Party join for clientParty |
| `POST /api/v1/waitlist` | < 100ms | > 300ms | Party FK validation |
| `GET /api/v1/animals/:id/owners` | < 150ms | > 400ms | Party join for owner list |
| `POST /api/v1/animals/:id/owners` | < 100ms | > 300ms | Party FK validation |
| `GET /api/v1/breeding/:id` | < 200ms | > 500ms | Party join for studOwner |
| `GET /api/v1/offspring` | < 300ms | > 800ms | Multiple Party joins |
| `GET /api/v1/parties` | < 200ms | > 500ms | Party list with kind filtering |
| `GET /api/v1/parties/:id` | < 50ms | > 150ms | Single Party lookup |

### 2. Database Query Performance

Monitor these specific query patterns:

#### Party Join Queries
```sql
-- WaitlistEntry with Party join
SELECT we.*, p.kind, p."displayName"
FROM "WaitlistEntry" we
LEFT JOIN "Party" p ON p.id = we."clientPartyId"
WHERE we."tenantId" = ?;
```

**Expected:** < 100ms for 1000 rows
**Alert if:** > 300ms

#### Animal Owner with Party
```sql
SELECT ao.*, p.kind, p."displayName"
FROM "AnimalOwner" ao
LEFT JOIN "Party" p ON p.id = ao."partyId"
WHERE ao."animalId" = ?;
```

**Expected:** < 50ms for 10 owners
**Alert if:** > 150ms

#### Party Lookup by ID
```sql
SELECT * FROM "Party" WHERE id = ?;
```

**Expected:** < 10ms (indexed primary key)
**Alert if:** > 50ms

#### Party List with Filtering
```sql
SELECT * FROM "Party"
WHERE "tenantId" = ? AND kind = 'CONTACT'
ORDER BY "displayName"
LIMIT 50 OFFSET 0;
```

**Expected:** < 100ms for 10,000 parties
**Alert if:** > 300ms

### 3. Foreign Key Constraint Performance

Monitor FK validation overhead on writes:

```sql
-- Insert with Party FK validation
INSERT INTO "WaitlistEntry" ("tenantId", "clientPartyId", status)
VALUES (?, ?, 'INQUIRY');
```

**Expected:** < 50ms
**Alert if:** > 150ms

**Note:** FK lookups should be fast due to indexes. Slow inserts indicate missing index on Party.id.

### 4. Index Utilization

Verify these indexes exist and are being used:

```sql
-- Check Party indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Party';
```

**Required indexes:**
- `Party.id` (PRIMARY KEY)
- `Party.tenantId` (for tenant filtering)
- `Party.kind` (for kind filtering)
- `Party.contactId` (for reverse lookup)
- `Party.organizationId` (for reverse lookup)

```sql
-- Check FK indexes on consuming tables
SELECT tablename, indexname
FROM pg_indexes
WHERE indexname LIKE '%party%'
ORDER BY tablename;
```

**Required FK indexes:**
- `WaitlistEntry.clientPartyId`
- `AnimalOwner.partyId`
- `BreedingAttempt.studOwnerPartyId`
- `Offspring.buyerPartyId`
- `Animal.buyerPartyId`
- `User.partyId`
- `Invoice.clientPartyId`
- `ContractParty.partyId`
- `OffspringContract.buyerPartyId`

### 5. Slow Query Log Analysis

Enable and monitor PostgreSQL slow query log:

```sql
-- Enable slow query logging (if not already enabled)
ALTER DATABASE your_database SET log_min_duration_statement = 200;  -- 200ms threshold
```

**Queries to watch for:**

- Seq scans on Party table
- Missing index usage on Party joins
- N+1 query patterns (multiple Party lookups in loop)

**Example N+1 to avoid:**
```typescript
// BAD: N+1 query pattern
for (const entry of waitlistEntries) {
  const party = await prisma.party.findUnique({ where: { id: entry.clientPartyId } });
}

// GOOD: Single query with join
const entries = await prisma.waitlistEntry.findMany({
  include: { clientParty: true }
});
```

## Monitoring Setup

### Application-Level Monitoring

#### Fastify Request Logging

Ensure request timing is logged:

```typescript
// In server.ts or route handlers
fastify.addHook('onResponse', async (request, reply) => {
  const duration = reply.getResponseTime();
  if (duration > 500) {  // Alert threshold
    request.log.warn({
      url: request.url,
      method: request.method,
      duration,
    }, 'Slow request detected');
  }
});
```

#### Custom Metrics

Track Party-specific metrics:

```typescript
// Example: Track Party lookup counts
let partyLookupCount = 0;
let partyLookupTotalMs = 0;

// In Party lookup code
const start = Date.now();
const party = await prisma.party.findUnique({ where: { id } });
const duration = Date.now() - start;

partyLookupCount++;
partyLookupTotalMs += duration;

// Log periodically
if (partyLookupCount % 100 === 0) {
  console.log({
    partyLookups: partyLookupCount,
    avgDuration: partyLookupTotalMs / partyLookupCount,
  });
}
```

### Database-Level Monitoring

#### PostgreSQL Stats

Monitor `pg_stat_statements` for Party-related queries:

```sql
-- Top 10 slowest queries involving Party
SELECT
  substring(query, 1, 100) as query_snippet,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%Party%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### Active Connections

Monitor Party FK lookups in active queries:

```sql
-- Check for long-running Party queries
SELECT
  pid,
  now() - query_start AS duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query LIKE '%Party%'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

### Production Monitoring Tools

Recommended tools and configurations:

#### 1. APM Tools (Recommended)
- **New Relic, DataDog, or similar:**
  - Track endpoint response times
  - Database query performance
  - Custom Party metrics

#### 2. Database Monitoring
- **Neon Metrics (if using Neon):**
  - Query duration
  - Connection pool usage
  - Index hit rate

- **pg_stat_statements:**
  - Enable in PostgreSQL
  - Track query performance over time

#### 3. Logging and Alerting
- **Structured logs:**
  - Log all Party-related errors
  - Log slow queries (> 200ms)
  - Log FK violations

- **Alert conditions:**
  - p95 latency > threshold for Party endpoints
  - FK violation rate > 0
  - Slow query rate increase > 20%

## Performance Regression Detection

### Baseline Metrics (Post-Migration)

Establish baseline after migration:

```bash
# Run load test or monitor production for 24-48 hours
# Record:
# - Average Party lookup time
# - Average waitlist list time
# - Average animal owner list time
# - Average offspring list time
```

### Weekly Comparison

Compare current week vs baseline:

```sql
-- Example: Compare current avg Party lookup time
SELECT
  DATE_TRUNC('week', created_at) as week,
  AVG(duration_ms) as avg_duration
FROM request_logs
WHERE endpoint = '/api/v1/parties/:id'
GROUP BY week
ORDER BY week DESC
LIMIT 4;
```

**Alert if:** Current week avg > baseline + 30%

### Monthly Performance Review

Monthly checklist:

- [ ] Review p95 latency trends for Party endpoints
- [ ] Check for new slow queries in pg_stat_statements
- [ ] Verify index usage (no seq scans on Party)
- [ ] Compare query counts (ensure no N+1 patterns)
- [ ] Review error logs for FK violations
- [ ] Check database connection pool usage

## Optimization Strategies

### If Party Lookups Are Slow

1. **Verify indexes exist:**
   ```sql
   \d "Party"  -- Check indexes
   ```

2. **Add missing indexes:**
   ```sql
   CREATE INDEX IF NOT EXISTS "Party_tenantId_kind_idx"
   ON "Party" ("tenantId", "kind");
   ```

3. **Use EXPLAIN ANALYZE:**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM "Party" WHERE "tenantId" = 1 AND kind = 'CONTACT';
   ```

### If Party Joins Are Slow

1. **Check join strategy:**
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT we.*, p.kind, p."displayName"
   FROM "WaitlistEntry" we
   LEFT JOIN "Party" p ON p.id = we."clientPartyId"
   WHERE we."tenantId" = 1;
   ```

2. **Consider materialized view (if needed):**
   ```sql
   -- Only if joins are unavoidably slow
   CREATE MATERIALIZED VIEW waitlist_with_party AS
   SELECT we.*, p.kind, p."displayName"
   FROM "WaitlistEntry" we
   LEFT JOIN "Party" p ON p.id = we."clientPartyId";

   -- Refresh periodically
   REFRESH MATERIALIZED VIEW waitlist_with_party;
   ```

### If FK Validations Are Slow

1. **Verify Party.id index:**
   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'Party' AND indexname LIKE '%pkey%';
   ```

2. **Check for locks:**
   ```sql
   SELECT * FROM pg_locks WHERE relation = 'Party'::regclass;
   ```

### If N+1 Queries Detected

1. **Use Prisma includes:**
   ```typescript
   // Instead of separate queries
   const entries = await prisma.waitlistEntry.findMany({
     where: { tenantId },
     include: {
       clientParty: {
         select: { id: true, kind: true, displayName: true }
       }
     }
   });
   ```

2. **Use dataloader pattern (if needed):**
   ```typescript
   // For complex cases with multiple Party lookups
   const partyLoader = new DataLoader(async (ids) => {
     const parties = await prisma.party.findMany({
       where: { id: { in: ids } }
     });
     return ids.map(id => parties.find(p => p.id === id));
   });
   ```

## Alert Configuration Examples

### Example: New Relic Alert

```yaml
name: "Party API Slow Response"
condition:
  metric: "WebTransaction/Uri/api/v1/parties"
  threshold: 500  # ms
  duration: 5  # minutes
  operator: "above"
notification:
  channels:
    - slack: "#alerts-production"
    - pagerduty: "on-call-backend"
```

### Example: DataDog Monitor

```yaml
name: "Party FK Violations"
query: "sum(last_5m):sum:postgres.fk_violations{table:Party} > 0"
message: "Party FK violations detected. Check application logs."
notification:
  - "@slack-alerts-production"
  - "@pagerduty-backend-oncall"
```

## Related Documentation

- [Post-Migration Validation Runbook](./POST_MIGRATION_VALIDATION.md)
- [Rollback Posture](./ROLLBACK_POSTURE.md)
- [Backfill Runbook](./BACKFILL_RUNBOOK.md)
