# Scripts Directory

This directory contains utility scripts for the BreederHQ API. Scripts are organized into logical categories for easy discovery and maintenance.

## Directory Structure

### 📁 admin/ (7 scripts)
Administrative scripts for managing users, permissions, and system configuration.

- `bootstrap-global-admin-access.mjs` - Ensures global admin has all necessary access across surfaces
- `enable-public-program.mjs` - Makes an organization publicly discoverable on marketplace
- `enable-trait-history.ts` - Enable supportsHistory for exam-type traits
- `fix-admin-default-tenant.ts` - Fix admin user's default tenant setting
- `make-test-user-unlimited.ts` - Set up test user as super admin with unlimited quotas
- `promote-admin.ts` - Promote a marketplace user to admin role
- `reset-test-passwords.mjs` - Reset passwords for test users

### 📁 api-testing/ (25 scripts)
Scripts for testing API endpoints, rate limits, and feature functionality.

**General API Testing:**
- `audit-api-auth.js` - Audit which routes have auth protection
- `smoke-test-rate-limits.ps1` / `smoke-test-rate-limits.sh` - Test rate limiting on auth endpoints
- `test-contacts-api.ts` - Test contacts API endpoints
- `test-database-changes.ts` - Automated validation of database changes
- `test-genetics-lab.ts` - Genetics calculation engine test suite
- `test-quota-enforcement.ts` - Test quota enforcement on animals route
- `test-usage-api.ts` - Test usage API endpoints

**Marketplace Testing:**
- `test-admin.sh` / `test-admin-simple.sh` - Test admin dashboard functionality
- `test-geocode-search.sh` - Test geocoding and radius search
- `test-listings-simple.sh` / `test-listings-with-csrf.sh` - Test service listings
- `test-marketplace-messaging.sh` - Test marketplace messaging
- `test-marketplace-permissions.ts` - Test marketplace schema permissions
- `test-provider-registration.sh` - Test provider registration flow
- `test-reviews.sh` - Test review functionality
- `test-saved-notifications.sh` - Test saved notifications
- `test-search.sh` - Test search functionality
- `test-service-listings.sh` - Test service listings
- `test-websocket.sh` - Test WebSocket functionality

**Transaction Testing:**
- `test-partial-refunds.sh` - Test partial refund functionality
- `test-transactions-phase1.sh` - Transaction testing phase 1
- `test-transactions-phase2.sh` - Transaction testing phase 2
- `test-transactions-phase3.sh` - Transaction testing phase 3

### 📁 backfill/ (3 scripts)
Data migration and backfill scripts for updating existing records.

- `backfill-animals-party.ts` - Backfill Animals domain party references
- `backfill-invoice-categories.ts` - Backfill Invoice.category for existing invoices
- `backfill-organization-party.mjs` - Backfill Organization.partyId by creating Party records

### 📁 cleanup/ (15 scripts)
Scripts for cleaning up test data and removing specific records.

**E2E Test Cleanup:**
- `check-e2e-cleanup.ts` - Check for leftover E2E test data
- `cleanup-e2e-test-data.ts` - Clean up leftover E2E test data
- `purge-e2e-test-data.ts` - Hard delete all E2E test breeding plans and data

**Tenant-Specific Cleanup:**
- `cleanup-tatooine-test-data.ts` - Cleanup test data for Tatooine tenant
- `cleanup-tenant-4-simple.ts` - Simple cleanup for tenant 4
- `cleanup-tenant-4-test-data.ts` - Direct database cleanup for tenant 4
- `db-cleanup-tenant-4.ts` - Direct database cleanup for tenant 4
- `wipe-tatooine-breeding.ts` - Complete removal of ALL breeding data for Tatooine

**Specific Entity Cleanup:**
- `clean-duplicate-contacts.ts` - Identify and remove duplicate contacts
- `clean-tenant-programs.ts` - Delete legacy breeding programs from tenant
- `cleanup-remaining-offspring-groups-tenant-4.ts` - Cleanup numbered offspring groups
- `cleanup-specific-groups.ts` - Clean up specific offspring groups by ID
- `cleanup-test-offspring-groups.ts` - Clean up test offspring groups
- `cleanup-test-plans.ts` - Clean up test breeding plans
- `cleanup-test-plans-simple.ts` - Simple cleanup of test breeding plans
- `delete-all-breeding-plans-tenant-4.ts` - Delete ALL breeding plans from tenant 4

### 📁 debug/ (18 scripts)
Debugging and inspection scripts for troubleshooting issues.

**User & Session Debugging:**
- `check-user-session.ts` - Check user and tenant memberships
- `debug-portal-user.ts` - Debug portal user membership and party linkage
- `debug-tenant-session.ts` - Debug tenant session issues

