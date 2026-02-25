// src/services/anthropic-client.ts
// Lazy-init singleton for the Anthropic Claude API client.
// Follows the same pattern as s3-client.ts / stripe-client.ts.

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY not configured. Add it to AWS Secrets Manager."
      );
    }
    client = new Anthropic({ apiKey });
    console.log("[Anthropic] Client initialized");
  }
  return client;
}

/** Reset singleton (for testing). */
export function _resetAnthropicClient(): void {
  client = null;
}
