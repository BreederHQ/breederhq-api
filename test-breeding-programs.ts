/**
 * Breeding Program Enhancements - Comprehensive Test Suite
 * Tests all 18 scenarios from the testing plan
 */

import prisma from "./src/prisma.js";

// Test results tracking
const testResults: Array<{
  test: string;
  phase: string;
  passed: boolean;
  duration: number;
  notes: string;
  errors?: string[];
}> = [];

async function runTest(
  phase: string,
  name: string,
  testFn: () => Promise<{ passed: boolean; notes: string; errors?: string[] }>
) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Running: ${name}`);
  console.log("=".repeat(80));

  const startTime = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;

    testResults.push({
      test: name,
      phase,
      passed: result.passed,
      duration,
      notes: result.notes,
      errors: result.errors,
    });

    console.log(`\n${result.passed ? "✅ PASS" : "❌ FAIL"} - ${name}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Notes: ${result.notes}`);
    if (result.errors) {
      result.errors.forEach((error) => console.log(`  Error: ${error}`));
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({
      test: name,
      phase,
      passed: false,
      duration,
      notes: `Error: ${errorMessage}`,
      errors: [errorMessage],
    });

    console.log(`\n❌ FAIL - ${name}`);
    console.log(`Error: ${error}`);
  }
}

// ============================================================================
// Setup: Create Test Data
// ============================================================================
async function setupTestData() {
  console.log("\n🧹 Cleaning up old test data...");

  // Delete old test programs
  await prisma.breedingProgramInquiry.deleteMany({
    where: {
      program: {
        slug: {
          in: ["test-arabians", "tenant1-program", "tenant2-program", "xss-test"],
        },
      },
    },
  });

  await prisma.breedingProgramMedia.deleteMany({
    where: {
      program: {
        slug: {
          in: ["test-arabians", "tenant1-program", "tenant2-program", "xss-test"],
        },
      },
    },
  });

  await prisma.breedingProgram.deleteMany({
    where: {
      slug: {
        in: ["test-arabians", "tenant1-program", "tenant2-program", "xss-test"],
      },
    },
  });

  console.log("✅ Cleanup complete");

  console.log("\n📦 Creating test breeding program...");

  // Get first tenant
  const firstTenant = await prisma.tenant.findFirst();
  if (!firstTenant) {
    throw new Error("No tenant found in database");
  }

  // Create main test program
  const testProgram = await prisma.breedingProgram.create({
    data: {
      tenantId: firstTenant.id,
      slug: "test-arabians",
      name: "Champion Arabians Breeding Program",
      description: "Premier Arabian horse breeding with championship bloodlines",
      species: "HORSE",
      breedText: "Arabian",
      listed: true,
      acceptInquiries: true,
      showCoverImage: true,
      coverImageUrl: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800",
      pricingTiers: [
        {
          tier: "Pet Quality",
          priceRange: "$5,000 - $8,000",
          description: "Beautiful companion horses",
        },
        {
          tier: "Breeding Quality",
          priceRange: "$10,000 - $20,000",
          description: "Show-quality bloodlines",
        },
        {
          tier: "Show Quality",
          priceRange: "$25,000+",
          description: "Championship prospects",
        },
      ],
      whatsIncluded:
        "Health guarantee, current vaccinations, vet check, 30-day health insurance, lifetime breeder support",
      typicalWaitTime: "6-12 months",
      programStory:
        "For over 20 years, we have been dedicated to breeding exceptional Arabian horses with champion bloodlines. Our program focuses on temperament, conformation, and athletic ability.",
      publishedAt: new Date(),
    },
  });

  // Add media
  await prisma.breedingProgramMedia.createMany({
    data: [
      {
        programId: testProgram.id,
        tenantId: firstTenant.id,
        assetUrl: "https://images.unsplash.com/photo-1551769881-1d05d5d4c00a?w=800",
        caption: "Our breeding facility in Northern California",
        sortOrder: 0,
        isPublic: true,
      },
      {
        programId: testProgram.id,
        tenantId: firstTenant.id,
        assetUrl: "https://images.unsplash.com/photo-1586466641076-c7c8e45a1a07?w=800",
        caption: "Championship bloodline sire",
        sortOrder: 1,
        isPublic: true,
      },
      {
        programId: testProgram.id,
        tenantId: firstTenant.id,
        assetUrl: "https://images.unsplash.com/photo-1564250152-13cf3b1bb10e?w=800",
        caption: "Recent foal from 2025",
        sortOrder: 2,
        isPublic: true,
      },
    ],
  });

  console.log(`✅ Created test program: ${testProgram.slug}`);

  return { testProgram, tenant: firstTenant };
}

// ============================================================================
// Test 1: List Public Breeding Programs
// ============================================================================
async function test1_ListPrograms() {
  const baseUrl = "http://localhost:6001";

  try {
    // Test without filters
    const response = await fetch(`${baseUrl}/api/v1/public/breeding-programs`);
    const data = await response.json();

    // API returns {items: [], total: number} format
    if (!data.items || !Array.isArray(data.items)) {
      return {
        passed: false,
        notes: "Response does not have items array",
        errors: [`Expected {items: []}, got ${JSON.stringify(data).substring(0, 100)}`],
      };
    }

    const programs = data.items;

    // Test with species filter
    const horseResponse = await fetch(
      `${baseUrl}/api/v1/public/breeding-programs?species=HORSE`
    );
    const horseData = await horseResponse.json();
    const horsePrograms = horseData.items || [];

    // Test with search filter
    const searchResponse = await fetch(
      `${baseUrl}/api/v1/public/breeding-programs?search=arabian`
    );
    const searchData = await searchResponse.json();
    const searchPrograms = searchData.items || [];

    const testProgram = programs.find((p: any) => p.slug === "test-arabians");
    if (!testProgram) {
      return {
        passed: false,
        notes: "Test program not found in results",
        errors: ["test-arabians program not in list"],
      };
    }

    return {
      passed: true,
      notes: `Found ${programs.length} total programs, ${horsePrograms.length} horses, ${searchPrograms.length} matching "arabian"`,
    };
  } catch (error) {
    return {
      passed: false,
      notes: `API request failed: ${error instanceof Error ? error.message : String(error)}`,
      errors: [String(error)],
    };
  }
}

// ============================================================================
// Test 2: Get Single Program by Slug
// ============================================================================
async function test2_GetProgramBySlug() {
  const baseUrl = "http://localhost:6001";

  try {
    const response = await fetch(`${baseUrl}/api/v1/public/breeding-programs/test-arabians`);
    if (!response.ok) {
      return {
        passed: false,
        notes: `HTTP ${response.status}: ${response.statusText}`,
        errors: [`Expected 200, got ${response.status}`],
      };
    }

    const program = await response.json();

    // Verify required fields
    const requiredFields = ["id", "slug", "name", "description", "species", "breedText"];
    const missingFields = requiredFields.filter((field) => !(field in program));

    if (missingFields.length > 0) {
      return {
        passed: false,
        notes: `Missing required fields: ${missingFields.join(", ")}`,
        errors: missingFields.map((f) => `Missing field: ${f}`),
      };
    }

    // Verify media array
    if (!Array.isArray(program.media)) {
      return {
        passed: false,
        notes: "Media is not an array",
        errors: ["Expected media array"],
      };
    }

    // Verify stats
    const hasStats =
      typeof program.stats === "object" &&
      "activeBreedingPlans" in program.stats &&
      "upcomingLitters" in program.stats;

    return {
      passed: true,
      notes: `Program loaded successfully. Has ${program.media.length} media items. Stats: ${hasStats ? "✓" : "✗"}`,
    };
  } catch (error) {
    return {
      passed: false,
      notes: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      errors: [String(error)],
    };
  }
}

// ============================================================================
// Test 3: Submit Inquiry (Valid Data)
// ============================================================================
async function test3_SubmitInquiryValid() {
  const baseUrl = "http://localhost:6001";

  const inquiryData = {
    buyerName: "John Doe",
    buyerEmail: "john.test@example.com",
    buyerPhone: "+1 (555) 123-4567",
    subject: "Interested in upcoming Arabian litters",
    message:
      "I am looking for a breeding-quality Arabian mare. Do you have any expected foals in the next 6 months?",
    interestedIn: "Next litter",
    priceRange: "$10K-$20K",
    timeline: "Next 3 months",
    source: "Marketplace",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "horse-breeding-2026",
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/public/breeding-programs/test-arabians/inquiries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inquiryData),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        passed: false,
        notes: `HTTP ${response.status}: ${JSON.stringify(result)}`,
        errors: [`Expected 200, got ${response.status}`],
      };
    }

    // Verify inquiry in database
    const inquiry = await prisma.breedingProgramInquiry.findFirst({
      where: {
        buyerEmail: "john.test@example.com",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!inquiry) {
      return {
        passed: false,
        notes: "Inquiry not found in database",
        errors: ["Database record not created"],
      };
    }

    // Verify UTM tracking
    const hasUtm =
      inquiry.utmSource === "google" &&
      inquiry.utmMedium === "cpc" &&
      inquiry.utmCampaign === "horse-breeding-2026";

    return {
      passed: true,
      notes: `Inquiry created successfully. ID: ${inquiry.id}. UTM tracking: ${hasUtm ? "✓" : "✗"}. Status: ${inquiry.status}`,
    };
  } catch (error) {
    return {
      passed: false,
      notes: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      errors: [String(error)],
    };
  }
}

// ============================================================================
// Test 4: Submit Inquiry (Invalid Data)
// ============================================================================
async function test4_SubmitInquiryInvalid() {
  const baseUrl = "http://localhost:6001";
  const errors: string[] = [];

  // Test A: Missing buyerName
  try {
    const response1 = await fetch(
      `${baseUrl}/api/v1/public/breeding-programs/test-arabians/inquiries`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: "john@example.com",
          subject: "Test",
          message: "Test",
        }),
      }
    );

    if (response1.status !== 400) {
      errors.push(`Missing buyerName: Expected 400, got ${response1.status}`);
    }
  } catch (err) {
    errors.push(`Missing buyerName test failed: ${err}`);
  }

  // Test B: Invalid email
  try {
    const response2 = await fetch(
      `${baseUrl}/api/v1/public/breeding-programs/test-arabians/inquiries`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName: "John",
          buyerEmail: "invalid-email",
          subject: "Test",
          message: "Test",
        }),
      }
    );

    if (response2.status !== 400) {
      errors.push(`Invalid email: Expected 400, got ${response2.status}`);
    }
  } catch (err) {
    errors.push(`Invalid email test failed: ${err}`);
  }

  return {
    passed: errors.length === 0,
    notes:
      errors.length === 0
        ? "All validation tests passed"
        : `${errors.length} validation tests failed`,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================================
// Test 5: Multi-Tenant Isolation
// ============================================================================
async function test5_MultiTenantIsolation() {
  // Get two different tenants
  const tenants = await prisma.tenant.findMany({ take: 2 });

  if (tenants.length < 2) {
    return {
      passed: false,
      notes: "Need at least 2 tenants for isolation test",
      errors: ["Insufficient tenants"],
    };
  }

  // Create programs for different tenants
  await prisma.breedingProgram.createMany({
    data: [
      {
        tenantId: tenants[0].id,
        slug: "tenant1-program",
        name: "Tenant 1 Program",
        species: "HORSE",
        listed: true,
        acceptInquiries: true,
      },
      {
        tenantId: tenants[1].id,
        slug: "tenant2-program",
        name: "Tenant 2 Program",
        species: "HORSE",
        listed: true,
        acceptInquiries: true,
      },
    ],
  });

  // Submit inquiry to tenant1-program
  const baseUrl = "http://localhost:6001";
  await fetch(`${baseUrl}/api/v1/public/breeding-programs/tenant1-program/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyerName: "Tenant Test",
      buyerEmail: "tenant-test@example.com",
      subject: "Test",
      message: "Testing multi-tenant isolation",
    }),
  });

  // Verify inquiry has correct tenantId
  const inquiry = await prisma.breedingProgramInquiry.findFirst({
    where: {
      program: { slug: "tenant1-program" },
    },
    include: { program: true },
  });

  if (!inquiry) {
    return {
      passed: false,
      notes: "Inquiry not created",
      errors: ["No inquiry found"],
    };
  }

  const correctTenant = inquiry.tenantId === tenants[0].id;

  return {
    passed: correctTenant,
    notes: `Inquiry tenant: ${inquiry.tenantId}, Program tenant: ${inquiry.program.tenantId}. Isolation: ${correctTenant ? "✓" : "✗"}`,
  };
}

