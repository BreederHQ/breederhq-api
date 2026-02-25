# KVS Demo Tenant — Seed Script

Pre-populates a demo tenant for **Katie Van Slyke / Running Springs Quarter Horse & Cattle Company** (Nolensville, TN) with their real animals, pedigrees, show records, and 2025/2026 breeding plans.

**Purpose:** Personalized demo for Rachel Hadley (barn manager) — she sees *their* horses in the demo video, not generic placeholder data.

---

## Quick Start

```bash
# Run from breederhq-api root
npm run db:dev:seed:kvs

# Force-recreate (deletes and re-seeds the tenant)
npm run db:dev:seed:kvs -- --force
```

---

## Login Credentials (DEV only)

| Field    | Value                        |
|----------|------------------------------|
| Email    | `demo-kvs@breederhq.com`     |
| Password | `BreederHQ2026!`             |
| Tenant   | Running Springs Quarter Horse & Cattle Company |
| Slug     | `kvs-demo`                   |

---

## What Gets Seeded

### Animals (~78 records)

| Group | Count | Notes |
|-------|-------|-------|
| Pedigree ancestors (QH) | 35 | Great-great-grandparents through parents; status DECEASED/RETIRED |
| Outside stallions | 8 | Machine Made, Cool Breeze, RL Best of Sudden, etc.; status PROSPECT |
| Owned stallions | 3 | VS Code Red (Waylon), First Thingz First (Denver), RS Wanted N Dallas (Dallas) |
| Broodmares | 10 | Kennedy, Erlene, Annie, Gone Commando (Rikki), Ginger, Trudy, Beyonce, Marilynn, Goodygoody Gumdrops, Indy |
| Recipient mares | 10 | Phoebe, Opal, Willow, Charlotte, Maggie, Gracie, Happy, Ethel, Raven, Lexy |
| Foals / young stock | 8 | Noelle (premature, alive), Kirby (deceased Aug 2025), Huckleberry, Kopy Kat, Ruby Red Slippers, Freddy, Black Ice, Wheezy |
| Other horses | 3 | Bo (Paint companion), Sophie, Millie (freeloaders) |
| Mini horses | 6 | Regina, Coco, Karen, Janice, Jack, Gretchen |
| Nigerian Dwarf Goats | 6 | Bella, Blossom, Buttercup, Honey, Bee, Bubbles |

> **Excluded**: Simmental cattle, mini Highland cattle, mini donkeys, pig — BreederHQ doesn't support those species yet.

### Show Records (34 competition entries)

- **VS Code Red**: 2009 & 2011 Congress (5 championships), 2012 NSBA World (3 championships), 2012 AQHA World (3rd place)
- **First Thingz First**: 2024 Congress (3 championships + NSBA + Southern Belle), 2024 AQHA World (Reserve + Fan Favorite), 2025 NSBA BCF World (2 titles), 2025 Back to Berrien (3 titles)
- **Gone Commando**: 2022 Congress Champion, Virginia Maiden Champion, NSBA World Champion & Reserve
- **VS The First Lady**: Congress Masters Champion, NSBA World Champions

### Breeding Plans

