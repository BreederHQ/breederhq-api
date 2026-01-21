/**
 * E2E Tests for Data Import/Export Feature
 *
 * Prerequisites:
 * 1. Install Playwright: npm install -D @playwright/test
 * 2. Install browsers: npx playwright install
 * 3. Start dev server: npm run dev
 * 4. Run tests: npx playwright test tests/e2e/data-import-export.spec.ts
 *
 * Environment:
 * - Test user must exist with credentials in .env.test
 * - Database must be in clean state before tests
 * - API server must be running on http://localhost:3000
 */

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

// ESM __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || "https://app.breederhq.test";
const TEST_EMAIL = process.env.TEST_USER_EMAIL || "luke.skywalker@tester.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "soKpY9yUPoWeLwcRL16ONA";

// Test data tracking (for cleanup)
const createdAnimalIds: number[] = [];
const createdRegistryIds: number[] = [];

test.describe("Data Import/Export", () => {
  let page: Page;

  // Setup: Login before all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true, // Ignore SSL certificate errors for local development
    });
    page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`);

    // Fill email (look for input with Email label or placeholder)
    await page.fill('input[placeholder*="example.com"]', TEST_EMAIL);

    // Fill password (look for input with password placeholder)
    await page.fill('input[placeholder*="password"]', TEST_PASSWORD);

    // Click Sign In button
    await page.click('button:has-text("Sign In")');

    // Wait for redirect to dashboard or home (or root after login)
    await page.waitForURL(/^https?:\/\/[^\/]+\/(dashboard|home|animals|$)/, { timeout: 10000 });

    // Verify we're logged in by checking for user-specific content
    await expect(page.locator('text=/Good morning|Dashboard/i').first()).toBeVisible({ timeout: 5000 });
  });

  // Cleanup: Delete test data after all tests
  test.afterAll(async () => {
    // Clean up created animals
    for (const animalId of createdAnimalIds) {
      try {
        await page.request.delete(`${BASE_URL}/api/animals/${animalId}`);
      } catch (error) {
        console.error(`Failed to delete animal ${animalId}:`, error);
      }
    }

    // Clean up screenshots
    try {
      const screenshotsDir = path.join(__dirname, "screenshots");
      await fs.rm(screenshotsDir, { recursive: true, force: true });
    } catch (error) {
      console.error("Failed to clean up screenshots:", error);
    }

    await page.close();
  });

  // Helper function to open Settings panel
  async function openSettings() {
    // Click on Account Menu (avatar in top right)
    await page.click('button[aria-label="Account menu"], button:has-text("Account menu")');

    // Wait for menu to open and click Settings
    await page.click('text="Settings"');

    // Wait for Settings panel to open
    await page.waitForSelector('text="Platform Management"', { timeout: 5000 });
  }

  // Helper function to navigate to Data Management tab
  async function openDataManagement() {
    await openSettings();
    await page.click('text="Data Management"');
  }

  test.describe("CSV Template Download", () => {
    test("should download CSV template with examples", async () => {
      // Navigate to Data Management
      await openDataManagement();

      // Screenshot: Data Management page
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "01-data-management-page.png"),
      });

      // Click download template button and verify the API call works
      const responsePromise = page.waitForResponse((response) => response.url().includes("/api/v1/animals/templates/csv"));
      await page.click('button:has-text("Download CSV Template")');
      const response = await responsePromise;

      // Verify response is successful
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("text/csv");

      // Verify content
      const content = await response.text();
      expect(content).toContain("Name,Species,Sex");
      expect(content).toContain("Bella,DOG,FEMALE");
    });
  });

  test.describe("CSV Import - Valid Data", () => {
    test("should import valid CSV with 2 animals", async () => {
      // Create test CSV
      const csvContent = [
        "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
        'TestDog1,DOG,FEMALE,2023-01-15,982000111111111,Golden Retriever,,,AKC,TEST001,ACTIVE,"E2E test animal 1"',
        'TestDog2,DOG,MALE,2023-06-20,982000222222222,Labrador Retriever,,,AKC,TEST002,BREEDING,"E2E test animal 2"',
      ].join("\n");

      const csvPath = path.join(__dirname, "test-data", "valid-import.csv");
      await fs.mkdir(path.dirname(csvPath), { recursive: true });
      await fs.writeFile(csvPath, csvContent, "utf-8");

      // Navigate to Data Management
      await openDataManagement();

      // Open import wizard
      await page.click('button:has-text("Upload CSV File")');

      // Wait for wizard to open
      await page.waitForSelector('text="Import Animals from CSV"');

      // Screenshot: Upload step
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "02-import-wizard-upload.png"),
      });

      // Upload CSV file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(csvPath);

      // Click continue
      await page.click('button:has-text("Continue")');

      // Wait for preview to load
      await page.waitForSelector('text="Import Preview"', { timeout: 10000 });

      // Screenshot: Preview step
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "03-import-wizard-preview.png"),
      });

      // Verify summary
      await expect(page.locator('text="2"').first()).toBeVisible(); // Total valid rows
      await expect(page.locator('text="Valid"')).toBeVisible();

      // Click import button
      await page.click('button:has-text("Import 2 Animals")');

      // Wait for success
      await page.waitForSelector('text="Import Complete!"', { timeout: 15000 });

      // Screenshot: Success step
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "04-import-success.png"),
      });

      // Verify success message
      await expect(page.locator('text="2"').and(page.locator('text="imported"'))).toBeVisible();

      // Extract animal IDs for cleanup (from API response if possible)
      // For now, we'll query the API to find them
      const response = await page.request.get(`${BASE_URL}/api/animals?q=TestDog`);
      const data = await response.json();
      data.animals.forEach((animal: any) => {
        if (animal.name.startsWith("TestDog")) {
          createdAnimalIds.push(animal.id);
        }
      });

      // Close wizard
      await page.click('button:has-text("Done")');

      // Cleanup test CSV
      await fs.unlink(csvPath);
    });
  });

  test.describe("CSV Import - Duplicate Detection", () => {
    test("should detect duplicate and allow user to resolve", async () => {
      // First, create an animal via API
      const createResponse = await page.request.post(`${BASE_URL}/api/animals`, {
        data: {
          name: "DuplicateTestDog",
          species: "DOG",
          sex: "FEMALE",
          birthDate: "2023-03-10",
          status: "ACTIVE",
        },
      });
      const createdAnimal = await createResponse.json();
      createdAnimalIds.push(createdAnimal.id);

      // Create CSV with duplicate
      const csvContent = [
        "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
        'DuplicateTestDog,DOG,FEMALE,2023-03-10,982000333333333,Poodle,,,CKC,DUP001,BREEDING,"Updated via CSV"',
      ].join("\n");

      const csvPath = path.join(__dirname, "test-data", "duplicate-import.csv");
      await fs.writeFile(csvPath, csvContent, "utf-8");

      // Navigate and upload
      await openDataManagement();
      await page.click('button:has-text("Upload CSV File")');

      await page.locator('input[type="file"]').setInputFiles(csvPath);
      await page.click('button:has-text("Continue")');

      // Wait for preview
      await page.waitForSelector('text="Import Preview"');

      // Screenshot: Duplicate warning
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "05-duplicate-warning.png"),
      });

      // Verify warning shown
      await expect(page.locator('text="Needs Attention"')).toBeVisible();
      await expect(page.locator('text="matches an existing record"')).toBeVisible();

      // Click "Update existing animal" option
      await page.click('input[value="update"]');

      // Screenshot: Resolution selected
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "06-duplicate-resolved.png"),
      });

      // Import should now be enabled
      await page.click('button:has-text("Import 1 Animal")');

      // Wait for success
      await page.waitForSelector('text="Import Complete!"');

      // Verify update count
      await expect(page.locator('text="1"').and(page.locator('text="updated"'))).toBeVisible();

      // Close and cleanup
      await page.click('button:has-text("Done")');
      await fs.unlink(csvPath);
    });
  });

  test.describe("CSV Import - Parent Matching", () => {
    test("should suggest parent matches and allow linking", async () => {
      // Create parent animals via API
      const damResponse = await page.request.post(`${BASE_URL}/api/animals`, {
        data: {
          name: "TestMotherDog",
          species: "DOG",
          sex: "FEMALE",
          birthDate: "2020-01-15",
          status: "BREEDING",
        },
      });
      const dam = await damResponse.json();
      createdAnimalIds.push(dam.id);

      const sireResponse = await page.request.post(`${BASE_URL}/api/animals`, {
        data: {
          name: "TestFatherDog",
          species: "DOG",
          sex: "MALE",
          birthDate: "2019-06-20",
          status: "BREEDING",
        },
      });
      const sire = await sireResponse.json();
      createdAnimalIds.push(sire.id);

      // Create CSV with offspring (slightly different parent names)
      const csvContent = [
        "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
        'OffspringTestDog,DOG,FEMALE,2023-08-01,982000444444444,Mixed,TestMother,TestFather,,,ACTIVE,"Child of test parents"',
      ].join("\n");

      const csvPath = path.join(__dirname, "test-data", "parent-match-import.csv");
      await fs.writeFile(csvPath, csvContent, "utf-8");

      // Navigate and upload
      await openDataManagement();
      await page.click('button:has-text("Upload CSV File")');

      await page.locator('input[type="file"]').setInputFiles(csvPath);
      await page.click('button:has-text("Continue")');

      await page.waitForSelector('text="Import Preview"');

      // Screenshot: Parent not found warning
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "07-parent-not-found.png"),
      });

      // Verify warning shown
      await expect(page.locator('text="was not found"')).toBeVisible();

      // Select suggested parent (first suggestion)
      await page.click(`input[value="link-${dam.id}"]`);

      // Screenshot: Parent linked
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "08-parent-linked.png"),
      });

      // Import
      await page.click('button:has-text("Import 1 Animal")');
      await page.waitForSelector('text="Import Complete!"');

      // Verify import
      await expect(page.locator('text="1"').and(page.locator('text="imported"'))).toBeVisible();

      // Track offspring for cleanup
      const response = await page.request.get(`${BASE_URL}/api/animals?q=OffspringTestDog`);
      const data = await response.json();
      if (data.animals[0]) {
        createdAnimalIds.push(data.animals[0].id);
      }

      await page.click('button:has-text("Done")');
      await fs.unlink(csvPath);
    });
  });

  test.describe("CSV Import - Validation Errors", () => {
    test("should show validation errors for invalid data", async () => {
      // Create CSV with errors
      const csvContent = [
        "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
        ',DOG,FEMALE,2023-01-15,,,,,,,ACTIVE,"Missing name"',
        'ValidDog,DOGGO,MALE,Jan 15 2023,,,,,,,INVALID,"Invalid species and date"',
      ].join("\n");

      const csvPath = path.join(__dirname, "test-data", "error-import.csv");
      await fs.writeFile(csvPath, csvContent, "utf-8");

      // Navigate and upload
      await openDataManagement();
      await page.click('button:has-text("Upload CSV File")');

      await page.locator('input[type="file"]').setInputFiles(csvPath);
      await page.click('button:has-text("Continue")');

      await page.waitForSelector('text="Import Preview"');

      // Screenshot: Validation errors
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "09-validation-errors.png"),
      });

      // Verify errors shown
      await expect(page.locator('text="2"').and(page.locator('text="Errors"'))).toBeVisible();
      await expect(page.locator('text="Name is required"')).toBeVisible();
      await expect(page.locator('text="invalid"')).toBeVisible();

      // Import button should be disabled or show 0 animals
      await expect(page.locator('button:has-text("Import 0 Animals")')).toBeDisabled();

      // Close wizard
      await page.click('button:has-text("Back")');
      await page.click('button:has-text("Cancel")');
      await fs.unlink(csvPath);
    });
  });

  test.describe("CSV Export", () => {
    test("should export animals to CSV with filters", async () => {
      // Ensure we have test animals
      if (createdAnimalIds.length === 0) {
        // Create test animal
        const response = await page.request.post(`${BASE_URL}/api/animals`, {
          data: {
            name: "ExportTestDog",
            species: "DOG",
            sex: "FEMALE",
            status: "ACTIVE",
          },
        });
        const animal = await response.json();
        createdAnimalIds.push(animal.id);
      }

      // Navigate to Data Management
      await openDataManagement();

      // Open export dialog
      await page.click('button:has-text("Export All Animals")');

      await page.waitForSelector('text="Export Animals"');

      // Screenshot: Export dialog
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "10-export-dialog.png"),
      });

      // Select filters
      await page.selectOption('select', { label: "Dog" });
      await page.selectOption('select', { label: "Active" });
      await page.check('input[type="checkbox"]'); // Include extended

      // Screenshot: Filters selected
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "11-export-filtered.png"),
      });

      // Click export
      const downloadPromise = page.waitForEvent("download");
      await page.click('button:has-text("Export")');
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/animals-export-\d{4}-\d{2}-\d{2}\.csv/);

      // Save and verify content
      const downloadPath = path.join(__dirname, "test-downloads", download.suggestedFilename());
      await download.saveAs(downloadPath);

      const content = await fs.readFile(downloadPath, "utf-8");
      expect(content).toContain("ID,Name,Species,Sex");
      expect(content).toContain("DOG");

      // Cleanup
      await fs.unlink(downloadPath);
    });
  });

  test.describe("Edge Cases", () => {
    test("should handle large CSV (100+ rows)", async () => {
      // Generate large CSV
      const rows = ["Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes"];
      for (let i = 1; i <= 100; i++) {
        rows.push(`LargeTestDog${i},DOG,${i % 2 === 0 ? "FEMALE" : "MALE"},2023-01-${String(i % 28 + 1).padStart(2, "0")},,,,,,,ACTIVE,"Bulk test ${i}"`);
      }
      const csvContent = rows.join("\n");

      const csvPath = path.join(__dirname, "test-data", "large-import.csv");
      await fs.writeFile(csvPath, csvContent, "utf-8");

      // Navigate and upload
      await openDataManagement();
      await page.click('button:has-text("Upload CSV File")');

      await page.locator('input[type="file"]').setInputFiles(csvPath);
      await page.click('button:has-text("Continue")');

      // Wait for preview (may take longer)
      await page.waitForSelector('text="Import Preview"', { timeout: 30000 });

      // Verify count
      await expect(page.locator('text="100"')).toBeVisible();

      // Screenshot
      await page.screenshot({
        path: path.join(__dirname, "screenshots", "12-large-import.png"),
      });

      // Don't actually import - just verify preview works
      await page.click('button:has-text("Back")');
      await page.click('button:has-text("Cancel")');
      await fs.unlink(csvPath);
    });

    test("should handle CSV with special characters in notes", async () => {
      const csvContent = [
        "Name,Species,Sex,Birth Date,Microchip,Breed,Dam Name,Sire Name,Registry Name,Registry Number,Status,Notes",
        'SpecialDog,DOG,FEMALE,2023-01-15,,,,,,,ACTIVE,"Notes with ""quotes"", commas, and\nnewlines"',
      ].join("\n");

      const csvPath = path.join(__dirname, "test-data", "special-chars-import.csv");
      await fs.writeFile(csvPath, csvContent, "utf-8");

      await page.goto(`${BASE_URL}/settings`);
      await page.click('text="Data Management"');
      await page.click('button:has-text("Upload CSV File")');

      await page.locator('input[type="file"]').setInputFiles(csvPath);
      await page.click('button:has-text("Continue")');

      await page.waitForSelector('text="Import Preview"');

      // Verify special chars handled
      await expect(page.locator('text="Valid"')).toBeVisible();

      await page.click('button:has-text("Back")');
      await page.click('button:has-text("Cancel")');
      await fs.unlink(csvPath);
    });
  });
});
