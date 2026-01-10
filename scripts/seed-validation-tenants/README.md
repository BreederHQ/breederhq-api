# Validation Tenant Seed Scripts

This directory contains scripts to seed 4 themed tenants for validation testing in both DEV and PROD environments.

**DEV and PROD have completely different themes** to make it easy to distinguish data between environments.

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

### DEV Environment Themes

| # | Theme | Slug | Species | Marketplace | Lineage Visibility |
|---|-------|------|---------|-------------|-------------------|
| 1 | Middle Earth (LOTR) | dev-rivendell | DOG, HORSE, CAT | Full public | Full visibility |
| 2 | Hogwarts (Harry Potter) | dev-hogwarts | CAT, RABBIT, DOG | Partial public | Partial (no genetics) |
| 3 | Westeros (Game of Thrones) | dev-winterfell | DOG, HORSE | Private only | No visibility |
| 4 | Marvel Avengers | dev-stark-tower | CAT, GOAT, HORSE, DOG | Full public | Mixed visibility |

### PROD Environment Themes (Different!)

| # | Theme | Slug | Species | Marketplace | Lineage Visibility |
|---|-------|------|---------|-------------|-------------------|
| 1 | Dune (Arrakis) | prod-arrakis | DOG, HORSE, CAT | Full public | Full visibility |
| 2 | Star Trek (Starfleet) | prod-starfleet | CAT, RABBIT, DOG | Partial public | Partial (no genetics) |
| 3 | Ted Lasso (AFC Richmond) | prod-richmond | DOG, HORSE | Private only | No visibility |
| 4 | The Matrix (Zion) | prod-zion | CAT, GOAT, HORSE, DOG | Full public | Mixed visibility |

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

### Tenant 4: Marvel Avengers (Stark Tower)
- **Slug:** `dev-stark-tower`
- **Email:** `tony.stark.dev@avengers.local`
- **Password:** `Avengers123!`
- **Marketplace:** Public program with 2 active listings
- **Lineage:** Mixed visibility (no photo, no health, but genetics visible)

---

## PROD Environment Credentials

### Tenant 1: Dune (Arrakis)
- **Slug:** `prod-arrakis`
- **Email:** `paul.prod@arrakis.local`
- **Password:** `Arrakis123!`
- **Marketplace:** Public program with 2 active listings
- **Lineage:** Full visibility, cross-tenant matching enabled

### Tenant 2: Star Trek (Starfleet)
- **Slug:** `prod-starfleet`
- **Email:** `picard.prod@starfleet.local`
- **Password:** `Starfleet123!`
- **Marketplace:** Public program with 1 active listing
- **Lineage:** Partial visibility (no full DOB, no genetics)

### Tenant 3: Ted Lasso (AFC Richmond)
- **Slug:** `prod-richmond`
- **Email:** `ted.prod@afcrichmond.local`
- **Password:** `Richmond123!`
- **Marketplace:** Private (no public program)
- **Lineage:** No visibility, cross-tenant matching disabled

### Tenant 4: The Matrix (Zion)
- **Slug:** `prod-zion`
- **Email:** `neo.prod@zion.local`
- **Password:** `Matrix123!`
- **Marketplace:** Public program with 2 active listings
- **Lineage:** Mixed visibility (no photo, no health, but genetics visible)

---

## Data Seeded Per Tenant

### Users
- 1 owner/admin user per tenant with predictable password

### Contacts (5 per tenant, no portal access)
**DEV:**
- Middle Earth: Gandalf, Aragorn, Legolas, Gimli, Samwise
- Hogwarts: Dumbledore, McGonagall, Newt Scamander, Luna Lovegood, Charlie Weasley
- Winterfell: Jon Snow, Sansa, Arya, Bran, Tormund
- Marvel: Steve Rogers, Natasha Romanoff, Bruce Banner, Thor, Clint Barton

**PROD:**
- Dune: Duncan Idaho, Stilgar, Chani, Gurney Halleck, Thufir Hawat
- Star Trek: William Riker, Data, Beverly Crusher, Deanna Troi, Worf
- Ted Lasso: Rebecca Welton, Roy Kent, Keeley Jones, Jamie Tartt, Coach Beard
- Matrix: Morpheus, Trinity, Tank, Niobe, Oracle

### Organizations (2-3 per tenant)
- Mix of public and private programs
- Some with marketplace slugs, some without

