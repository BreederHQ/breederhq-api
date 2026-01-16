// Test rate limiting on inquiry endpoint
// Should allow 10 requests per minute, then block with RATE_LIMITED error

const baseUrl = "http://localhost:6001";
const slug = "test-arabians";

async function testRateLimit() {
  console.log("Testing rate limit: 10 requests per minute");
  console.log("Sending 12 requests rapidly...\n");

  const results: Array<{ attempt: number; status: number; message: string }> = [];

  for (let i = 1; i <= 12; i++) {
    try {
      const response = await fetch(
        `${baseUrl}/api/v1/public/breeding-programs/${slug}/inquiries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyerName: `Rate Limit Test ${i}`,
            buyerEmail: `test${i}@example.com`,
            subject: "Rate limit test",
            message: "Testing rate limiting",
          }),
        }
      );

      const data = await response.json();

      if (response.status === 429 || data.error === "RATE_LIMITED") {
        results.push({
          attempt: i,
          status: response.status,
          message: "❌ RATE LIMITED (expected after 10 requests)",
        });
        console.log(`Request ${i}: ❌ RATE LIMITED (status ${response.status})`);
      } else if (response.ok) {
        results.push({
          attempt: i,
          status: response.status,
          message: "✅ SUCCESS",
        });
        console.log(`Request ${i}: ✅ SUCCESS (status ${response.status})`);
      } else {
        results.push({
          attempt: i,
          status: response.status,
          message: `⚠️ ERROR: ${data.error || "unknown"}`,
        });
        console.log(`Request ${i}: ⚠️ ERROR ${response.status} - ${data.error}`);
      }

      // Small delay to ensure requests are processed
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (err) {
      results.push({
        attempt: i,
        status: 0,
        message: `❌ NETWORK ERROR: ${err}`,
      });
      console.log(`Request ${i}: ❌ NETWORK ERROR`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("RATE LIMIT TEST SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.status === 200 || r.status === 201);
  const rateLimited = results.filter((r) => r.status === 429 || r.message.includes("RATE LIMITED"));
  const errors = results.filter((r) => r.status !== 200 && r.status !== 201 && r.status !== 429);

  console.log(`Successful requests: ${successful.length}/12`);
  console.log(`Rate limited requests: ${rateLimited.length}/12`);
  console.log(`Other errors: ${errors.length}/12`);

  if (successful.length === 10 && rateLimited.length === 2) {
    console.log("\n✅ RATE LIMITING WORKING AS EXPECTED");
    console.log("   - First 10 requests succeeded");
    console.log("   - Requests 11-12 were rate limited");
  } else if (successful.length <= 10 && rateLimited.length >= 1) {
    console.log("\n✅ RATE LIMITING IS ACTIVE");
    console.log(`   - ${successful.length} requests succeeded before rate limit`);
    console.log(`   - ${rateLimited.length} requests were blocked`);
  } else {
    console.log("\n⚠️ UNEXPECTED RESULT");
    console.log("   Expected: 10 successful, 2 rate limited");
    console.log(`   Actual: ${successful.length} successful, ${rateLimited.length} rate limited`);
  }

  console.log("\n" + "=".repeat(60));
}

testRateLimit().catch(console.error);
