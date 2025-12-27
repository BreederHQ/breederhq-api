# Migration Inventory - Party Migration Baseline

**Generated**: 2025-12-26
**Baseline Commit**: d9f9e9f
**Tag**: v0.2.0-party-migration-complete

This document provides a complete inventory of all Prisma migrations in execution order, with special emphasis on the Party migration (Steps 5 and 6).

## Migration Execution Order

### Pre-Party Baseline Migrations (Sept-Dec 2024)

| # | Migration | Description | Irreversible |
|---|-----------|-------------|--------------|
| 1 | `20250921224326_init_contacts_clean` | Initial contacts module schema creation | No |
| 2 | `20250921232453_contacts_add_archive_fields` | Added archival fields to contacts | No |
| 3 | `20250928210625_add_whatsapp_fields` | Added WhatsApp integration fields | No |
| 4 | `20250929154733_add_contact_affiliations` | Added contact affiliation relationships | No |
| 5 | `20250929162629_invite_signup_and_contact_kind` | Added invite system and contact kind field | No |
| 6 | `20250929190021_npx_prisma_generate` | Prisma client regeneration marker | No |
| 7 | `20251001195924_animals_module_additions` | Added animals module fields and relationships | No |
| 8 | `20251002163851_animals_v1_drawer` | Added animal drawer UI support fields | No |
| 9 | `20251004192128_add_master_breeds_minimal` | Added master breed catalog tables | No |
| 10 | `20251005_add_org_preferences` | Added organization preference settings | No |
| 11 | `20251005171354_registry_catalog_and_links` | Added registry catalog and animal registry links | No |
| 12 | `20251005175114_add_status_text_on_registry_link` | Added status text field to registry links | No |
| 13 | `20251014074657_enable_citext` | Enabled citext extension for case-insensitive text | No |
| 14 | `20251014074658_baseline` | Baseline snapshot with enums and core tables | No |
| 15 | `20251014080117_change` | Schema adjustment (generic change) | No |
| 16 | `20251014171259_add_custom_breed` | Added custom breed support | No |
| 17 | `20251020113441_add_breeding_module_fields` | Added breeding module core fields | No |
| 18 | `20251024190624_add_breeding_custom_breeds` | Added custom breed linkage to breeding | No |
| 19 | `20251028130234_add_breeding_plan_counter` | Added breeding plan counter field | No |
| 20 | `20251029131558_add_completed_date_actual` | Added actual completion date field | No |
| 21 | `20251029154014_add_expected_weaned_go_home` | Added expected weaned and go-home dates | No |
| 22 | `20251030224603_add_tenant_availability_prefs` | Added tenant availability preferences | No |
| 23 | `20251031101941_change_breeding_date_values` | Changed breeding date value types | No |
| 24 | `20251031212846_change_breeding_date_fields_again` | Further breeding date field adjustments | No |
| 25 | `20251103152415_change_user_add_name_fields` | Added name fields to User model | No |
| 26 | `20251104112239_add_offspring_fields` | Added offspring module core fields | No |
| 27 | `20251105182405_add_tenant_fields_preferences` | Added tenant-level preference fields | No |
| 28 | `20251110153328_add_new_offspring_fields` | Added additional offspring fields | No |
| 29 | `20251111142528_add_new_offspring_fields_enhanced` | Enhanced offspring fields (iteration 2) | No |
| 30 | `20251111152148_add_new_offspring_fields_more_again` | Enhanced offspring fields (iteration 3) | No |
| 31 | `20251112145248_add_new_offspring_fields_andmorestill` | Enhanced offspring fields (iteration 4) | No |
| 32 | `20251116185158_add_new_offspring_group_fields` | Added offspring group management fields | No |
| 33 | `20251116205537_rename_offspring_group_name` | Renamed offspring group name field | No |
| 34 | `20251118193316_add_new_enum_species_goat_rabbit` | Added GOAT and RABBIT to Species enum | No |
| 35 | `20251122131500_add_invoices_fields` | Added invoice module fields | No |
| 36 | `20251124232821_add_breed_offspring` | Added breed linkage to offspring | No |
| 37 | `20251125230400_add_parents_offspring` | Added parent animal linkage to offspring | No |
| 38 | `20251210225125_add_photo_url_animals` | Added photo URL field to animals | No |
| 39 | `20251217020459_add_offspring_status_fields` | Added status tracking fields to offspring | No |
| 40 | `20251217024345_add_new_horse_fields` | Added horse-specific fields | No |
| 41 | `20251218074340_add_invite_and_animal_breed_models` | Added invite and animal breed models | No |
| 42 | `20251219111051_enable_citext` | Re-enabled/verified citext extension | No |
| 43 | `20251220090559_add_user_password_flags` | Added password security flags to User | No |