### Animals (multiple per species, up to 6 generations of lineage)
Each tenant has species-specific animals with:
- Full genetic data (coat color, coat type, health markers)
- Lineage relationships (sire/dam) with two unrelated founder lines
- Privacy settings based on tenant defaults
- Test provider information
- COI test scenarios with documented expected values
- Carrier × Carrier breeding pairs for health warning tests
- Show titles (CH, GCH, GC) for select animals
- Competition history with detailed entry records

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

**DEV:**
1. **Rivendell (dev-rivendell):** Full marketplace presence - test public discovery
2. **Hogwarts (dev-hogwarts):** Partial presence - test limited listings
3. **Winterfell (dev-winterfell):** Private - test that nothing appears publicly
4. **Stark Tower (dev-stark-tower):** Full presence - compare with Rivendell

**PROD:**
1. **Arrakis (prod-arrakis):** Full marketplace presence - test public discovery
2. **Starfleet (prod-starfleet):** Partial presence - test limited listings
3. **Richmond (prod-richmond):** Private - test that nothing appears publicly
4. **Zion (prod-zion):** Full presence - compare with Arrakis

### Lineage/Bloodlines Testing
1. **Full visibility (Rivendell/Arrakis):** All fields exposed
2. **Partial (Hogwarts/Starfleet):** Year-only DOB, partial registry, no genetics
3. **No visibility (Winterfell/Richmond):** Everything hidden, no cross-tenant matching
4. **Mixed (Stark Tower/Zion):** Selective - genetics yes, health/photo no

### Genetics Testing
Each tenant has animals with specific genetic markers for testing:
- Coat color loci (A, B, D, E, K, M, S)
- Coat type (F, Cu, L, Sd)
- Health markers (DM, PRA, PKD, HCM, etc.)
- Species-specific traits (Polled for goats, Overo for horses)

### COI (Coefficient of Inbreeding) Testing

Each tenant has comprehensive pedigree data designed for COI testing using Wright's Path Coefficient Method.

#### COI Thresholds
| Level | COI Range | Description |
|-------|-----------|-------------|
| LOW | < 5% | Acceptable, minimal inbreeding |
| MODERATE | 5% - 10% | Some linebreeding, monitor |
| HIGH | 10% - 25% | Significant inbreeding, caution |
| CRITICAL | ≥ 25% | Severe inbreeding, health risks |

#### Two Founder Lines Pattern
Each tenant has **two unrelated founder lines** (Line A and Line B) to enable:
- **Outcross pairings**: Line A × Line B = 0% COI
- **Linebreeding scenarios**: Same-line pairings with increasing COI
- **Half-sibling matings**: ~12.5% COI
- **Full-sibling matings**: ~25% COI (documented but flagged)
- **Parent-offspring matings**: ~25% COI

#### DEV Environment COI Test Scenarios

| Tenant | Species | Founder Lines | Max COI | Key Scenario |
|--------|---------|---------------|---------|--------------|
| Rivendell | Dog (Golden Retriever) | Huan + Orome | ~25% | Full-sibling mating |
| Rivendell | Horse (Mearas) | Shadowfax + Nahar | ~25% | Parent-offspring |
| Rivendell | Cat (Elvish) | Tevildo + Melian | ~25% | Multi-generation inbreeding |
| Hogwarts | Cat (British Shorthair) | Crookshanks + Mrs Norris | ~37.5% | 5+ generations |
| Hogwarts | Dog (Irish Wolfhound) | Fang + Padfoot | ~25% | Half-sibling mating |
| Winterfell | Dog (Alaskan Malamute) | Grey Wind + Summer | ~25% | Direwolf line breeding |
| Winterfell | Horse (Friesian) | Stranger + Lightfoot | ~12.5% | Half-sibling |
| Stark Tower | Cat (Ragdoll) | Goose + Chewie | ~25% | HCM carrier concentration |
| Stark Tower | Goat (Nigerian Dwarf) | Toothgnasher + Tanngrisnir | ~25% | G6S carrier breeding |
| Stark Tower | Horse (Lipizzan) | Aragorn + Valinor | ~12.5% | GBED carrier test |
| Stark Tower | Dog (Cavalier) | Lucky + Pizza Dog | ~25% | MVD carrier breeding |

#### PROD Environment COI Test Scenarios

