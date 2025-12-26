# Party Migration Baseline

**Frozen**: 2025-12-26
**Tag**: `v0.2.0-party-migration-complete`
**Commit**: `d9f9e9f` (Restore backfill SQL scripts as operational recovery tools)
**Branch**: `dev`

## Scope of Completion

The Party migration has been **fully completed** and validated across all affected tables:

### Migration Phases Completed

1. **Step 5 (Additive Phase)**: ✅ Complete
   - Added Party-based columns alongside legacy Contact/Organization columns
   - Backfilled Party data from legacy columns
   - Maintained dual-column compatibility for zero-downtime migration
   - All tables support both legacy and Party-based access patterns

2. **Step 6 (Cleanup Phase)**: ✅ Complete
   - **IRREVERSIBLE**: Dropped all legacy `*ContactId` and `*OrganizationId` columns
   - Party is now the single source of truth for Contact/Organization identity
   - All foreign key constraints, indexes, and unique constraints updated
   - Backward compatibility maintained via runtime API mapping

### Tables Migrated

13 tables migrated to Party-only storage:

| Table | Legacy Columns Removed | Party Column |
|-------|------------------------|--------------|
| Animal | buyerContactId, buyerOrganizationId | ownerPartyId |
| AnimalOwner | ownerContactId, ownerOrganizationId | ownerPartyId |
| Attachment | contactId | attachmentPartyId |
| BreedingAttempt | studOwnerContactId, studOwnerOrganizationId | studOwnerPartyId |
| ContractParty | contactId, organizationId | partyId |
| Invoice | contactId, organizationId | clientPartyId |
| Offspring | buyerContactId, buyerOrganizationId, buyerPartyType | buyerPartyId |
| OffspringContract | buyerContactId, buyerOrganizationId | buyerPartyId |
| OffspringGroupBuyer | buyerContactId, buyerOrganizationId | buyerPartyId |
| PlanParty | contactId, organizationId | partyId |
| TagAssignment | contactId, organizationId | taggedPartyId |
| User | contactId | partyId |
| WaitlistEntry | clientContactId, clientOrganizationId | clientPartyId |

### Validation Status

All migrations validated via:
- ✅ Post-migration SQL validation scripts executed
- ✅ Schema column removal confirmed
- ✅ Foreign key constraints verified
- ✅ Index coverage verified
- ✅ Data coverage at or near 100%
- ✅ No orphaned Party references
- ✅ TypeScript compilation passes
- ✅ Runtime backward compatibility validated

## Artifact Locations

### Migration Files

**Location**: `prisma/migrations/`

**Total Migrations**: 63
- Pre-Party: 43 migrations (baseline + feature development)
- Step 5 (Additive): 7 migrations
- Step 6 (Cleanup): 13 migrations (IRREVERSIBLE)

**Complete Inventory**: See [`MIGRATION_INVENTORY.md`](./MIGRATION_INVENTORY.md)

### Validation SQL Scripts

**Location**: `prisma/sql/`

**Post-Migration Validation Scripts**:
```
validate_step6_attachments_party_only.sql
validate_step6_offspring_buyer_post.sql
validate_step6_offspring_group_buyer_post.sql
validate_step6_party_only_runtime.sql
validate_step6_tags_party_only_post.sql
validate_step6_waitlist_post.sql
validate_step6f_planparty_post.sql
validate_step6g_animal_post.sql
validate_step6h_animalowner_post.sql
validate_step6i_breedingattempt_post.sql
validate_step6j_invoice_post.sql
validate_step6k_contractparty_post.sql
validate_step6l_offspringcontract_post.sql
validate_step6m_user_post.sql
```

**Runtime Validation**:
- `validate_step6_party_only_runtime.sql` - Verifies backward compatibility mapping functions

### Backfill Recovery Scripts

**Location**: `prisma/sql/backfills/`

**Purpose**: Operational recovery tools for data repair scenarios

```
backfill_party_step5_finance.sql
backfill_party_step5_offspring_waitlist.sql
backfill_party_step5_tags.sql
backfill_step6f_planparty_party_only.sql
```

**Note**: These scripts are idempotent and safe to run multiple times. They are NOT part of the standard migration flow but serve as repair tools if Party data integrity issues occur.

### Validation Documentation

**Location**: `../breederhq/` (frontend repository)

