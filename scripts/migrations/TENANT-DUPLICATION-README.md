# Tenant Duplication Script: DEV → PROD

## Overview

This script duplicates all data for tenant #4 from the development database to production, including:

- ✅ Tenant record
- ✅ User account (`luke.skywalker@tester.com`)
- ✅ Tenant membership (owner/admin access)
- ✅ All animals (with full lineage/pedigree data)
- ✅ All contacts and organizations
- ✅ All breeding plans and reproductive cycles
- ✅ All offspring groups and offspring records
- ✅ All health records, vaccinations, titles, competition entries
- ✅ All documents, attachments, and document bundles
- ✅ All contracts and invoices
- ✅ All marketplace listings
- ✅ All tags and custom data

## Prerequisites

### 1. Environment Variables

You need connection strings for both databases. Create or update your environment files:

**For DEV database:**
```bash
# .env.dev or set as environment variable
DEV_DATABASE_URL="postgresql://user:password@localhost:5432/breederhq_dev"
```

**For PROD database:**
```bash
# .env.prod or set as environment variable
PROD_DATABASE_URL="postgresql://user:password@prod-host:5432/breederhq_prod"
# OR just use DATABASE_URL if already pointing to prod
DATABASE_URL="postgresql://user:password@prod-host:5432/breederhq_prod"
```

### 2. Database Access

Ensure you have:
- ✅ Read access to the development database
- ✅ Write access to the production database
- ✅ Network connectivity to both databases
- ✅ Appropriate Postgres roles/permissions

### 3. Dependencies

Install required packages (should already be installed):
```bash
npm install bcryptjs @types/bcryptjs
```

## Usage

### Step 1: Dry Run (RECOMMENDED FIRST)

Always run a dry run first to preview what will be copied:

```bash
cd C:\Users\Aaron\Documents\Projects\breederhq-api

# Set environment variables (Windows PowerShell)
$env:DEV_DATABASE_URL="postgresql://..."
$env:PROD_DATABASE_URL="postgresql://..."

# Run dry run
npx tsx scripts/migrations/duplicate-tenant-dev-to-prod.ts --dry-run
```

**Or with bash/Unix:**
```bash
export DEV_DATABASE_URL="postgresql://..."
export PROD_DATABASE_URL="postgresql://..."
npx tsx scripts/migrations/duplicate-tenant-dev-to-prod.ts --dry-run
```

### Step 2: Review Output

The dry run will show:
- ✅ Whether tenant #4 exists in dev
- ✅ Whether user `luke.skywalker@tester.com` exists in both databases
- ✅ Count of all records that will be copied (animals, contacts, plans, etc.)
- ✅ Sample data from each table
- ⚠️ Any potential issues or conflicts

### Step 3: Execute (Make Real Changes)

Once you've reviewed the dry run and are satisfied:

```bash
npx tsx scripts/migrations/duplicate-tenant-dev-to-prod.ts --execute
```

⚠️ **WARNING:** This will make real changes to the production database!

## What Happens During Execution

### Phase 1: Setup
1. Checks if tenant #4 exists in prod
   - If not, creates it with data from dev
   - If yes, uses existing tenant

2. Checks if user `luke.skywalker@tester.com` exists in prod
   - If not, creates user with password `Testing123!`
   - If yes, uses existing user (password unchanged)

3. Creates tenant membership
   - Links user to tenant #4
   - Grants OWNER role for full access

### Phase 2: Data Copying (with ID Mapping)

The script copies data in dependency order:

1. **Contacts & Organizations** → Creates Party/Contact/Organization records
2. **Animals** → Copies all animals with dam/sire relationships
3. **Animal Details** → Traits, health records, vaccinations, titles
4. **Breeding Plans** → All breeding plans and related data
5. **Offspring Groups** → All offspring groups and offspring records
6. **Tags** → Custom tags for organization
7. **Documents** → All documents, attachments, bundles
8. **Contracts & Invoices** → Financial records
9. **Marketplace Listings** → Any active or past listings

**ID Mapping:** All foreign key relationships are preserved by maintaining a mapping of old IDs → new IDs.

### Phase 3: Verification

After completion, the script reports:
- ✅ Number of records copied for each table
- ⚠️ Number of records skipped (duplicates)
- ❌ Any errors encountered

## Post-Migration Steps

### 1. Verify Login

