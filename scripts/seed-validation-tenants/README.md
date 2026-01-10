# Validation Tenant Seed Scripts

This directory contains scripts to seed 4 themed tenants for validation testing in both DEV and PROD environments.

## Quick Start

```bash
# Seed DEV environment
npm run db:dev:seed:validation

# Seed PROD environment
npm run db:prod:seed:validation

# Print credentials only (for password vault)
npx tsx scripts/seed-validation-tenants/print-credentials.ts dev
npx tsx scripts/seed-validation-tenants/print-credentials.ts prod
```

## Tenant Overview

| # | Theme | Slug (dev) | Slug (prod) | Species | Marketplace | Lineage Visibility |
|---|-------|------------|-------------|---------|-------------|-------------------|
| 1 | Middle Earth (LOTR) | dev-rivendell | prod-rivendell | DOG, HORSE, CAT | Full public | Full visibility |
| 2 | Hogwarts (Harry Potter) | dev-hogwarts | prod-hogwarts | CAT, RABBIT, DOG | Partial public | Partial (no genetics) |
| 3 | Westeros (Game of Thrones) | dev-winterfell | prod-winterfell | DOG, HORSE | Private only | No visibility |
| 4 | Narnia | dev-cair-paravel | prod-cair-paravel | CAT, GOAT, HORSE, DOG | Full public | Mixed visibility |

---

## DEV Environment Credentials

### Tenant 1: Middle Earth (Rivendell)
- **Slug:** `dev-rivendell`
- **Email:** `elrond.dev@rivendell.local`
- **Password:** `Rivendell123!`
- **Marketplace:** Public program with 2 active listings
- **Lineage:** Full visibility, cross-tenant matching enabled

### Tenant 2: Hogwarts
- **Slug:** `dev-hogwarts`
- **Email:** `hagrid.dev@hogwarts.local`
- **Password:** `Hogwarts123!`
- **Marketplace:** Public program with 1 active listing
- **Lineage:** Partial visibility (no full DOB, no genetics)

### Tenant 3: Westeros (Winterfell)
- **Slug:** `dev-winterfell`
- **Email:** `ned.stark.dev@winterfell.local`
- **Password:** `Winterfell123!`
- **Marketplace:** Private (no public program)
- **Lineage:** No visibility, cross-tenant matching disabled

### Tenant 4: Narnia (Cair Paravel)
- **Slug:** `dev-cair-paravel`
- **Email:** `aslan.dev@narnia.local`
- **Password:** `Narnia123!`
- **Marketplace:** Public program with 2 active listings
- **Lineage:** Mixed visibility (no photo, no health, but genetics visible)

---

## PROD Environment Credentials

### Tenant 1: Middle Earth (Rivendell)
- **Slug:** `prod-rivendell`
- **Email:** `elrond.prod@rivendell.local`
- **Password:** `Rivendell123!`

### Tenant 2: Hogwarts
- **Slug:** `prod-hogwarts`
- **Email:** `hagrid.prod@hogwarts.local`
- **Password:** `Hogwarts123!`

### Tenant 3: Westeros (Winterfell)
- **Slug:** `prod-winterfell`
- **Email:** `ned.stark.prod@winterfell.local`
- **Password:** `Winterfell123!`

### Tenant 4: Narnia (Cair Paravel)
- **Slug:** `prod-cair-paravel`
- **Email:** `aslan.prod@narnia.local`
- **Password:** `Narnia123!`

---

## Data Seeded Per Tenant

### Users
- 1 owner/admin user per tenant with predictable password

### Contacts (5 per tenant, no portal access)
- Middle Earth: Gandalf, Aragorn, Legolas, Gimli, Samwise
- Hogwarts: Dumbledore, McGonagall, Newt Scamander, Luna Lovegood, Charlie Weasley
- Winterfell: Jon Snow, Sansa, Arya, Bran, Tormund
- Narnia: Peter, Susan, Edmund, Lucy, Reepicheep

### Organizations (2-3 per tenant)
- Mix of public and private programs
- Some with marketplace slugs, some without

### Animals (up to 4 per species, up to 6 generations of lineage)
Each tenant has species-specific animals with:
- Full genetic data (coat color, coat type, health markers)
- Lineage relationships (sire/dam)
- Privacy settings based on tenant defaults
- Test provider information

### Breeding Plans (up to 4 per tenant)
- Mix of PLANNING and COMMITTED statuses only
- Linked to seeded dam and sire animals
- Expected cycle dates where applicable

### Marketplace Listings (varies by tenant)
- BREEDING_PROGRAM listings
- STUD_SERVICE listings
- Mix of ACTIVE, DRAFT, and PAUSED statuses

---

## Testing Scenarios

### Marketplace Visibility Testing
1. **Rivendell (dev-rivendell):** Full marketplace presence - test public discovery
2. **Hogwarts (dev-hogwarts):** Partial presence - test limited listings
3. **Winterfell (dev-winterfell):** Private - test that nothing appears publicly
4. **Narnia (dev-cair-paravel):** Full presence - compare with Rivendell

### Lineage/Bloodlines Testing
1. **Rivendell:** Full visibility - all fields exposed
2. **Hogwarts:** Year-only DOB, partial registry, no genetics
3. **Winterfell:** Everything hidden, no cross-tenant matching
4. **Narnia:** Selective - genetics yes, health/photo no

### Genetics Testing
Each tenant has animals with specific genetic markers for testing:
- Coat color loci (A, B, D, E, K, M, S)
- Coat type (F, Cu, L, Sd)
- Health markers (DM, PRA, PKD, HCM, etc.)
- Species-specific traits (Polled for goats, Overo for horses)

---

## File Structure

```
scripts/seed-validation-tenants/
├── README.md                    # This file
├── seed-data-config.ts          # All tenant/animal/contact definitions
├── seed-validation-tenants.ts   # Main orchestrator script
├── seed-dev.ts                  # DEV environment entry point
├── seed-prod.ts                 # PROD environment entry point
└── print-credentials.ts         # Print credentials for password vault
```

---

## Customization

To modify the seeded data, edit `seed-data-config.ts`:

- `TENANT_DEFINITIONS` - Tenant slugs, themes, visibility settings
- `TENANT_USERS` - User credentials per tenant
- `TENANT_CONTACTS` - Contact definitions per tenant
- `TENANT_ORGANIZATIONS` - Organization definitions per tenant
- `TENANT_ANIMALS` - Animal definitions with genetics and lineage
- `TENANT_BREEDING_PLANS` - Breeding plan definitions
- `TENANT_MARKETPLACE_LISTINGS` - Marketplace listing definitions

All entities are prefixed with `[DEV]` or `[PROD]` in their names to distinguish environments.