**Step 6 Validation Docs**:
```
VALIDATION_QUERIES_STEP6_OFFSPRING.md
VALIDATION_QUERIES_STEP6_OFFSPRING_GROUP_BUYER.md
VALIDATION_QUERIES_STEP6_PLANPARTY.md
VALIDATION_QUERIES_STEP6_TAGS.md
VALIDATION_QUERIES_STEP6_WAITLIST.md
TEST_PLAN_STEP6_*.md
```

**Purpose**: Human-readable validation instructions and test plans mirrored from API repository for traceability.

## Baseline Verification

### Development Database Status

**Database**: `bhq_dev` (Neon PostgreSQL)
**Status**: ✅ Up to date
**Migrations Applied**: 63/63

**Captured**: 2025-12-26

```
npx dotenv -e .env.dev -- npx prisma migrate status --schema=prisma/schema.prisma
```

**Output**:
```
63 migrations found in prisma/migrations
Database schema is up to date!
```

### Production Database Verification Instructions

**⚠️ IMPORTANT**: Production verification must be performed manually.

#### Step 1: Check Migration Status

```bash
# From breederhq-api repository root
npm run db:prod:status
```

**Expected Output**:
```
63 migrations found in prisma/migrations
Database schema is up to date!
```

**If Behind**: Run `npm run db:prod` to apply pending migrations (ensure backups exist first).

#### Step 2: Run Post-Migration Validation

Execute each Step 6 validation script against the production database:

```bash
# Set production database URL
export DATABASE_URL="<production_database_url>"

# Run all Step 6 post-migration validations
psql $DATABASE_URL -f prisma/sql/validate_step6_attachments_party_only.sql
psql $DATABASE_URL -f prisma/sql/validate_step6_offspring_buyer_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6_offspring_group_buyer_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6_party_only_runtime.sql
psql $DATABASE_URL -f prisma/sql/validate_step6_tags_party_only_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6_waitlist_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6f_planparty_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6g_animal_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6h_animalowner_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6i_breedingattempt_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6j_invoice_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6k_contractparty_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6l_offspringcontract_post.sql
psql $DATABASE_URL -f prisma/sql/validate_step6m_user_post.sql
```

**Expected Results**: All validation checks should pass with 0 errors.

See individual validation script files for expected output details.

#### Step 3: Generate Schema Dump

**Purpose**: Capture a snapshot of the production database schema for auditing and disaster recovery.

```bash
# Generate schema-only dump (no data)
pg_dump --schema-only \
  --no-privileges \
  --no-owner \
  --schema=public \
  $DATABASE_URL \
  > schema_dump_party_migration_baseline_$(date +%Y%m%d).sql

# Generate schema + data dump (full backup - LARGE FILE)
pg_dump --format=custom \
  --compress=9 \
  --schema=public \
  $DATABASE_URL \
  > full_backup_party_migration_baseline_$(date +%Y%m%d).dump
```

**Storage**: Store dumps in secure backup location (S3, encrypted storage, etc.)

**Recommended Retention**:
- Schema dump: 1 year minimum
- Full backup: 90 days minimum, longer if required by compliance

### Verification Checklist

Before considering production baseline complete:

- [ ] Production migration status shows 63/63 migrations applied
- [ ] All Step 6 post-migration validation scripts pass with 0 errors
- [ ] Schema dump generated and stored securely
- [ ] Full backup generated and stored securely
- [ ] Production runtime tests confirm backward compatibility
- [ ] No error spikes in production logs after migration
- [ ] Data integrity spot-checks completed (sample queries against Party relationships)

## Database Schema Snapshot

**As of**: 2025-12-26
**Commit**: d9f9e9f

### Core Party Architecture

**Party Table**: Single source of truth for Contact/Organization identity
```sql
Party {
  id: SERIAL PRIMARY KEY
  type: 'CONTACT' | 'ORGANIZATION'
  name: TEXT
  tenantId: INT
  -- Additional metadata fields
}
```

**Contact/Organization Tables**: Back Party with entity-specific data
```sql
Contact {
  id: SERIAL PRIMARY KEY
  partyId: INT REFERENCES Party(id) -- 1:1 relationship
  -- Contact-specific fields (display_name, email, phone, etc.)
}

Organization {
  id: SERIAL PRIMARY KEY
  partyId: INT REFERENCES Party(id) -- 1:1 relationship
  -- Organization-specific fields (name, type, etc.)
}
```

### Party Relationships

All migrated tables now reference Party exclusively:

**Example (Offspring)**:
```sql
Offspring {
  id: SERIAL PRIMARY KEY
  buyerPartyId: INT REFERENCES Party(id) -- Removed: buyerContactId, buyerOrganizationId
  -- Other offspring fields
}
```

