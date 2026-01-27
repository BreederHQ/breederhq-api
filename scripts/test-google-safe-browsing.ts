// Test Google Safe Browsing API directly
import { config } from "dotenv";

config();

const GOOGLE_SAFE_BROWSING_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
const GOOGLE_SAFE_BROWSING_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

async function testSafeBrowsing() {
  if (!GOOGLE_SAFE_BROWSING_API_KEY) {
    console.error("❌ GOOGLE_SAFE_BROWSING_API_KEY not set in environment");
    return;
  }

  console.log("✓ API Key found:", GOOGLE_SAFE_BROWSING_API_KEY.substring(0, 20) + "...");

  // Google's official test URLs that are GUARANTEED to be flagged
  const testUrls = [
    "http://testsafebrowsing.appspot.com/s/phishing.html", // Phishing
    "http://testsafebrowsing.appspot.com/s/malware.html", // Malware
    "http://testsafebrowsing.appspot.com/s/unwanted.html", // Unwanted software
    "https://google.com", // Safe URL (should NOT be flagged)
  ];

  console.log("\nTesting URLs:", testUrls);
  console.log("\n" + "=".repeat(80));

  try {
    const response = await fetch(`${GOOGLE_SAFE_BROWSING_URL}?key=${GOOGLE_SAFE_BROWSING_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "breederhq",
          clientVersion: "1.0.0",
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: testUrls.map((url) => ({ url })),
        },
      }),
    });

    console.log("\nAPI Response Status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("\n❌ API Error Response:");
      console.error(errorText);
      return;
    }

    const data = await response.json();

    console.log("\n✓ API Response:");
    console.log(JSON.stringify(data, null, 2));

    if (!data.matches || data.matches.length === 0) {
      console.log("\n✓ No threats detected (this is WRONG for test URLs!)");
      console.log("⚠️  Expected 3 malicious URLs to be flagged");
    } else {
      console.log(`\n✓ Found ${data.matches.length} threats:`);
      data.matches.forEach((match: any) => {
        console.log(`  - ${match.threat.url}`);
        console.log(`    Type: ${match.threatType}`);
        console.log(`    Platform: ${match.platformType}`);
      });
    }
  } catch (err: any) {
    console.error("\n❌ Error calling API:");
    console.error(err.message);
    console.error(err.stack);
  }
}

testSafeBrowsing();
