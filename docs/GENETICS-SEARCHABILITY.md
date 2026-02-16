# Genetics Searchability System

## Overview

The genetics searchability system provides high-performance querying of animal genetic data through a normalized `animal_loci` table structure. This enables deep searches for carriers, compatible breeding pairs, health clearances, and more.

## Architecture

### Database-Managed Sync Strategy

We use a **trigger-based approach** where the database automatically maintains synchronization:

1. **JSONB storage** (`animal_genetics` table) - **SOURCE OF TRUTH**
   - All genetics data stored here
   - Fast read/write of complete genetic profiles
   - Flexible schema for varying test formats
   - Application code ONLY updates this table

2. **Normalized table** (`animal_loci` table) - **SEARCHABLE INDEX**
   - Automatically synced via database trigger
   - One row per locus per animal
   - Fast indexed lookups
   - Enables complex genetic queries
   - **Database maintains this, not application code**

### Data Flow

```
User Input (UI/Import)
  ↓
API Endpoint (PUT/POST)
  ↓
Normalize Locus Codes
  ↓
Save to animal_genetics JSONB ✅ (Application writes here)
  ↓
DATABASE TRIGGER fires automatically
  ↓
animal_loci table updated ✅ (Database manages this)
```

**Key Benefit**: Application code cannot forget to sync. Database handles it automatically on every INSERT/UPDATE.

## Database Schema

### animal_loci Table Structure

```sql
CREATE TABLE "animal_loci" (
    "id" SERIAL PRIMARY KEY,
    "animal_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,           -- coatColor, health, physicalTraits, etc.
    "locus" TEXT NOT NULL,              -- E, A, TO, HYPP, etc. (normalized short codes)
    "locus_name" TEXT NOT NULL,         -- Extension, Agouti, Tobiano, etc.
    "allele1" TEXT,
    "allele2" TEXT,
    "genotype" TEXT,                    -- Combined genotype (N/N, TO/to, etc.)
    "network_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_loci_animal_id_fkey" FOREIGN KEY ("animal_id")
        REFERENCES "animals"("id") ON DELETE CASCADE
);

-- Unique constraint: one locus per category per animal
CREATE UNIQUE INDEX "animal_loci_animal_id_category_locus_key"
    ON "animal_loci"("animal_id", "category", "locus");

-- Performance indexes
CREATE INDEX "animal_loci_locus_idx" ON "animal_loci"("locus");
CREATE INDEX "animal_loci_genotype_idx" ON "animal_loci"("genotype");
CREATE INDEX "animal_loci_locus_genotype_idx" ON "animal_loci"("locus", "genotype");
```

### Categories

- `coatColor` - Coat color genetics (E, A, Cr, D, G, etc.)
- `coatType` - Coat length and texture (L, F, Cu, etc.)
- `physicalTraits` - Size, structure, features (IGF1, BT, Dw, etc.)
- `eyeColor` - Eye color genetics
- `performance` - Performance traits (MSTN, DMRT3, PPARGC1A)
- `temperament` - Behavioral genetics
- `health` - Health conditions (HYPP, GBED, PSSM1, etc.)
- `otherTraits` - Other genetic markers
- `bloodType` - Blood typing

## Code Normalization

All locus codes are normalized to **short codes** to ensure consistency:

- ✅ `TO` (Tobiano)
- ✅ `E` (Extension)
- ✅ `HYPP` (Hyperkalemic Periodic Paralysis)
- ❌ `TOBIANO` → normalized to `TO`
- ❌ `EXTENSION` → normalized to `E`

See [`src/utils/genetics-code-normalizer.ts`](../src/utils/genetics-code-normalizer.ts) for complete mapping tables.

## Setup & Migration

### 1. Run the Prisma Migration

The `AnimalLoci` model has been added to `prisma/schema.prisma`. Generate and run the migration:

```bash
# Development
npm run db:dev:migrate

# Production
npm run db:prod:deploy
```