### Party Migration - Step 5 (Additive Phase)

**Purpose**: Add Party-based relationships alongside legacy Contact/Organization fields for dual-column compatibility.

| # | Migration | Description | Irreversible |
|---|-----------|-------------|--------------|
| 44 | `20251224_party_step5_breeding_party` | Added partyId columns to BreedingAttempt, PlanParty, WaitlistEntry, OffspringGroupBuyer, Offspring, Invoice, ContractParty, OffspringContract with indexes and foreign keys | No |
| 45 | `20251224115227_party_step5_attachment_party` | Added attachmentPartyId to Attachment table with backfill from contactId via Contact.partyId | No |
| 46 | `20251224122510_party_step5_tags_party` | Added taggedPartyId to TagAssignment table for party-based tagging | No |
| 47 | `20251225_party_step5_animals_party` | Added ownerPartyId to Animal and AnimalOwner tables for party-based ownership tracking | No |
| 48 | `20251225_party_step5_finance_party` | Added clientPartyId columns to finance-related tables (already covered in breeding_party migration) | No |
| 49 | `20251225_party_step5_user_party` | Added partyId to User table for party-based user identity | No |
| 50 | `20251225061321_party_step5_offspring_waitlist_party` | Added party columns to offspring and waitlist tables (consolidation migration) | No |

### Party Migration - Step 6 (Cleanup Phase - IRREVERSIBLE)

**Purpose**: Remove legacy Contact/Organization ID columns, making Party the single source of truth.

| # | Migration | Description | Irreversible |
|---|-----------|-------------|--------------|
| 51 | `20251225063854_step6_attachments_party_only` | **IRREVERSIBLE**: Dropped Attachment.contactId column and related constraints | **YES** |
| 52 | `20251225064400_step6_tags_party_only` | **IRREVERSIBLE**: Dropped TagAssignment.contactId and organizationId columns and related constraints | **YES** |
| 53 | `20251225_step6_offspring_group_buyer_party_only` | **IRREVERSIBLE**: Dropped OffspringGroupBuyer.buyerContactId and buyerOrganizationId columns | **YES** |
| 54 | `20251225_step6_offspring_buyer_party_only` | **IRREVERSIBLE**: Dropped Offspring.buyerContactId, buyerOrganizationId, and buyerPartyType columns | **YES** |
| 55 | `20251225_step6_waitlist_party_only` | **IRREVERSIBLE**: Dropped WaitlistEntry.clientContactId and clientOrganizationId columns | **YES** |
| 56 | `20251225172548_step6f_planparty_party_only` | **IRREVERSIBLE**: Dropped PlanParty.contactId and organizationId columns | **YES** |
| 57 | `20251226003347_step6g_animal_buyer_party_only` | **IRREVERSIBLE**: Dropped Animal.buyerContactId and buyerOrganizationId columns | **YES** |
| 58 | `20251225185510_step6h_animalowner_party_only` | **IRREVERSIBLE**: Dropped AnimalOwner.ownerContactId and ownerOrganizationId columns | **YES** |
| 59 | `20251225190453_step6i_breedingattempt_studowner_party_only` | **IRREVERSIBLE**: Dropped BreedingAttempt.studOwnerContactId and studOwnerOrganizationId columns | **YES** |
| 60 | `20251226011248_step6j_invoice_client_party_only` | **IRREVERSIBLE**: Dropped Invoice.contactId and organizationId columns (client identity) | **YES** |
| 61 | `20251226014000_step6k_contractparty_party_only` | **IRREVERSIBLE**: Dropped ContractParty.contactId and organizationId columns | **YES** |
| 62 | `20251226020000_step6l_offspringcontract_buyer_party_only` | **IRREVERSIBLE**: Dropped OffspringContract.buyerContactId and buyerOrganizationId columns | **YES** |
| 63 | `20251226013914_step6m_user_party_only` | **IRREVERSIBLE**: Dropped User.contactId column | **YES** |

## Migration Summary Statistics

- **Total Migrations**: 63
- **Pre-Party Migrations**: 43
- **Party Step 5 (Additive)**: 7
- **Party Step 6 (Cleanup)**: 13
- **Irreversible Migrations**: 13 (all Step 6 migrations)

