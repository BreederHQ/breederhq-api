# E2E Testing Guide - Data Import/Export

**Status**: ✅ Ready to Run
**Date**: 2026-01-21
**Framework**: Playwright

## Overview

This guide covers end-to-end (E2E) testing for the CSV Data Import/Export feature using Playwright.

---

## Table of Contents

1. [Setup](#setup)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Test Coverage](#test-coverage)
5. [Test Data Management](#test-data-management)
6. [Screenshots & Artifacts](#screenshots--artifacts)
7. [Debugging](#debugging)
8. [CI/CD Integration](#cicd-integration)

---

## Setup

### 1. Install Playwright

```bash
cd C:\Users\Aaron\Documents\Projects\breederhq-api

# Install Playwright and browsers
npm install -D @playwright/test
npx playwright install chromium
```

### 2. Configure Environment

Create `.env.test` file:

```env
# API Server
TEST_BASE_URL=http://localhost:3000

# Test User Credentials
TEST_USER_EMAIL=test@breederhq.com
TEST_USER_PASSWORD=testpassword123

# Database (for cleanup)
DATABASE_URL=postgresql://user:pass@localhost:5432/breederhq_test
```

### 3. Create Test User

Before running tests, create a test user account:

```bash
# Using your user creation script or API
npm run create-test-user
```

Or manually via database:
```sql
INSERT INTO "User" (email, password_hash, tenant_id, created_at, updated_at)
VALUES ('test@breederhq.com', '$hashed_password', 1, NOW(), NOW());
```

### 4. Start Dev Server

```bash
# In terminal 1
npm run dev
```

---

## Test Structure

### File Organization

```
breederhq-api/
├── tests/
│   └── e2e/
│       ├── data-import-export.spec.ts    # Main test suite
│       ├── screenshots/                   # Test screenshots (auto-created)
│       ├── test-data/                     # CSV test files (auto-created)
│       └── test-downloads/                # Downloaded CSVs (auto-created)
├── playwright.config.ts                   # Playwright configuration
└── test-results/                          # Test artifacts (auto-created)
```

### Test Suite Structure

```typescript
test.describe("Data Import/Export", () => {
  test.beforeAll(async () => {
    // Login once for all tests
  });

  test.afterAll(async () => {
    // Cleanup: Delete test data
    // Cleanup: Delete screenshots
  });

  test.describe("CSV Template Download", () => {
    test("should download CSV template", async () => {
      // Test implementation
    });
  });

  test.describe("CSV Import - Valid Data", () => {
    // Import tests
  });

  // More test groups...
});
```

---

## Running Tests

### Run All Tests

```bash
# Run all E2E tests
npx playwright test tests/e2e/data-import-export.spec.ts

# With UI mode (interactive)
npx playwright test tests/e2e/data-import-export.spec.ts --ui

# With headed browser (see browser window)
npx playwright test tests/e2e/data-import-export.spec.ts --headed
```

### Run Specific Test

```bash
# Run single test by name
npx playwright test tests/e2e/data-import-export.spec.ts -g "should download CSV template"

# Run specific test group
npx playwright test tests/e2e/data-import-export.spec.ts -g "CSV Import - Valid Data"
```

### Debug Mode

```bash
# Debug with Playwright Inspector
npx playwright test tests/e2e/data-import-export.spec.ts --debug

# Debug specific test
npx playwright test tests/e2e/data-import-export.spec.ts -g "duplicate" --debug
```

### Generate Report

```bash
# Run tests and generate HTML report
npx playwright test tests/e2e/data-import-export.spec.ts

# View report
npx playwright show-report
```

---

## Test Coverage

### Covered Scenarios

#### ✅ CSV Template Download
- Downloads template with correct filename
- Template contains required headers
- Template includes example rows

#### ✅ CSV Import - Valid Data
- Imports 2 valid animals
- Creates animals in database
- Shows success summary
- Tracks created IDs for cleanup

#### ✅ CSV Import - Duplicate Detection
- Detects duplicate by name + species + sex + birthDate
- Shows duplicate warning in UI
- User can select resolution (skip/update/create)
- Updates existing animal when "update" selected

#### ✅ CSV Import - Parent Matching
- Creates parent animals first
- Detects parent name mismatch
- Shows fuzzy match suggestions with scores
- User can link to suggested parent
- Creates parent link in database

#### ✅ CSV Import - Validation Errors
- Shows errors for missing required fields
- Shows errors for invalid enum values
- Shows errors for invalid date formats
- Disables import button when errors exist

#### ✅ CSV Export
- Opens export dialog
- Filters by species and status
- Includes extended data option
- Downloads CSV with correct filename
- CSV contains expected data

#### ✅ Edge Cases
- Large CSV (100+ rows) - preview only
- Special characters (quotes, commas, newlines)

---

## Test Data Management

### Automatic Cleanup

All test data is **automatically cleaned up** after tests complete:

```typescript
test.afterAll(async () => {
  // 1. Delete created animals
  for (const animalId of createdAnimalIds) {
    await fetch(`${BASE_URL}/api/animals/${animalId}`, {
      method: "DELETE",
    });
  }

  // 2. Delete screenshots
  await fs.rm("tests/e2e/screenshots", { recursive: true });

  // 3. Delete test CSV files
  await fs.rm("tests/e2e/test-data", { recursive: true });
});
```

### Test Data Tracking

```typescript
// Track created entities globally
const createdAnimalIds: number[] = [];
const createdRegistryIds: number[] = [];

// Add after creation
createdAnimalIds.push(animal.id);

// Cleanup in afterAll
```

### Manual Cleanup (if tests fail)

If tests fail before cleanup:

```sql
-- Find test animals
SELECT * FROM "Animal" WHERE name LIKE 'Test%' OR name LIKE '%TestDog%';

-- Delete test animals
DELETE FROM "Animal" WHERE name LIKE 'Test%';

-- Find test registries
SELECT * FROM "Registry" WHERE name LIKE 'TEST%';

-- Delete test registries
DELETE FROM "Registry" WHERE name LIKE 'TEST%';
```

---

## Screenshots & Artifacts

### Auto-Generated Screenshots

Tests automatically capture screenshots at key points:

1. **`01-data-management-page.png`** - Data Management settings page
2. **`02-import-wizard-upload.png`** - Import wizard upload step
3. **`03-import-wizard-preview.png`** - Import preview with validation
4. **`04-import-success.png`** - Import success summary
5. **`05-duplicate-warning.png`** - Duplicate detection warning
6. **`06-duplicate-resolved.png`** - Duplicate resolution selected
7. **`07-parent-not-found.png`** - Parent matching warning
8. **`08-parent-linked.png`** - Parent linked to suggestion
9. **`09-validation-errors.png`** - Validation error display
10. **`10-export-dialog.png`** - Export dialog opened
11. **`11-export-filtered.png`** - Export with filters selected
12. **`12-large-import.png`** - Large CSV preview (100 rows)

### Screenshot Location

```
tests/e2e/screenshots/
├── 01-data-management-page.png
├── 02-import-wizard-upload.png
├── 03-import-wizard-preview.png
└── ...
```

**Note**: Screenshots are **automatically deleted** after successful test runs.

### Failure Screenshots

On test failure, Playwright automatically captures:
- Screenshot of failure point
- Video recording of entire test
- Trace file for debugging

Located in: `test-results/`

---

## Debugging

### Playwright Inspector

```bash
# Open Playwright Inspector
npx playwright test tests/e2e/data-import-export.spec.ts --debug

# Inspector features:
# - Step through test line by line
# - Inspect page elements
# - View console logs
# - See network requests
```

### Browser Developer Tools

```bash
# Run with headed browser + devtools open
npx playwright test tests/e2e/data-import-export.spec.ts --headed --debug

# In browser:
# - Open DevTools (F12)
# - Check Console tab for errors
# - Check Network tab for API calls
```

### Trace Viewer

After test failure:

```bash
# Generate trace on first retry
npx playwright test tests/e2e/data-import-export.spec.ts

# View trace
npx playwright show-trace test-results/.../trace.zip
```

Trace viewer shows:
- Timeline of actions
- Screenshots at each step
- Network requests
- Console logs
- DOM snapshots

### Common Issues

**Issue**: "Element not found" timeout

**Debug**:
```typescript
// Add explicit wait
await page.waitForSelector('text="Import Animals"', { timeout: 10000 });

// Check if element exists
const exists = await page.locator('text="Import Animals"').count();
console.log("Element count:", exists);

// Take debug screenshot
await page.screenshot({ path: "debug-screenshot.png" });
```

---

**Issue**: API call fails

**Debug**:
```typescript
// Listen to network requests
page.on("request", (request) => {
  console.log("Request:", request.url());
});

page.on("response", (response) => {
  console.log("Response:", response.status(), response.url());
});

// Check response body
const response = await fetch(`${BASE_URL}/api/animals`, { ... });
const body = await response.json();
console.log("API Response:", body);
```

---

**Issue**: Test data not cleaning up

**Debug**:
```typescript
// Log cleanup attempts
console.log("Cleaning up animal IDs:", createdAnimalIds);

for (const id of createdAnimalIds) {
  try {
    await fetch(`${BASE_URL}/api/animals/${id}`, { method: "DELETE" });
    console.log(`Deleted animal ${id}`);
  } catch (error) {
    console.error(`Failed to delete animal ${id}:`, error);
  }
}
```

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: breederhq_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Setup database
        run: |
          npm run db:migrate
          npm run db:seed:test

      - name: Start API server
        run: npm run dev &
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/breederhq_test

      - name: Wait for server
        run: npx wait-on http://localhost:3000/health

      - name: Run E2E tests
        run: npx playwright test tests/e2e/data-import-export.spec.ts
        env:
          TEST_BASE_URL: http://localhost:3000
          TEST_USER_EMAIL: test@breederhq.com
          TEST_USER_PASSWORD: testpassword123

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

      - name: Upload test videos
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-videos
          path: test-results/
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh

# Run E2E tests before commit
npm run test:e2e:quick

# Only run quick smoke tests (not full suite)
```

---

## Performance

### Test Execution Times

Expected execution times (on modern hardware):

| Test Group | Time | Notes |
|------------|------|-------|
| Template Download | ~2s | Fast, no DB operations |
| Valid Import (2 animals) | ~10s | Includes preview + import |
| Duplicate Detection | ~12s | Creates animal first |
| Parent Matching | ~15s | Creates parents + offspring |
| Validation Errors | ~8s | Preview only, no import |
| CSV Export | ~5s | Download only |
| Large Import (100 rows) | ~30s | Preview only |
| **Total Suite** | **~90s** | All tests sequential |

### Optimization Tips

1. **Parallel Execution**: Run independent tests in parallel
   ```typescript
   test.describe.configure({ mode: "parallel" });
   ```

2. **Reuse Browser Context**: Share login session
   ```typescript
   test.beforeAll(async ({ browser }) => {
     context = await browser.newContext();
     // Login once, reuse context
   });
   ```

3. **Skip Slow Tests in Development**:
   ```typescript
   test.skip("large import", async () => {
     // Only run on CI
   });
   ```

---

## Best Practices

### ✅ DO

- **Clean up test data** in `afterAll` hooks
- **Use meaningful test names** that describe the scenario
- **Take screenshots** at key decision points
- **Wait for elements** before interacting
- **Verify API responses** in addition to UI
- **Test both happy path and error cases**
- **Use data attributes** for reliable selectors (`data-testid`)

### ❌ DON'T

- **Don't leave test data** in database after tests
- **Don't use hardcoded waits** (`page.waitForTimeout(5000)`)
- **Don't test implementation details** (test behavior, not code)
- **Don't run tests against production** database
- **Don't commit screenshots** to git (add to .gitignore)
- **Don't skip cleanup** even if tests fail

---

## Troubleshooting

### Tests Hang on CI

**Solution**: Increase timeouts

```typescript
test.setTimeout(120000); // 2 minutes

await page.waitForSelector('text="Success"', { timeout: 30000 });
```

---

### "Session expired" error

**Solution**: Refresh login before each test

```typescript
test.beforeEach(async () => {
  // Check if still logged in
  const response = await fetch(`${BASE_URL}/api/user/me`, {
    headers: { Cookie: `session=${authToken}` },
  });

  if (response.status === 401) {
    // Re-login
    await login();
  }
});
```

---

### CSV not downloading

**Solution**: Check download event handling

```typescript
// Correct way to handle downloads
const downloadPromise = page.waitForEvent("download");
await page.click('button:has-text("Download")');
const download = await downloadPromise;

// Save to specific path
await download.saveAs("/path/to/file.csv");
```

---

## Future Enhancements

### Phase 2: Visual Regression Testing

```typescript
// Add visual diff testing
await expect(page).toHaveScreenshot("import-wizard.png");
```

### Phase 3: Performance Testing

```typescript
// Measure import time
const startTime = Date.now();
await page.click('button:has-text("Import")');
await page.waitForSelector('text="Success"');
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(5000); // < 5 seconds
```

### Phase 4: Accessibility Testing

```typescript
import { injectAxe, checkA11y } from "axe-playwright";

test("import wizard is accessible", async ({ page }) => {
  await injectAxe(page);
  await checkA11y(page);
});
```

---

## Support

For E2E testing issues:
- **Playwright Docs**: https://playwright.dev
- **GitHub Issues**: https://github.com/breederhq/breederhq-api/issues
- **Team Slack**: #engineering-testing

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-21
**Author**: BreederHQ Engineering Team