**Backward Compatibility Pattern** (API layer):
```typescript
// Legacy: { buyerContactId: 123, buyerOrganizationId: null }
// Now derived from Party:
const party = await prisma.party.findUnique({ where: { id: offspring.buyerPartyId } })
const buyerContactId = party.type === 'CONTACT' ? party.Contact.id : null
const buyerOrganizationId = party.type === 'ORGANIZATION' ? party.Organization.id : null
```

## Migration State

### Current State: Party-Only (Step 6 Complete)

- **Schema**: Party columns only, legacy columns removed
- **API**: Backward compatible via runtime mapping
- **Data**: 100% migrated to Party-based storage
- **Rollback**: **NOT POSSIBLE** (Step 6 is irreversible)

### Irreversibility Notice

**⚠️ CRITICAL**: Step 6 migrations are **IRREVERSIBLE**

The following data has been permanently removed from the database schema:
- All `*ContactId` columns (e.g., `buyerContactId`, `clientContactId`, `contactId`)
- All `*OrganizationId` columns (e.g., `buyerOrganizationId`, `organizationId`)
- All related foreign key constraints and indexes
- `Offspring.buyerPartyType` enum column

**Recovery Path**: If Party data integrity issues occur, use backfill scripts in `prisma/sql/backfills/` to reconstruct Party relationships from Contact/Organization tables.

**Do Not Attempt**: Rolling back Step 6 migrations will result in schema inconsistencies and data loss.

## Next Steps

With Party migration baseline complete, the following phases are now unblocked:

1. **Phase 4: Unified Contacts UI** (breederhq repository)
   - Requires: This baseline frozen and tagged ✅
   - Implement single Party-aware contact management UI
   - Replace dual Contact/Organization selectors with unified Party selectors

2. **Phase 5: Contact Consolidation**
   - Deduplicate Contact/Organization records
   - Merge Party relationships
   - Clean up orphaned Party records

3. **Phase 6: Party Metadata Enhancement**
   - Add Party-level custom fields
   - Implement Party-level tags and notes
   - Enhance Party search and filtering

4. **Phase 7: API Optimization**
   - Remove legacy mapping code
   - Optimize Party relationship queries
   - Add GraphQL Party endpoints (if applicable)

## Tag Information

**Tag Name**: `v0.2.0-party-migration-complete`
**Tag Type**: Annotated
**Tag Message**: Party migration baseline - Step 6 complete and validated

**Creation Command**:
```bash
git tag -a v0.2.0-party-migration-complete -m "Party migration baseline - Step 6 complete and validated"
git push origin v0.2.0-party-migration-complete
```

## Audit Trail

### Commits Included in Baseline

**Final Commit**: d9f9e9f - Restore backfill SQL scripts as operational recovery tools

**Key Step 6 Commits** (newest to oldest):
- d9f9e9f - Restore backfill SQL scripts as operational recovery tools
- 6e7bc32 - Cleanup: Archive pre-migration SQL validation scripts
- a898a45 - Step 6: Complete Party-only operational updates for backward compatibility
- f150fd1 - Refactor: Update schema for Step 6 Party-only migrations
- 46f8ef6 - Feat: Step 6M User Party-only migration
- 73f0375 - Feat: Step 6L OffspringContract buyer Party-only migration
- 82d08ef - Feat: Step 6K ContractParty Party-only migration
- c746692 - Feat: Step 6J Invoice client Party-only migration
- 90a5127 - Feat: Step 6I BreedingAttempt stud owner Party-only migration
- d73740b - Feat: Step 6H AnimalOwner Party-only migration
- 82026b6 - Feat: Step 6G Animal buyer Party-only migration
- e5b26c4 - Step 6F: Add PlanParty validation SQL scripts
- 76fba1c - Step 6F: PlanParty drop legacy columns
- 41b67eb - Step 6E: Waitlist drop legacy client columns
- 4c547db - Step 6E: Waitlist map legacy client fields to Party-only storage
- ... (See git log for complete Step 5 and pre-Party commits)

## Contact

For questions or issues related to the Party migration baseline:

1. Review validation documentation in `../breederhq/VALIDATION_QUERIES_STEP6_*.md`
2. Check migration inventory in `MIGRATION_INVENTORY.md`
3. Consult backfill scripts in `prisma/sql/backfills/` for data repair guidance
4. Review commit history for implementation details

---

**Baseline Frozen**: 2025-12-26
**Maintainer**: BreederHQ Engineering
**Status**: ✅ Complete and Validated