| Tenant | Species | Founder Lines | Max COI | Key Scenario |
|--------|---------|---------------|---------|--------------|
| Arrakis | Dog (Saluki) | Fenring + Stilgar's Hound | ~25% | DM/CMR carrier breeding |
| Arrakis | Horse (Arabian) | Muad'Dib's Steed + Chani's Mare | ~25% | SCID lethal test |
| Arrakis | Cat (Abyssinian) | Shai-Hulud + Sietch Cat | ~25% | PK Deficiency |
| Starfleet | Cat (Exotic Shorthair) | Spot + Data's Cat | ~25% | PKD carrier breeding |
| Starfleet | Dog (Border Collie) | Number One + Enterprise | ~25% | CEA/TNS carriers |
| Richmond | Dog (Golden Retriever) | Ted's Boy + AFC Buddy | ~25% | PRA/Ichthyosis |
| Richmond | Horse (Thoroughbred) | Diamond + Champion | ~25% | GBED lethal test |
| Zion | Cat (Bombay) | Neo's Cat + Oracle's Familiar | ~25% | HCM high-risk |
| Zion | Goat (La Mancha) | Tank's Goat + Morpheus | ~25% | G6S carrier breeding |
| Zion | Horse (Mustang) | Matrix + Sentinel | ~25% | HERDA carrier |
| Zion | Dog (Belgian Malinois) | Agent + Sentinel Dog | ~25% | DM carrier breeding |

### Health Screening & Genetic Warnings Testing

Each tenant includes **carrier × carrier breeding scenarios** to test genetic health warnings.

#### Warning Types
| Warning | Trigger | Expected Alert |
|---------|---------|----------------|
| Carrier × Carrier | Both parents N/m | 25% affected offspring risk |
| Affected Parent | One parent m/m | 100% carrier or affected offspring |
| Lethal Homozygous | Both carriers of lethal | 25% lethal homozygous risk |

#### Species-Specific Health Markers by Tenant

**DEV Environment:**

| Tenant | Species | Breed | Health Markers | Carrier × Carrier Scenario |
|--------|---------|-------|----------------|---------------------------|
| Rivendell | Dog | Golden Retriever | DM, PRA, EIC | DM Carrier × Carrier = Affected offspring |
| Rivendell | Horse | Mearas | OLWS, HYPP | OLWS lethal test |
| Rivendell | Cat | Elvish | PKD, HCM | PKD Carrier × Carrier |
| Hogwarts | Cat | British Shorthair | PKD, HCM | PKD × PKD and HCM × HCM |
| Hogwarts | Dog | Irish Wolfhound | DCM | DCM Carrier × Carrier |
| Winterfell | Dog | Alaskan Malamute | PRA, POLY | PRA × PRA with affected pup |
| Winterfell | Horse | Friesian | HYPP | HYPP Carrier × Carrier |
| Stark Tower | Cat | Ragdoll | HCM | HCM × HCM = At Risk offspring |
| Stark Tower | Goat | Nigerian Dwarf | G6S, Polled | G6S × G6S, Polled × Polled (intersex) |
| Stark Tower | Horse | Lipizzan | GBED | GBED × GBED lethal test |
| Stark Tower | Dog | Cavalier | MVD, EFS | MVD × MVD, EFS × EFS |

**PROD Environment:**

| Tenant | Species | Breed | Health Markers | Carrier × Carrier Scenario |
|--------|---------|-------|----------------|---------------------------|
| Arrakis | Dog | Saluki | DM, CMR | DM × DM, CMR × CMR |
| Arrakis | Horse | Arabian | SCID | SCID × SCID lethal |
| Arrakis | Cat | Abyssinian | PK Def | PK Def × PK Def |
| Starfleet | Cat | Exotic Shorthair | PKD | PKD × PKD |
| Starfleet | Dog | Border Collie | CEA, TNS | CEA × CEA, TNS × TNS |
| Richmond | Dog | Golden Retriever | PRA, Ichthyosis | PRA × PRA affected |
| Richmond | Horse | Thoroughbred | GBED | GBED × GBED lethal |
| Zion | Cat | Bombay | HCM | HCM × HCM high-risk |
| Zion | Goat | La Mancha | G6S | G6S × G6S |
| Zion | Horse | Mustang | HERDA | HERDA × HERDA |
| Zion | Dog | Belgian Malinois | DM | DM × DM |

