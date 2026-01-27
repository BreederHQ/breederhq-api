import { extractNameFromEmail } from "../src/services/inbound-email-service.js";

console.log("Testing extractNameFromEmail:");
console.log('aaron@breederhq.com ->', extractNameFromEmail("aaron@breederhq.com"));
console.log('john.doe@example.com ->', extractNameFromEmail("john.doe@example.com"));
console.log('test_user@example.com ->', extractNameFromEmail("test_user@example.com"));