**Data Inspection:**
- `check-enum-traits.ts` - Check all ENUM traits across species
- `check-goat-genetics.ts` - Check goat genetics data
- `check-group-410.ts` - Check specific offspring group
- `check-hogwarts-sub.ts` - Check Hogwarts tenant subscription
- `check-horse-genetics.ts` - Check horse genetics data
- `check-lineage.ts` - Check animal lineage/parent references
- `check-offspring-buyer.ts` - Check if offspring has buyerPartyId set
- `check-offspring-groups-tenant-4.ts` - Check offspring groups in tenant 4
- `check-tenant-programs.ts` - Check breeding programs for tenant
- `check-test-party.ts` - Check for existing party in tenant 4
- `find-test-plans.ts` - Find test breeding plans by name pattern
- `list-parties.ts` - List parties in tenant 4

**Tenant Inspection:**
- `check-tattooine.ts` - Check Tattooine tenant data
- `check-tattooine-access.ts` - Check Tattooine tenant memberships

### 📁 development/ (7 scripts)
Development environment setup and utility scripts.

- `grant-marketplace-permissions.sql` - Manual permission grant for marketplace schema
- `preflight-env.js` - Validate required environment variables before server boot
- `print-db-target.js` - Print database target without exposing credentials
- `render-start.mjs` - Render.com deployment start script
- `run-with-env.js` - Secure environment loader for Prisma commands
- `scheduling-reminders.ts` - Send reminder emails 24 hours before appointments
- `set-tattooine-default.ts` - Set Tattooine as admin user's default tenant

### 📁 migrations/ (18 scripts + v2 subdirectory)
Database migration management and validation scripts.

**Migration Management:**
- `audit-migrations.mjs` - Audit migration files and database state
- `check-migration-checksum.js` - Check migration file checksum
- `check-migration-integrity.mjs` - Check migration file integrity
- `check-migrations.js` - Check recent migrations from database
- `find-migration-diff.js` - Find differences in migration file
- `fix-all-migration-checksums.js` - Fix all migration checksums
- `fix-migration-checksum.js` - Fix specific migration checksum
- `prisma-apply-latest-migration-dev.mjs` - Apply latest migration to dev
- `validate-migration-order.mjs` - Validate migration dependency ordering

**Prisma Guards:**
- `prisma-guard.js` - Enforces safe database operations (v1 + v2 support)
- `prisma-guard-v2.js` - Enforces v2-only database access (blocks v1)
- `v1-blocked.js` - Blocks legacy v1 database commands

**Production Migration:**
- `prisma-migrate-diff-prod.mjs` - Generate migration SQL by diffing prod
- `prod-align-diff.mjs` - Generate SQL diff from prod to schema
- `prod-align-verify.mjs` - Verify prod database matches schema

**Testing:**
- `test-migration-system.sh` - Test migration system
- `test-shadow-db.js` - Shadow database readiness check
- `verify-migration-readiness.js` - Verify migration readiness

**v2 Subdirectory:**
Contains v2-specific migration workflow scripts.

### 📁 seeding/ (6 scripts + 2 subdirectories)
Data seeding scripts for development and testing.

**Main Seeding Scripts:**
- `add-esig-to-test-plan.ts` - Add E_SIGNATURES entitlement to E2E test plan
- `seed-e2e-test-data.ts` - Seed E2E test data for breeding business rules
- `seed-hogwarts-animals.ts` - Seed horse and goat animals for Hogwarts tenant
- `seed-hogwarts-entitlements.ts` - Seed entitlements for Hogwarts tenant
- `seed-ovulation-test-data.ts` - Create test dam with ovulation pattern data
- `seed-scheduling-dev.mjs` - Seed scheduling data for development

**demo-tenant/ subdirectory:**
- `seed-demo-tenant.ts` - Comprehensive demo tenant seeding script

**seed-validation-tenants/ subdirectory:**
Contains scripts for creating and managing validation test tenants with comprehensive test data.
- `check-comms.ts` - Check communication data
- `check-neo.ts` - Check Neo tenant data
- `check-offspring.ts` - Check offspring data
- `check-org-parties.ts` - Check organization parties
- `check-titles.ts` - Check title definitions
- `cleanup-validation-tenants.ts` - Cleanup validation tenant data
- `print-credentials.ts` - Print test user credentials
- `seed-data-config.ts` - Comprehensive seed data configuration
- `seed-dev.ts` - Seed validation tenants in dev
- `seed-prod.ts` - Seed validation tenants in prod
- `seed-title-definitions.ts` - Seed title definitions
- `seed-validation-tenants.ts` - Main validation tenant seeding script
- `simulate-inbox-api.ts` - Simulate inbox API behavior
- `test-inbox-query.ts` - Test inbox query functionality
- `README.md` - Detailed documentation for validation tenant seeding

### 📁 validation/ (7 scripts)
Data validation scripts to ensure database integrity.

**Party Migration Validation:**
- `validate-organization-partyid.mjs` - Validate Organization.partyId schema
- `validate-party-constraints.mjs` / `validate-party-constraints.ts` - Pre-constraint validation
- `validate-party-data-integrity.mjs` - Comprehensive party migration data integrity
- `validate-party-migration.ts` - Execute party migration SQL validation files
- `validate-step7-post.mjs` - Post-migration validation for Step 7