Try logging in to prod:
- **Email:** `luke.skywalker@tester.com`
- **Password:** `Testing123!`
- **Tenant:** Should default to tenant #4

### 2. Verify Data

Check that all data appears correctly:
- [ ] Animals list loads
- [ ] Animal details show correct pedigree
- [ ] Breeding plans display
- [ ] Contacts and organizations exist
- [ ] Documents are accessible (note: file storage URLs may differ)
- [ ] Marketplace listings (if any)

### 3. Update Configuration

If needed, update tenant settings:
- [ ] Stripe payment settings (don't copy from dev)
- [ ] Email settings
- [ ] Marketplace visibility
- [ ] Feature flags

## Troubleshooting

### Error: "Source tenant not found"
- Check that tenant #4 exists in dev database
- Verify `DEV_DATABASE_URL` is correct

### Error: "User not found in dev"
- Check that `luke.skywalker@tester.com` exists in dev
- Verify email is correct (case-insensitive)

### Error: "Unique constraint violation"
- Some records may already exist in prod
- Script will skip duplicates and continue
- Review skipped count in output

### Error: "Foreign key violation"
- Indicates ID mapping issue
- Check that all dependency tables are copied in correct order
- Report as a bug if this occurs

### Error: "Connection refused"
- Verify database URLs are correct
- Check network connectivity
- Ensure databases are running
- Verify firewall rules

## Configuration Options

You can modify these constants in the script:

```typescript
const SOURCE_TENANT_ID = 4;           // Which tenant to copy from dev
const TARGET_TENANT_ID = 4;           // Which tenant ID to use in prod
const TARGET_USER_EMAIL = 'luke.skywalker@tester.com';
const TARGET_USER_PASSWORD = 'Testing123!';  // New password for prod
```

## Safety Features

✅ **Dry run mode** - Preview changes before applying
✅ **Transaction safety** - Each table copied independently
✅ **Duplicate detection** - Skips existing records
✅ **ID mapping** - Preserves all relationships
✅ **Error handling** - Reports issues clearly
✅ **No destructive operations** - Never deletes existing prod data

## Notes

### What's NOT Copied

- ❌ Stripe payment account connections (security)
- ❌ Session tokens (user must log in fresh)
- ❌ Password (new password set: `Testing123!`)
- ❌ File storage URLs (S3 buckets may differ between envs)
- ❌ Email send logs (not needed in prod)

### What Requires Manual Steps

- 📋 Update Stripe Connect settings if needed
- 📋 Re-upload documents if file storage differs
- 📋 Configure email templates for prod domain
- 📋 Set up marketplace payment processing

## Support

If you encounter issues:

1. Run with `--dry-run` first
2. Check the error messages in console output
3. Verify database connectivity
4. Check Prisma schema matches both databases
5. Review this README for common issues

## Example Output

```
═════════════════════════════════════════════════════════════
  Tenant #4 Duplication: DEV → PROD
═════════════════════════════════════════════════════════════
Mode: ⚡ EXECUTE (will make changes)
═════════════════════════════════════════════════════════════

【 STEP 1: Tenant Setup 】
📋 Checking if tenant #4 exists in prod...
✅ Found source tenant in dev: "Tatooine Breeders"
⚠️ Tenant #4 already exists in prod: "Tatooine Breeders"

【 STEP 2: User Setup 】
📋 Checking if user luke.skywalker@tester.com exists in prod...
✅ Found user in dev: Luke Skywalker
⚠️ User already exists in prod

【 STEP 3: Tenant Membership 】
📋 Checking tenant membership...
✅ Membership already exists in prod

【 STEP 4: Contacts & Organizations 】

📦 Copying Party...
📋 Found 15 Party records in dev
✅ Copied 15 Party records (0 skipped)

📦 Copying Organization...
📋 Found 3 Organization records in dev
✅ Copied 3 Organization records (0 skipped)

【 STEP 5: Animals & Related Data 】

📦 Copying Animal...
📋 Found 42 Animal records in dev
✅ Copied 42 Animal records (0 skipped)

...

═════════════════════════════════════════════════════════════
✨ Tenant duplication completed successfully!
═════════════════════════════════════════════════════════════

🎉 User luke.skywalker@tester.com can now log in to PROD with password: Testing123!
Tenant #4 has been fully duplicated from dev to prod.
```