**2025 (8 completed plans):**
| Plan | Outcome |
|------|---------|
| Erlene × VS Code Red | Noelle — premature filly, survived |
| Kennedy × Machine Made | Kirby — colt, died Aug 2025 (pasture accident) |
| Ginger × Cool Breeze | Unnamed filly/colt, alive |
| Ethel × VS Code Red (donor: Beyonce) | ET foal, alive |
| Annie × Cool Ladys Man | Unnamed foal, alive (Annie's 345-day gestation) |
| Phoebe × VS Code Red (donor: Goodygoody Gumdrops) | Stallion prospect via sexed semen |
| Gracie × VS Code Red (donor: Beyonce) | ET foal, alive |
| Happy × VS Code Red (donor: Marilyn Monroe) | ET foal, alive |

**2026 (10 active plans):**
| Plan | Status | Notes |
|------|--------|-------|
| Raven × VS Code Red | PREGNANT | Due Jan 20. 339/341/343/345-day tracking. Katie predicts gray filly "Violet" |
| Indy × VS Code Red | PREGNANT | Due Feb 7. Dark bay colt predicted |
| Rikki × Hey Good Lookin | PREGNANT | Due Feb 9. Maiden mare, red colt predicted |
| Charlotte × Denver (donor: Trudy) | PREGNANT | Due Feb 12. Bay roan filly predicted |
| Lexy × VS Code Red | PREGNANT | Due Mar 12. Bay roan colt predicted |
| Phoebe × RL Best of Sudden | PREGNANT | Due Mar 24. On Regumate. Jun 2: 19 days. Jun 20: heartbeat ✓ |
| Maggie × Machine Made | PREGNANT | Due Apr 10. Caslick procedure. Jun 20: heartbeat ✓ |
| Annie × Denver | PREGNANT | Due Apr 11. Jun 2: 16 days. Jun 20: heartbeat ✓. 345-day gestation history |
| Happy × Denver | PREGNANT | Due Apr 11. Jun 20: heartbeat ✓ |
| Ginger × Making Me Willie Wild | UNSUCCESSFUL | Retained fluid, not pregnant |

### Other Records

- **Contacts**: Rachel Hadley (barn manager), Rebecca (AI-certified inseminator), Christi Christenson (Highpoint stallion manager), Aaron Moses (trainer), Tennessee Equine Hospital, Highpoint Performance Horses
- **Genetics**: VS Code Red (6-panel N/N + red roan loci), First Thingz First (6-panel N/N + roan), Gone Commando (bay coat), Full Medal Jacket (homozygous black), Machine Made (GBED carrier)
- **Registry IDs**: 17 records (AQHA, APHA, AMHA, AMHR)
- **Registry Pedigrees**: 4-generation trees for VS Code Red and First Thingz First
- **Semen Inventory**: 7 batches — 4 VS Code Red frozen (at Highpoint), 3 First Thingz First
- **Progesterone / Follicle Tests**: 13 test results across 2026 plans
- **Pregnancy Checks**: 17 records (real dates from Jun 2 + Jun 20, 2025 content)
- **Mare Reproductive History**: 7 mares with risk factors, foaling history, prior outcomes
- **Tags**: 17 tags across Animal, Breeding Plan, and Contact modules

---

## Demo Video Talking Points

1. **Open Animals list** → "These are Katie's actual horses — VS Code Red, Denver, all 176+ animals in her program"
2. **Open VS Code Red (Waylon)** → Show show record (2009/2011 Congress + 2012 NSBA/AQHA World) + full 4-generation pedigree + semen inventory at Highpoint
3. **Open First Thingz First (Denver)** → 2024 Congress triple champion, 6-panel genetics, full sibling to RL Best of Sudden (2026 Phoebe sire)
4. **Open Breeding Plans → 2025 season** → Show Noelle's birth (premature, survived), Kirby's foal loss — "You can track outcomes just like this"
5. **Open Raven's 2026 plan** → Day-by-day gestation tracking (339/341/343/345 days), predicted gray filly "Violet", real expected due date
6. **Open Phoebe's 2026 plan** → Show Regumate protocol notes, June 2 pregnancy check (19 days confirmed), June 20 heartbeat check — "Everything Rachel checks in the barn is logged here"
7. **Open Annie's 2026 plan** → 345-day gestation history note, June heartbeat confirmation
8. **Filter by Mini Horses** → Regina's 40mm follicle history, show ovulation timing workflow

---

## Data Sources

All data sourced from Katie Van Slyke's public YouTube channel, Instagram, and blog.
See `docs/demos/KATIE-VAN-SLYKE-DOSSIER.md` for the full research dossier.

---

## Re-running / Resetting

```bash
# Idempotent — safe to run multiple times (skips existing records)
npm run db:dev:seed:kvs

# Full reset (deletes all KVS tenant data and re-seeds from scratch)
npm run db:dev:seed:kvs -- --force
```

Script outputs a summary table with counts and login credentials after completion.
