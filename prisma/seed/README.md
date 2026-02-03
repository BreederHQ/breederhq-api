# Database Seeds

This folder contains seed scripts for populating the database with initial/reference data.

## Seed Categories

### System Reference Data (Required for both DEV and PROD)

These seeds create system-level lookup data required for the application to function properly.

| Seed | Script | Description |
|------|--------|-------------|
| **Trait Definitions** | `seed-trait-definitions.ts` | Horse coat colors, health markers, physical traits |
| **Subscription Products** | `seed-subscription-products.ts` | Stripe subscription tiers and quotas |
| **Contract Templates** | `seed-contract-templates.ts` | Default contract templates for sales, breeding, etc. |
| **Microchip Registries** | `seed-microchip-registries.ts` | Lookup table of microchip registry providers (HomeAgain, AKC Reunite, etc.) |
| **Supplement Benchmarks** | `seed-supplement-benchmarks.ts` | Industry-standard supplement protocols for all species |
| **Title Definitions** | `seed-title-definitions.ts` | Competition title definitions by breed/registry |
| **Feature Flags** | `seed-features.ts` | Feature flag definitions for entitlement system |
| **Registries** | `seed-registries.ts` | Horse registry organizations (AQHA, APHA, etc.) |
| **Breeds** | `seed-breeds-json.ts` | Canonical breed definitions by species |

### Development/Test Data (DEV only)

These seeds create test data for development and QA environments.

| Seed | Script | Description |
|------|--------|-------------|
| **Test Users** | `seed-test-users.ts` | Admin and test user accounts |
| **Tattooine Contacts** | `seed-tattooine-contacts.ts` | Demo contacts for Tattooine test tenant |
| **Genetics Test Animals** | `seed-genetics-test-animals.ts` | Animals with genetic test data |
| **Titles & Competitions** | `seed-titles-competitions.ts` | Competition entries and titles |
| **Pedigree Data** | `seed-pedigree-tenant-4.ts` | Complex pedigree trees for testing |
| **Varied Genetics** | `seed-tenant4-varied-genetics.ts` | Animals with diverse genetic profiles |
| **E2E Contacts** | `seed-e2e-contacts.ts` | Contacts for end-to-end testing |
| **Dev Subscriptions** | `seed-dev-subscriptions.ts` | Test subscription data |

---

## Running Seeds

### NPM Scripts

Seeds are run using npm scripts that handle environment configuration:

```bash
# DEV Database
npm run db:dev:seed:traits         # Trait definitions
npm run db:dev:seed:users          # Test users
npm run db:dev:seed:products       # Subscription products
npm run db:dev:seed:contracts      # Contract templates
npm run db:dev:seed:supplements    # Supplement benchmark protocols
npm run db:dev:seed:microchips     # Microchip registries
npm run db:dev:seed:titles         # Title definitions
npm run db:dev:seed:genetics       # Genetics test data
npm run db:dev:seed:competitions   # Competition entries
npm run db:dev:seed:tattooine      # Tattooine demo contacts
npm run db:dev:seed:validation     # Validation tenant data

# PROD Database
npm run db:prod:seed:traits        # Trait definitions
npm run db:prod:seed:contracts     # Contract templates
npm run db:prod:seed:supplements   # Supplement benchmark protocols
npm run db:prod:seed:microchips    # Microchip registries
npm run db:prod:seed:validation    # Validation tenant data

# Composite Commands
npm run db:dev:seed                # Runs: traits + users + products
npm run db:dev:reset               # Deploy migrations + seed
```

### Direct Execution

Seeds can also be run directly with tsx:

```bash
# Using environment wrapper
node scripts/development/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-supplement-benchmarks.ts

# Direct (requires DATABASE_URL)
npx tsx prisma/seed/seed-supplement-benchmarks.ts
```

---

## Seed Details

### Supplement Benchmarks (`seed-supplement-benchmarks.ts`)

Seeds industry-standard supplement protocols that serve as templates for breeders. These are system-level benchmarks (tenantId = null) that cannot be modified by users but can be cloned and customized.

**Species Covered:**
- Horses: Regumate, prenatal vitamins, selenium/vitamin E
- Dogs: Folic acid, prenatal vitamins, puppy dewormer, calcium supplementation
- Cats: Prenatal vitamins, kitten dewormer
- Goats: Selenium/Vitamin E, CDT vaccine booster
- Sheep: Selenium/Vitamin E pre-lambing
- Rabbits: Prenatal supplements
- All Species: Probiotics, electrolytes

**Protocol Types:**
- `BREEDING_CYCLE_RELATIVE`: Start date calculated from breeding plan events
- `AGE_BASED`: Start date calculated from animal's birth date
- `MANUAL`: User sets start date manually

**Total Protocols:** 15 benchmark protocols

### Microchip Registries (`seed-microchip-registries.ts`)

Seeds the lookup table of known microchip registry providers:

**Lifetime Registrations:**
- FreePetChipRegistry, Michelson Found Animals, Furreka, AKC Reunite, ACA MARRS

**Annual Renewals:**
- HomeAgain, 24PetWatch, AVID PETtrac, Peeva

**Equine Registries:**
- Equine Protection Registry, BuddyID, NetPosse, USEF Microchip Registry

**Livestock:**
- USDA 840 Official

**Total Registries:** 16 providers

---

## Creating New Seeds

1. Create a new file in `prisma/seed/` following the naming convention: `seed-[feature-name].ts`

2. Import the env bootstrap at the top:
   ```typescript
   import "./seed-env-bootstrap";
   ```

3. Use upsert pattern for idempotent seeding:
   ```typescript
   const result = await prisma.model.upsert({
     where: { uniqueField: value },
     update: { /* updated data */ },
     create: { /* new data */ },
   });
   ```

4. Add npm scripts to `package.json`:
   ```json
   "db:dev:seed:feature": "node scripts/development/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-feature.ts",
   "db:prod:seed:feature": "node scripts/development/run-with-env.js .env.prod.migrate npx tsx prisma/seed/seed-feature.ts"
   ```

5. Run on both DEV and PROD if it's system reference data.

---

## Environment Files

Seeds use environment-specific configuration:

| Environment | File | Database |
|-------------|------|----------|
| Development | `.env.dev.migrate` | Supabase DEV project |
| Production | `.env.prod.migrate` | Supabase PROD project |

The `run-with-env.js` script loads the appropriate environment before executing the seed.

---

**Last Updated:** 2026-02-02