This creates:
- `animal_loci` table with all B-tree indexes
- Unique constraint on (animal_id, category, locus)
- Foreign key to animals table with CASCADE delete
- Auto-updating `updated_at` column via Prisma

### 2. Create Database Trigger (Critical!)

After the table is created, add the database trigger that automatically syncs JSONB → animal_loci:

```bash
# Development
psql -U your_user -d your_dev_database -f prisma/migrations/add-animal-loci-trigger.sql

# Production
psql -U your_user -d your_prod_database -f prisma/migrations/add-animal-loci-trigger.sql
```

**What this does**:
- Creates `normalize_locus_code()` function (TOBIANO → TO, etc.)
- Creates `sync_animal_loci_from_genetics()` trigger function
- Attaches trigger to `animal_genetics` table on INSERT/UPDATE
- **From this point on, all genetics saves automatically sync to animal_loci**

### 3. Add GIN Indexes (Optional)

Optionally add GIN indexes to the existing JSONB columns for fast JSONB containment queries:

```bash
# Development
psql -U your_user -d your_dev_database -f prisma/migrations/add-gin-indexes.sql

# Production
psql -U your_user -d your_prod_database -f prisma/migrations/add-gin-indexes.sql
```

**Note**: These are optional since you'll primarily search via `animal_loci` now, but they improve JSONB query performance if needed.

### 4. Rebuild Index for Existing Data (One-Time)

For existing genetics data that was saved BEFORE the trigger was installed, rebuild the index:

```bash
# Populate animal_loci from existing animal_genetics records
npx tsx scripts/sync-animal-loci.ts
```

**This is a ONE-TIME operation**. After the trigger is installed (step 2), all future saves automatically sync.

**What the script does:**
- Reads all existing `animal_genetics` records
- Extracts loci from JSONB columns
- Normalizes locus codes
- Inserts into `animal_loci` table

**Output example:**
```
Processing: Painted Lady (ID: 396, Species: HORSE)
  ✓ Inserted 15 loci

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sync complete!
   Animals processed: 127
   Total loci inserted: 2,458
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to re-run this script:**
- Never, under normal circumstances (trigger handles ongoing sync)
- Only if `animal_loci` gets corrupted or out of sync (rare)
- After bulk data imports that bypass the trigger

### 5. Verify Setup

The script outputs example queries to verify data:

```typescript
// Find Tobiano carriers
SELECT animal_id, genotype FROM animal_loci WHERE locus = 'TO' AND genotype != 'N/N';

// Count loci by category
SELECT category, COUNT(*) FROM animal_loci GROUP BY category;
```

## Usage

### Automatic Database Sync

**The database trigger handles all synchronization automatically.** Application code only updates `animal_genetics` JSONB:

**PUT /animals/:id/genetics**
```typescript
// Application saves to animal_genetics
await api.put(`/api/v1/animals/${id}/genetics`, {
  coatColorData: [...],
  healthGeneticsData: [...],
  // ...
});
// → Database trigger automatically updates animal_loci ✅
```

**POST /animals/:id/genetics/import**
```typescript
// Application saves to animal_genetics
await api.post(`/api/v1/animals/${id}/genetics/import`, {
  provider: 'embark',
  fileContent: csvData,
});
// → Database trigger automatically updates animal_loci ✅
```

**Key point**: No manual sync calls in application code. Database handles it via trigger.

### Query Functions

Use the provided query functions for common searches:

```typescript
import { geneticsQueries } from '../utils/genetics-search-queries';

// Find all Tobiano carriers
const carriers = await geneticsQueries.findCarriers('TO', 'HORSE');
// Returns: [{ animalId: 396, locus: 'TO', genotype: 'TO/to', ... }]

// Find animals with red factor (e allele)
const redFactors = await geneticsQueries.findAnimalsWithAllele('E', 'e');

// Find homozygous Tobiano (TO/TO)
const homozygous = await geneticsQueries.findByGenotype('TO', 'TO/TO');

