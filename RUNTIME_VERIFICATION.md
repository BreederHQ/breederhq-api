# Runtime Verification: Cycle Length Override v1

## Backend Setup

### Prerequisites
- Node.js 20.19.0+
- PostgreSQL database running
- npm 10.8.0+

### 1. Install Dependencies
```bash
cd c:/Users/Aaron/Documents/Projects/breederhq-api
npm install
```

### 2. Configure Environment
Create `.env` file:
```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/breederhq?schema=public"
```

### 3. Run Migration
```bash
npm run migrate
```

Expected output:
```
Applying migration `20260101113710_add_cycle_len_override`
The following migration(s) have been applied:

migrations/
  └─ 20260101113710_add_cycle_len_override/
      └─ migration.sql

✔ Generated Prisma Client
```

### 4. Seed Test Data
```sql
-- Connect to your PostgreSQL database and run:

-- Female with 0 cycle history
INSERT INTO animals (name, species, breed, sex, status, created_at, updated_at)
VALUES ('Zero-Cycles', 'DOG', 'Golden Retriever', 'FEMALE', 'ACTIVE', NOW(), NOW())
RETURNING id; -- Note this ID (e.g., 1)

-- Female with 2 cycles (60 days apart)
INSERT INTO animals (name, species, breed, sex, status, created_at, updated_at)
VALUES ('Two-Cycles', 'DOG', 'Labrador', 'FEMALE', 'ACTIVE', NOW(), NOW())
RETURNING id; -- Note this ID (e.g., 2)

-- Female with 5 cycles (average 180 days apart)
INSERT INTO animals (name, species, breed, sex, status, created_at, updated_at)
VALUES ('Five-Cycles', 'DOG', 'Poodle', 'FEMALE', 'ACTIVE', NOW(), NOW())
RETURNING id; -- Note this ID (e.g., 3)

-- Female with override that conflicts >20% with 180-day history
INSERT INTO animals (name, species, breed, sex, status, "femaleCycleLenOverrideDays", created_at, updated_at)
VALUES ('Conflict-Override', 'DOG', 'Beagle', 'FEMALE', 'ACTIVE', 130, NOW(), NOW())
RETURNING id; -- Note this ID (e.g., 4)
```

### 5. Create Server Entry Point (REQUIRED - Currently Missing)

**BLOCKER**: The routes exist but no server to run them. Create `src/index.ts`:

```typescript
import express from 'express';
import { updateAnimal, getAnimal } from './routes/animals';

const app = express();
app.use(express.json());

app.get('/api/v1/animals/:id', getAnimal);
app.patch('/api/v1/animals/:id', updateAnimal);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BreederHQ API listening on port ${PORT}`);
});
```

Add to `package.json`:
```json
"scripts": {
  "dev": "ts-node src/index.ts",
  "migrate": "prisma migrate dev",
  "migrate:deploy": "prisma migrate deploy",
  "generate": "prisma generate"
}
```

Install ts-node:
```bash
npm install --save-dev ts-node
```

### 6. Start Server
```bash
npm run dev
```

Expected output:
```
BreederHQ API listening on port 3001
```

## API Verification Tests

Replace `{id}` with the actual IDs from your seed data.

### Test 1: GET animal (baseline)
```bash
curl http://localhost:3001/api/v1/animals/1
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "name": "Zero-Cycles",
  "species": "DOG",
  "breed": "Golden Retriever",
  "sex": "FEMALE",
  "status": "ACTIVE",
  "femaleCycleLenOverrideDays": null,
  "created_at": "2026-01-01T...",
  "updated_at": "2026-01-01T..."
}
```

### Test 2: PATCH valid override (150 days)
```bash
curl -X PATCH http://localhost:3001/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": 150}'
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "name": "Zero-Cycles",
  "species": "DOG",
  "breed": "Golden Retriever",
  "sex": "FEMALE",
  "status": "ACTIVE",
  "femaleCycleLenOverrideDays": 150,
  "created_at": "2026-01-01T...",
  "updated_at": "2026-01-01T..."
}
```

### Test 3: PATCH override to null (clear)
```bash
curl -X PATCH http://localhost:3001/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": null}'
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "femaleCycleLenOverrideDays": null,
  ...
}
```

### Test 4: PATCH invalid - below minimum (29)
```bash
curl -X PATCH http://localhost:3001/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": 29}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "invalid_cycle_len_override",
  "detail": "must be an integer between 30 and 730 days"
}
```

### Test 5: PATCH invalid - above maximum (731)
```bash
curl -X PATCH http://localhost:3001/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": 731}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "invalid_cycle_len_override",
  "detail": "must be an integer between 30 and 730 days"
}
```

### Test 6: PATCH invalid - non-integer (150.5)
```bash
curl -X PATCH http://localhost:3001/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": 150.5}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "invalid_cycle_len_override",
  "detail": "must be an integer between 30 and 730 days"
}
```

### Test 7: PATCH invalid - string
```bash
curl -X PATCH http://localhost:3001/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": "150"}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "invalid_cycle_len_override",
  "detail": "must be an integer between 30 and 730 days"
}
```

### Test 8: PATCH edge case - minimum valid (30)
```bash
curl -X PATCH http://localhost:3001/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": 30}'
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "femaleCycleLenOverrideDays": 30,
  ...
}
```

### Test 9: PATCH edge case - maximum valid (730)
```bash
curl -X PATCH http://localhost:3001/api/v1/animals/1 \
  -H "Content-Type: application/json" \
  -d '{"femaleCycleLenOverrideDays": 730}'
```

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "femaleCycleLenOverrideDays": 730,
  ...
}
```

## Verification Checklist

- [ ] Migration creates `femaleCycleLenOverrideDays` column
- [ ] Column is nullable (NULL default)
- [ ] GET returns field in response
- [ ] PATCH accepts integers 30-730
- [ ] PATCH accepts null
- [ ] PATCH rejects <30, >730, floats, strings
- [ ] Error code is `invalid_cycle_len_override`
- [ ] Error detail explains valid range
- [ ] Updated value persists across GET requests