**Schema Validation:**
- `validate-schema-alignment.mjs` - Ensure Prisma schema matches database 100%

### 📁 verification/ (12 scripts)
Feature verification scripts to confirm functionality works as expected.

**Marketplace Verification:**
- `verify-marketplace-group-publish.ps1` - Verify offspring group publish/unpublish
- `verify-marketplace-registration.ps1` / `verify-marketplace-registration.sh` - Verify registration validation
- `verify-public-marketplace-routes.ps1` - Verify public marketplace route prefixes
- `verify-public-programs.ps1` - Verify public programs index endpoint
- `verify-tag-module-filtering.mjs` - Verify TagModule filtering in tags endpoint

**Scheduling Verification:**
- `verify-booking-concurrency.mjs` - Verify concurrent booking protection
- `verify-portal-scheduling.mjs` - Verify portal scheduling discovery and booking
- `verify-scheduling-endpoints.mjs` - Verify scheduling endpoints work correctly

**Placement Verification:**
- `verify-placement-gating.mjs` - Verify placement order gating (Phase 6)

**Data Cleanup Verification:**
- `verify-tatooine-clean.ts` - Verify Tatooine tenant is clean
- `verify-tenant-4-clean.ts` - Verify tenant 4 is completely clean

## Script Naming Conventions

Scripts follow these naming patterns:
- `check-*` - Inspection scripts that read and report data
- `cleanup-*` / `clean-*` - Scripts that remove/archive data
- `seed-*` - Scripts that create test/demo data
- `test-*` - Scripts that test API endpoints or functionality
- `verify-*` - Scripts that confirm features work as expected
- `validate-*` - Scripts that check data integrity
- `backfill-*` - Scripts that migrate existing data
- `fix-*` - Scripts that repair data or configuration issues
- `debug-*` - Scripts for troubleshooting specific issues

## Usage Guidelines

### Running Scripts

Most scripts can be run with one of these commands:

```bash
# TypeScript scripts
npx tsx scripts/<category>/<script-name>.ts

# JavaScript/Module scripts
node scripts/<category>/<script-name>.js
node scripts/<category>/<script-name>.mjs

# Shell scripts
bash scripts/<category>/<script-name>.sh

# PowerShell scripts
powershell scripts/<category>/<script-name>.ps1
```

### Environment Configuration

Many scripts require environment variables. Use dotenv to load them:

```bash
# Development environment
npx dotenv -e .env.dev -- npx tsx scripts/<category>/<script>.ts

# Production environment
npx dotenv -e .env.prod -- npx tsx scripts/<category>/<script>.ts

# Migration-specific environments
npx dotenv -e .env.dev.migrate -- node scripts/migrations/<script>.mjs
npx dotenv -e .env.prod.migrate -- node scripts/migrations/<script>.mjs
```

### Safety Considerations

**⚠️ Destructive Scripts** (use with caution):
- All scripts in `cleanup/` - These delete data permanently
- Scripts with `wipe-` prefix - Complete data removal
- Scripts with `purge-` prefix - Hard deletes without soft delete

**🔒 Production Scripts** (require extra care):
- Scripts in `migrations/` with `prod` in the name
- Scripts in `backfill/` when run against production
- Scripts in `admin/` that modify permissions

**✅ Safe to Run Repeatedly** (idempotent):
- Most `check-*` scripts (read-only)
- Most `verify-*` scripts (read-only)
- Most `validate-*` scripts (read-only)
- Scripts in `backfill/` (designed to be idempotent)
- Scripts in `seeding/` marked as idempotent

## Adding New Scripts

When adding new scripts to this directory:

1. **Choose the right category** - Place scripts in the most appropriate folder
2. **Follow naming conventions** - Use established prefixes (check-, test-, verify-, etc.)
3. **Add documentation** - Include a header comment explaining:
   - Purpose of the script
   - Usage instructions
   - Required environment variables
   - Whether it's safe to run multiple times
   - Any prerequisites or dependencies
4. **Update this README** - Add your script to the appropriate category section

## Migration History

**2026-01-21:** Organized 118 flat scripts into 10 logical categories:
- Created category-based folder structure
- Moved `db/` contents into `migrations/`
- Moved `demo-tenant/` and `seed-validation-tenants/` into `seeding/`
- Added comprehensive documentation

## Maintenance Notes

- The `testing/` directory exists but is currently empty - reserved for future use
- Scripts are intentionally NOT alphabetically sorted in categories - they're grouped by related functionality
- Many scripts reference specific tenant IDs (1, 4, 87) which correspond to:
  - Tenant 1: Tattooine (test tenant)
  - Tenant 4: Also used for testing
  - Tenant 87: Hogwarts (demo tenant)

## Need Help?

- For migration-related questions, see `migrations/` scripts
- For test data setup, see `seeding/seed-validation-tenants/README.md`
- For debugging issues, start with `debug/` scripts
- For verifying features work, see `verification/` scripts