// Find horses clear of HYPP, GBED, PSSM1
const clearAnimals = await geneticsQueries.findClearOfConditions(['HYPP', 'GBED', 'PSSM1']);

// Find breeding-compatible pairs (e.g., non-Frame Overo for OLWS safety)
const compatible = await geneticsQueries.findCompatiblePairs(animalId, 'O', 'n/n');

// Get genotype distribution stats
const stats = await geneticsQueries.getLocusStats('TO', 'HORSE');
// Returns: [{ genotype: 'TO/to', count: 45 }, { genotype: 'N/N', count: 82 }, ...]
```

## Example Queries

### Find Tobiano Carriers (Any Species)

```sql
SELECT a.id, a.name, al.genotype
FROM animal_loci al
INNER JOIN animals a ON a.id = al.animal_id
WHERE al.locus = 'TO'
  AND al.genotype IS NOT NULL
  AND al.genotype != 'N/N';
```

### Find Horses Clear of Multiple Health Conditions

```sql
SELECT a.id, a.name, COUNT(DISTINCT al.locus) as cleared_tests
FROM animal_loci al
INNER JOIN animals a ON a.id = al.animal_id
WHERE al.locus IN ('HYPP', 'GBED', 'PSSM1', 'HERDA', 'MH')
  AND al.genotype IN ('N/N', 'Clear')
  AND a.species = 'HORSE'
GROUP BY a.id, a.name
HAVING COUNT(DISTINCT al.locus) = 5  -- All 5 tests clear
ORDER BY a.name;
```

### Find Compatible Breeding Pairs (Avoid OLWS)

```sql
-- Find horses that are NOT Frame Overo carriers (safe to breed to Frame carriers)
SELECT a.id, a.name
FROM animals a
WHERE a.species = 'HORSE'
  AND EXISTS (
    SELECT 1 FROM animal_loci al
    WHERE al.animal_id = a.id
      AND al.locus = 'O'
      AND al.genotype = 'n/n'  -- Non-carrier
  );
```

### Find Animals with Public Genetics

```sql
SELECT a.id, a.name, al.locus, al.genotype
FROM animal_loci al
INNER JOIN animals a ON a.id = al.animal_id
WHERE al.network_visible = true
  AND al.locus = 'TO'
ORDER BY a.name;
```

### Genotype Distribution for a Locus

```sql
SELECT al.genotype, COUNT(*) as count
FROM animal_loci al
INNER JOIN animals a ON a.id = al.animal_id
WHERE al.locus = 'DMRT3'  -- Gait keeper gene
  AND a.species = 'HORSE'
GROUP BY al.genotype
ORDER BY count DESC;
```

## Performance Benefits

### Before (JSONB only)

```sql
-- Slow: Full table scan with JSONB parsing
SELECT * FROM animal_genetics
WHERE coat_color_data @> '[{"locus": "TO"}]';
```

**Problem**: Must scan all JSONB data, parse nested arrays, check each locus.

### After (Normalized table)

```sql
-- Fast: Direct index lookup
SELECT * FROM animal_loci WHERE locus = 'TO';
```

**Benefit**: Direct B-tree index lookup on `locus` column.

### Benchmark (Estimated)

| Query Type | JSONB | animal_loci | Speedup |
|------------|-------|-------------|---------|
| Find carriers | ~500ms | ~5ms | 100x |
| Genotype filter | ~800ms | ~8ms | 100x |
| Multiple conditions | ~2s | ~20ms | 100x |

*Based on 10,000 animals with avg 20 loci each*

## Maintenance

### Re-sync All Data (Rare)

**With the database trigger, tables should NEVER get out of sync.**

However, if you suspect corruption or need to rebuild the index:

```bash
# Rebuild animal_loci from animal_genetics (safe to run multiple times)
npx tsx scripts/sync-animal-loci.ts
```

**When this might be needed:**
- After bulk data imports that bypassed the trigger
- Database restore from backup
- Manual JSONB edits outside normal endpoints

The script uses `ON CONFLICT ... DO UPDATE` so it's safe to re-run.

### Privacy Settings

Privacy changes are automatically synced via the trigger. Just update `animal_genetics` JSONB:

```typescript
// Update networkVisible in JSONB → trigger syncs to animal_loci automatically
await prisma.animalGenetics.update({
  where: { animalId },
  data: { coatColorData: updatedArray }
});
// → Database trigger updates animal_loci.network_visible ✅
```

### Verify Data Integrity

```sql
-- Check for animals with genetics but no loci
SELECT a.id, a.name
FROM animals a
INNER JOIN animal_genetics ag ON ag.animal_id = a.id
LEFT JOIN animal_loci al ON al.animal_id = a.id
WHERE al.id IS NULL;