## Party Migration Scope

### Tables Modified in Party Migration

**Step 5 (Additive)**:
- Animal (ownerPartyId)
- AnimalOwner (ownerPartyId)
- Attachment (attachmentPartyId)
- BreedingAttempt (studOwnerPartyId)
- ContractParty (partyId)
- Invoice (clientPartyId)
- Offspring (buyerPartyId)
- OffspringContract (buyerPartyId)
- OffspringGroupBuyer (buyerPartyId)
- PlanParty (partyId)
- TagAssignment (taggedPartyId)
- User (partyId)
- WaitlistEntry (clientPartyId)

**Step 6 (Cleanup)** - Same tables, removed legacy columns:
- Dropped all `*ContactId` columns
- Dropped all `*OrganizationId` columns
- Dropped all related foreign key constraints and indexes
- Retained Party-based columns as single source of truth

## Data Integrity Notes

### Backfill Operations

Step 5 migrations included inline backfill operations to populate Party columns from legacy Contact/Organization columns:

- **Attachment**: Backfilled `attachmentPartyId` from `Contact.partyId` via `contactId`
- **All Other Tables**: Backfilled via dedicated SQL scripts in `prisma/sql/backfills/`

### Validation Coverage

Post-migration validation SQL scripts exist for all Step 6 migrations:
- Located in: `prisma/sql/validate_step6*.sql`
- Verify column removal, Party FK integrity, index existence, and data coverage
- See: `PARTY_MIGRATION_BASELINE.md` for validation artifact locations

## Rollback Considerations

### Pre-Step 6 State (Reversible)

All migrations through Step 5 are reversible via standard Prisma rollback:
```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

### Post-Step 6 State (IRREVERSIBLE)

**Step 6 migrations are NOT reversible** because they drop columns containing data:

- **Data Loss**: Legacy `*ContactId` and `*OrganizationId` columns are permanently removed
- **Recovery Path**: Data can be reconstructed from Party relationships via Contact/Organization
- **Backfill Scripts**: Available in `prisma/sql/backfills/` for data repair scenarios
- **Forward-Only**: The only safe direction is forward; do not attempt rollback

### Recovery Strategy

If Party data integrity issues occur:
1. Use backfill scripts in `prisma/sql/backfills/`
2. Verify with validation scripts in `prisma/sql/validate_step6*.sql`
3. Consult validation documentation in frontend repo: `VALIDATION_QUERIES_STEP6_*.md`

## Migration Execution Pattern

### Step 5 Pattern (Additive)
```sql
-- 1. Add new Party-based column
ALTER TABLE "Table" ADD COLUMN "partyId" INTEGER;

-- 2. Add foreign key to Party
ALTER TABLE "Table" ADD CONSTRAINT "Table_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Add indexes
CREATE INDEX "Table_partyId_idx" ON "Table"("partyId");

-- 4. Backfill data (where applicable)
UPDATE "Table" SET "partyId" = (SELECT "partyId" FROM "Contact" WHERE ...)
```

### Step 6 Pattern (Cleanup - IRREVERSIBLE)
```sql
-- 1. Ensure Party column and constraints exist (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (...) THEN
    ALTER TABLE "Table" ADD COLUMN "partyId" INTEGER;
  END IF;
END $$;

-- 2. Drop legacy indexes
DROP INDEX IF EXISTS "Table_contactId_idx";
DROP INDEX IF EXISTS "Table_organizationId_idx";

-- 3. Drop legacy foreign keys
DO $$ BEGIN
  IF EXISTS (...) THEN
    ALTER TABLE "Table" DROP CONSTRAINT "Table_contactId_fkey";
  END IF;
END $$;

-- 4. Drop legacy columns (IRREVERSIBLE)
ALTER TABLE "Table" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "Table" DROP COLUMN IF EXISTS "organizationId";
```

## Validation Status

All Step 6 migrations have been validated with:
- ✅ Post-migration SQL validation scripts executed
- ✅ Schema inspection confirms column removal
- ✅ Foreign key constraints to Party verified
- ✅ Index coverage confirmed
- ✅ Data coverage at or near 100%
- ✅ No orphaned Party references

See `PARTY_MIGRATION_BASELINE.md` for validation artifact locations and instructions.

---

**Baseline Frozen**: 2025-12-26
**Commit**: d9f9e9f
**Tag**: v0.2.0-party-migration-complete