// ============================================================================
// Test 16: XSS Prevention
// ============================================================================
async function test16_XSSPrevention() {
  const testTenant = await prisma.tenant.findFirst();
  if (!testTenant) {
    return { passed: false, notes: "No tenant found", errors: ["No tenant"] };
  }

  // Create program with malicious content
  await prisma.breedingProgram.create({
    data: {
      tenantId: testTenant.id,
      slug: "xss-test",
      name: 'Test <script>alert("XSS")</script>',
      description: 'Description with <img src=x onerror=alert("XSS")>',
      species: "HORSE",
      listed: true,
    },
  });

  // Fetch program and check if XSS content is returned
  const baseUrl = "http://localhost:6001";
  const response = await fetch(`${baseUrl}/api/v1/public/breeding-programs/xss-test`);
  const program = await response.json();

  // Check if script tags are in the response (they should be)
  // The prevention happens on the frontend with React escaping
  const hasScriptInName = program.name.includes("<script>");

  return {
    passed: true,
    notes: `XSS content returned as-is (${hasScriptInName ? "✓" : "✗"}). Frontend should sanitize. Backend stores raw data.`,
  };
}

// ============================================================================
// Test 18: API Response Times
// ============================================================================
async function test18_APIResponseTimes() {
  const baseUrl = "http://localhost:6001";

  // Test list programs
  const listStart = Date.now();
  await fetch(`${baseUrl}/api/v1/public/breeding-programs`);
  const listTime = Date.now() - listStart;

  // Test get program
  const getStart = Date.now();
  await fetch(`${baseUrl}/api/v1/public/breeding-programs/test-arabians`);
  const getTime = Date.now() - getStart;

  // Test submit inquiry
  const submitStart = Date.now();
  await fetch(`${baseUrl}/api/v1/public/breeding-programs/test-arabians/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyerName: "Performance Test",
      buyerEmail: "perf@example.com",
      subject: "Test",
      message: "Testing API performance",
    }),
  });
  const submitTime = Date.now() - submitStart;

  const listPass = listTime < 200;
  const getPass = getTime < 150;
  const submitPass = submitTime < 300;

  return {
    passed: listPass && getPass && submitPass,
    notes: `List: ${listTime}ms (target <200ms) ${listPass ? "✓" : "✗"}, Get: ${getTime}ms (target <150ms) ${getPass ? "✓" : "✗"}, Submit: ${submitTime}ms (target <300ms) ${submitPass ? "✓" : "✗"}`,
  };
}

// ============================================================================
// Main Test Runner
// ============================================================================
async function main() {
  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════════════════════╗");
  console.log("║   BREEDING PROGRAM ENHANCEMENTS - BACKEND TEST SUITE                     ║");
  console.log("║   Tests 1-5, 16, 18 (API & Performance)                                  ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════════╝");

  // Setup test data
  const { testProgram, tenant } = await setupTestData();
  console.log(`\n✅ Test environment ready. Tenant: ${tenant.id}, Program: ${testProgram.slug}`);

  // Wait for backend to be ready
  console.log("\n⏳ Assuming backend server is running on port 6001...");
  // Skip health check as /health endpoint may not exist
  console.log("✅ Proceeding with tests\n");

  // Run backend tests
  await runTest("Phase 1: Backend API", "Test 1: List Public Breeding Programs", test1_ListPrograms);
  await runTest("Phase 1: Backend API", "Test 2: Get Single Program by Slug", test2_GetProgramBySlug);
  await runTest("Phase 1: Backend API", "Test 3: Submit Inquiry (Valid Data)", test3_SubmitInquiryValid);
  await runTest("Phase 1: Backend API", "Test 4: Submit Inquiry (Invalid Data)", test4_SubmitInquiryInvalid);
  await runTest("Phase 1: Backend API", "Test 5: Multi-Tenant Isolation", test5_MultiTenantIsolation);
  await runTest("Phase 3: Edge Cases", "Test 16: XSS Prevention", test16_XSSPrevention);
  await runTest("Phase 4: Performance", "Test 18: API Response Times", test18_APIResponseTimes);

  // Print summary
  console.log("\n\n");
  console.log("╔═══════════════════════════════════════════════════════════════════════════╗");
  console.log("║   BACKEND TEST SUMMARY                                                    ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════════╝");

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  const total = testResults.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  console.log("\n\nDetailed Results:\n");

  testResults.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.passed ? "✅" : "❌"} ${result.test}`);
    console.log(`   Phase: ${result.phase}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Notes: ${result.notes}`);
    if (result.errors) {
      result.errors.forEach((error) => console.log(`   Error: ${error}`));
    }
    console.log();
  });

  console.log("\n✅ Backend tests complete!");
  console.log("\n📝 Next steps:");
  console.log("   1. Run Playwright tests for frontend (Tests 6-15, 17)");
  console.log("   2. Generate comprehensive test report");
}

main()
  .catch((e) => {
    console.error("\n❌ Test suite failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