-- Should return 0 rows if sync is complete
```

## Future Enhancements

### Planned Features

1. **Breeding Recommendations API**
   - Suggest compatible pairs based on genetic goals
   - Avoid lethal combinations (OLWS, etc.)
   - Maximize desired traits

2. **Population Genetics Dashboard**
   - Carrier frequency by breed
   - Diversity metrics
   - Inbreeding coefficients

3. **Search Marketplace by Genetics**
   - Find stallions with specific traits
   - Filter by health clearances
   - Public genetics visibility

4. **Genetic Alerts**
   - Notify when risky pairings detected
   - Carrier status for breeding animals
   - Missing recommended tests

## Troubleshooting

### Issue: Loci Not Appearing in Search

**Check**: Are codes normalized?

```sql
-- Check raw codes in animal_loci
SELECT DISTINCT locus FROM animal_loci WHERE animal_id = 396;
```

If you see `TOBIANO` instead of `TO`, re-run sync script.

### Issue: Counts Don't Match

**Verify sync**:

```sql
-- Compare JSONB vs normalized counts
SELECT
  (SELECT COUNT(*) FROM jsonb_array_elements(coat_color_data) WHERE value->>'locus' = 'TO' FROM animal_genetics WHERE animal_id = 396) as jsonb_count,
  (SELECT COUNT(*) FROM animal_loci WHERE animal_id = 396 AND locus = 'TO') as loci_count;
```

Should return same count for both columns.

### Issue: Performance Still Slow

**Check indexes**:

```sql
-- Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'animal_loci';
```

Should show indexes on `locus`, `genotype`, `(locus, genotype)`, etc.

## Files Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | AnimalLoci model definition (generates table) |
| `prisma/migrations/add-animal-loci-trigger.sql` | **Database trigger for automatic sync** (CRITICAL) |
| `prisma/migrations/add-gin-indexes.sql` | GIN indexes for JSONB columns (optional) |
| `scripts/sync-animal-loci.ts` | Rebuild index utility (one-time or emergency use) |
| `src/utils/genetics-code-normalizer.ts` | Normalizes locus codes (TOBIANO → TO) - used in endpoints |
| `src/utils/genetics-search-queries.ts` | Pre-built query functions for common searches |
| `src/routes/animals.ts` | API endpoints (only update animal_genetics JSONB) |

**Deprecated** (no longer used with trigger approach):
- ~~`src/utils/sync-animal-loci-helper.ts`~~ - Manual sync functions (replaced by trigger)

## Summary

✅ **Fast searches** - 100x faster than JSONB queries
✅ **Database-managed sync** - Trigger handles it automatically, not application code
✅ **Single source of truth** - JSONB is master, animal_loci is searchable index
✅ **No sync bugs** - Database can't forget to sync
✅ **Code normalization** - Consistent short codes (TO, E, HYPP)
✅ **Query examples** - Pre-built functions for common searches
✅ **Safe rebuild** - Sync script is idempotent for emergency use

For questions or issues, see the [main genetics documentation](./GENETICS.md).