#### Lethal Condition Testing
These conditions cause embryonic/neonatal death when homozygous:
- **GBED (Glycogen Branching Enzyme Deficiency)** - Horses: Test in Stark Tower, Richmond
- **HYPP (Hyperkalemic Periodic Paralysis)** - Horses: Severe form lethal, test in Rivendell, Winterfell
- **SCID (Severe Combined Immunodeficiency)** - Horses: Test in Arrakis
- **OLWS (Overo Lethal White Syndrome)** - Horses: Test in Rivendell

### Titles & Competitions Testing

Each tenant includes animals with show titles and competition history.

#### Title Types by Species
| Species | Prefix Titles | Suffix Titles |
|---------|---------------|---------------|
| Dog | CH (Champion), GCH (Grand Champion) | CGC, BN, CD, RA |
| Cat | CH (Champion), GC (Grand Champion) | - |
| Horse | - | Various performance |
| Goat | CH | - |

#### DEV Environment Titled Animals

| Tenant | Animal | Titles | Notable Wins |
|--------|--------|--------|--------------|
| Rivendell | Huan | CH, GCH | Valinor Dog Show - Best in Show |
| Rivendell | Tevildo | CH, GC | Middle-earth Cat Fanciers - Supreme |
| Rivendell | Shadowfax | Performance Champion | Mearas Classic - 1st Place |
| Hogwarts | Crookshanks | CH, GC | Ministry Cat Championship - Best of Breed |
| Hogwarts | Fang | CH | Hogsmeade Hound Show - Winners Dog |
| Winterfell | Grey Wind | CH, GCH | Winterfell Dire Show - Grand Champion |
| Winterfell | Stranger | Dressage Champion | Westeros Horse Trials |
| Stark Tower | Goose | CH, GC | Avengers Cat Show - Supreme |
| Stark Tower | Lucky | CH, GCH | Stark Industries Dog Show - Best in Show |

#### PROD Environment Titled Animals

| Tenant | Animal | Titles | Notable Wins |
|--------|--------|--------|--------------|
| Arrakis | Fenring | CH, GCH | Sietch Dog Show - Best in Show |
| Arrakis | Shai-Hulud | CH, GC | Arrakis Cat Fanciers - Supreme |
| Arrakis | Muad'Dib's Steed | Endurance Champion | Desert Classic |
| Starfleet | Spot | CH, GC | Starfleet Cat Show - Best of Breed |
| Starfleet | Number One | CH, GCH | Federation Dog Trials - Grand Champion |
| Richmond | Ted's Boy | CH, GCH | AFC Richmond Dog Show - Best in Show |
| Richmond | Diamond | Racing Champion | Richmond Cup |
| Zion | Neo's Cat | CH, GC | Zion Cat Fanciers - Supreme |
| Zion | Agent | CH, GCH | Matrix Dog Trials - Grand Champion |

#### Competition Entry Fields
Each competition entry includes:
- `eventName` - Name of the show/event
- `eventDate` - Date of competition
- `location` - City/venue
- `organization` - Sanctioning body (AKC, UKC, TICA, CFA, etc.)
- `competitionType` - CONFORMATION_SHOW, FIELD_TRIAL, AGILITY, etc.
- `className` - Open, Bred-By-Exhibitor, etc.
- `placement` - Numeric ranking (1, 2, 3, etc.)
- `placementLabel` - Display text (Best in Show, Winners Dog, etc.)
- `pointsEarned` - Points toward title
- `isMajorWin` - Boolean for major/significant wins
- `judgeName` - Name of judge

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

**Environment-specific exports (use helper functions):**
- `getTenantDefinitions(env)` - Tenant slugs, themes, visibility settings
- `getTenantUsers(env)` - User credentials per tenant
- `getTenantContacts(env)` - Contact definitions per tenant
- `getTenantOrganizations(env)` - Organization definitions per tenant
- `getTenantAnimals(env)` - Animal definitions with genetics and lineage
- `getTenantBreedingPlans(env)` - Breeding plan definitions
- `getTenantMarketplaceListings(env)` - Marketplace listing definitions

**Legacy exports (default to DEV):**
- `TENANT_DEFINITIONS`, `TENANT_USERS`, `TENANT_CONTACTS`, etc.

All entities are prefixed with `[DEV]` or `[PROD]` in their names to distinguish environments.
