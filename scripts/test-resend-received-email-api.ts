// Test Resend's Received Email API to fetch inbound email content
import { config } from "dotenv";

config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function testReceivedEmailAPI() {
  if (!RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY not set in environment");
    return;
  }

  console.log("✓ API Key found:", RESEND_API_KEY.substring(0, 20) + "...");

  // You'll need to replace this with an actual email_id from a webhook event
  const testEmailId = "REPLACE_WITH_ACTUAL_EMAIL_ID_FROM_WEBHOOK";

  console.log(`\nTesting Received Email API with ID: ${testEmailId}`);
  console.log("=" .repeat(80));

  try {
    // CORRECT endpoint for INBOUND emails
    const response = await fetch(`https://api.resend.com/emails/receiving/${testEmailId}`, {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
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

    console.log("\n✓ Email Content Summary:");
    console.log("  Text length:", data.text?.length || 0);
    console.log("  HTML length:", data.html?.length || 0);
    console.log("  Has headers:", !!data.headers);
    console.log("  Attachments:", data.attachments?.length || 0);

    if (data.text) {
      console.log("\n✓ Plain Text (first 200 chars):");
      console.log(data.text.substring(0, 200));
    }

    if (data.headers) {
      console.log("\n✓ Email Headers:");
      console.log(JSON.stringify(data.headers, null, 2));
    }
  } catch (err: any) {
    console.error("\n❌ Error calling API:");
    console.error(err.message);
    console.error(err.stack);
  }
}

testReceivedEmailAPI();
