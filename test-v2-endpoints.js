/**
 * V2 API Endpoint Testing Script
 *
 * Tests all 13 V2 endpoints with proper authentication
 *
 * Usage:
 *   node test-v2-endpoints.js <session-cookie> <tenant-id>
 *
 * Example:
 *   node test-v2-endpoints.js "session=eyJhb..." 4
 */

const BASE_URL = 'http://localhost:6001';

async function testEndpoint(name, method, path, tenantId, sessionCookie, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'X-Tenant-ID': String(tenantId),
      'Cookie': sessionCookie,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const status = response.status;
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log(`\n✓ ${name}`);
    console.log(`  ${method} ${path}`);
    console.log(`  Status: ${status}`);
    if (status >= 400) {
      console.log(`  Error: ${JSON.stringify(data, null, 2)}`);
      return { success: false, status, data };
    } else {
      console.log(`  Success: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
      return { success: true, status, data };
    }
  } catch (error) {
    console.log(`\n✗ ${name}`);
    console.log(`  ${method} ${path}`);
    console.log(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node test-v2-endpoints.js <session-cookie> <tenant-id>');
    console.error('');
    console.error('To get your session cookie:');
    console.error('1. Open DevTools (F12) in your browser');
    console.error('2. Go to Application > Cookies > https://app.breederhq.test');
    console.error('3. Copy the entire "session" cookie value');
    console.error('4. Run: node test-v2-endpoints.js "session=<value>" <tenant-id>');
    process.exit(1);
  }

  const sessionCookie = args[0];
  const tenantId = args[1];

  console.log('='.repeat(80));
  console.log('V2 API Endpoint Testing');
  console.log('='.repeat(80));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log('');

  // Test Direct Listings endpoints
  console.log('\n--- DIRECT LISTINGS ---');

  const listResult = await testEndpoint(
    'List Direct Listings',
    'GET',
    `/api/v2/marketplace/direct-listings?tenantId=${tenantId}`,
    tenantId,
    sessionCookie
  );

  if (listResult.success && listResult.data?.items?.length > 0) {
    const firstId = listResult.data.items[0].id;

    await testEndpoint(
      'Get Direct Listing',
      'GET',
      `/api/v2/marketplace/direct-listings/${firstId}?tenantId=${tenantId}`,
      tenantId,
      sessionCookie
    );

    await testEndpoint(
      'Update Direct Listing Status',
      'PATCH',
      `/api/v2/marketplace/direct-listings/${firstId}/status?tenantId=${tenantId}`,
      tenantId,
      sessionCookie,
      { status: 'DRAFT' }
    );
  }

  // Test Animal Programs endpoints
  console.log('\n--- ANIMAL PROGRAMS ---');

  const programsResult = await testEndpoint(
    'List Animal Programs',
    'GET',
    `/api/v2/marketplace/animal-programs?tenantId=${tenantId}`,
    tenantId,
    sessionCookie
  );

  if (programsResult.success && programsResult.data?.items?.length > 0) {
    const firstProgram = programsResult.data.items[0];

    await testEndpoint(
      'Get Animal Program',
      'GET',
      `/api/v2/marketplace/animal-programs/${firstProgram.id}?tenantId=${tenantId}`,
      tenantId,
      sessionCookie
    );

    await testEndpoint(
      'Update Program Published Status',
      'PATCH',
      `/api/v2/marketplace/animal-programs/${firstProgram.id}/publish?tenantId=${tenantId}`,
      tenantId,
      sessionCookie,
      { published: firstProgram.published }
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log('Testing Complete');
  console.log('='.repeat(80));
  console.log('\nNOTE: Create/Delete operations not tested to avoid modifying data.');
  console.log('To test those, use the UI or add specific test data IDs to this script.');
}

main().catch(console.error);
