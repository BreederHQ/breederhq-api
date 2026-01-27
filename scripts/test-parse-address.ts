import { parseTenantInboundAddress, parseReplyToAddress } from "../src/services/inbound-email-service.js";

const testAddresses = [
  "afc-richmond-kennels@mail.breederhq.com",
  "reply+t_123_abc@mail.breederhq.com",
  "test@mail.breederhq.com",
];

console.log("Testing email address parsing:\n");

testAddresses.forEach((address) => {
  console.log(`Address: ${address}`);

  const replyInfo = parseReplyToAddress(address);
  if (replyInfo) {
    console.log(`  ✓ Reply-to-thread: threadId=${replyInfo.threadId}`);
  }

  const tenantInfo = parseTenantInboundAddress(address);
  if (tenantInfo) {
    console.log(`  ✓ Tenant inbound: slug="${tenantInfo.slug}"`);
  }

  if (!replyInfo && !tenantInfo) {
    console.log(`  ✗ Not recognized`);
  }

  console.log();
});
