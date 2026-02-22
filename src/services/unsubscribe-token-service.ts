// src/services/unsubscribe-token-service.ts
// JWT-based tokens for email unsubscribe links.
// Uses a dedicated secret separate from auth tokens.

import jwt from "jsonwebtoken";

const UNSUBSCRIBE_SECRET = process.env.JWT_UNSUBSCRIBE_SECRET;
const TOKEN_EXPIRY = "90d"; // CAN-SPAM requires minimum 30 days

/**
 * Payload embedded in unsubscribe JWT tokens.
 */
export interface UnsubscribeTokenPayload {
  partyId: number;
  channel: "EMAIL" | "SMS";
  tenantId: number;
  /** Discriminator to prevent cross-purpose token reuse */
  purpose: "unsubscribe";
}

function ensureSecret(): string {
  if (!UNSUBSCRIBE_SECRET) {
    throw new Error("JWT_UNSUBSCRIBE_SECRET environment variable is required for unsubscribe tokens");
  }
  return UNSUBSCRIBE_SECRET;
}

/**
 * Generate a signed JWT token for an unsubscribe link.
 * Token encodes the partyId, channel, and tenantId so the unsubscribe
 * endpoint can process it without authentication.
 */
export function generateUnsubscribeToken(payload: UnsubscribeTokenPayload): string {
  const secret = ensureSecret();
  return jwt.sign(
    {
      partyId: payload.partyId,
      channel: payload.channel,
      tenantId: payload.tenantId,
      purpose: payload.purpose,
    },
    secret,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode an unsubscribe token.
 * Returns the payload if valid, throws if expired or tampered.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload {
  const secret = ensureSecret();
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

  // Validate the purpose claim to prevent using auth tokens as unsubscribe tokens
  if (decoded.purpose !== "unsubscribe") {
    throw new Error("Invalid token purpose");
  }

  if (typeof decoded.partyId !== "number" || typeof decoded.tenantId !== "number") {
    throw new Error("Invalid token payload");
  }

  if (decoded.channel !== "EMAIL" && decoded.channel !== "SMS") {
    throw new Error("Invalid token channel");
  }

  return {
    partyId: decoded.partyId,
    channel: decoded.channel,
    tenantId: decoded.tenantId,
    purpose: "unsubscribe",
  };
}
