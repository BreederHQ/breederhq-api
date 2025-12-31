// src/utils/session.ts
// Centralized session cookie utilities with signature verification
// Includes surface-bound CSRF token generation

import type { FastifyRequest, FastifyReply } from "fastify";

// ---------- Surface Type ----------
export type Surface = "PLATFORM" | "PORTAL" | "MARKETPLACE";

/**
 * Session payload stored in the cookie.
 * The cookie itself is signed via @fastify/cookie.
 */
export type SessionPayload = {
  userId: string;
  tenantId?: number;
  iat: number; // ms epoch when issued
  exp: number; // ms epoch when expires
};

// ---------- Environment ----------
export const COOKIE_NAME = process.env.COOKIE_NAME || "bhq_s";
const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();
const ALLOW_CROSS_SITE = String(process.env.COOKIE_CROSS_SITE || "").trim() === "1";

/**
 * Cookie domain for SSO across subdomains.
 * In production: ".breederhq.com" (with leading dot) allows sharing across app/portal/marketplace subdomains.
 * In development: undefined (browser defaults to current host).
 *
 * Set via COOKIE_DOMAIN env var, or auto-detect in production.
 */
function getCookieDomain(): string | undefined {
  // Explicit override
  const explicit = process.env.COOKIE_DOMAIN?.trim();
  if (explicit) return explicit;

  // In production, default to .breederhq.com for SSO
  if (NODE_ENV === "production") {
    return ".breederhq.com";
  }

  // Dev/test: no domain (browser uses current host)
  return undefined;
}

/**
 * COOKIE_SECRET is required in ALL environments (including dev).
 * Server refuses to start without it.
 */
export function getCookieSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  // No fallback - require COOKIE_SECRET everywhere
  throw new Error(
    "FATAL: COOKIE_SECRET environment variable is required and must be at least 32 characters.\n" +
    "Set COOKIE_SECRET in your .env file or environment.\n" +
    "Example: COOKIE_SECRET=$(openssl rand -base64 32)"
  );
}

// ---------- Session Lifetimes ----------
export function sessionLifetimes() {
  // If CROSS_SITE=1 → short 24h; else dev = 7d, prod = 24h
  const ms = ALLOW_CROSS_SITE
    ? 24 * 60 * 60 * 1000
    : (NODE_ENV === "development" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
  const rotateAt = Math.floor(ms * 0.2);
  return { ms, rotateAt };
}

// ---------- Cookie Options ----------
export function cookieOptions() {
  const { ms } = sessionLifetimes();
  const sameSite: "lax" | "none" = ALLOW_CROSS_SITE ? "none" : "lax";
  const secure = ALLOW_CROSS_SITE || NODE_ENV === "production";
  const domain = getCookieDomain();

  // Build options object conditionally to avoid sending domain: undefined
  const opts: {
    httpOnly: boolean;
    sameSite: "lax" | "none";
    secure: boolean;
    path: string;
    maxAge: number;
    signed: boolean;
    domain?: string;
  } = {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: Math.floor(ms / 1000),
    signed: true, // <-- CRITICAL: sign the cookie
  };

  // Only add domain if defined (production SSO)
  if (domain) {
    opts.domain = domain;
  }

  return opts;
}

// ---------- Surface-Bound CSRF Token ----------
/**
 * Generate a surface-bound CSRF token.
 * Format: "<SURFACE>.<randomBase64url>"
 * The surface prefix ensures tokens from one surface are rejected on another.
 */
export function generateCsrfToken(surface: Surface): string {
  const random = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  return `${surface}.${random}`;
}

/**
 * Parse a surface-bound CSRF token.
 * Returns the surface prefix and random part, or null if invalid format.
 */
export function parseCsrfToken(token: string): { surface: Surface; random: string } | null {
  if (!token || typeof token !== "string") return null;
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;

  const surfacePart = token.slice(0, dotIndex);
  const randomPart = token.slice(dotIndex + 1);

  if (!randomPart) return null;
  if (surfacePart !== "PLATFORM" && surfacePart !== "PORTAL" && surfacePart !== "MARKETPLACE") {
    return null;
  }

  return { surface: surfacePart as Surface, random: randomPart };
}

/**
 * Validate CSRF token against the request surface.
 * Returns { valid: true } or { valid: false, detail: string }.
 */
export function validateCsrfToken(
  csrfHeader: string | undefined,
  csrfCookie: string | undefined,
  requestSurface: Surface
): { valid: true } | { valid: false; detail: string } {
  // Check header and cookie are present and match
  if (!csrfHeader || !csrfCookie) {
    return { valid: false, detail: "missing_token" };
  }
  if (String(csrfHeader) !== String(csrfCookie)) {
    return { valid: false, detail: "token_mismatch" };
  }

  // Parse the token to extract surface
  const parsed = parseCsrfToken(csrfCookie);
  if (!parsed) {
    // Legacy token without surface prefix - reject
    return { valid: false, detail: "invalid_token_format" };
  }

  // Verify surface matches
  if (parsed.surface !== requestSurface) {
    return { valid: false, detail: "surface_mismatch" };
  }

  return { valid: true };
}

// ---------- Parse and Verify Session ----------
/**
 * Parse and verify a signed session cookie.
 * Returns null if:
 * - Cookie is missing
 * - Signature is invalid (tampered)
 * - Payload is malformed
 * - Session is expired
 */
export function parseVerifiedSession(req: FastifyRequest): SessionPayload | null {
  const rawCookie = req.cookies?.[COOKIE_NAME];
  if (!rawCookie) return null;

  // Verify signature using @fastify/cookie unsignCookie
  const unsigned = req.unsignCookie(rawCookie);
  if (!unsigned.valid || !unsigned.value) {
    // Signature verification failed - cookie was tampered or invalid
    return null;
  }

  // Now decode the verified payload
  try {
    const obj = JSON.parse(Buffer.from(unsigned.value, "base64url").toString("utf8"));
    if (!obj?.userId || !obj?.iat || !obj?.exp) return null;
    // Check expiration
    if (Date.now() >= Number(obj.exp)) return null;
    return obj as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set session cookies (signed).
 * Creates both the session cookie (HttpOnly, signed) and surface-bound CSRF token (not HttpOnly).
 *
 * @param reply - Fastify reply object
 * @param sess - Session payload without iat/exp
 * @param surface - The surface to bind the CSRF token to (defaults to PLATFORM for backward compat)
 */
export function setSessionCookies(
  reply: FastifyReply,
  sess: Omit<SessionPayload, "iat" | "exp">,
  surface: Surface = "PLATFORM"
): void {
  const now = Date.now();
  const { ms } = sessionLifetimes();
  const payload: SessionPayload = { ...sess, iat: now, exp: now + ms };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  // Session cookie (HttpOnly, signed)
  reply.setCookie(COOKIE_NAME, encoded, cookieOptions());

  // Surface-bound CSRF token (not HttpOnly)
  // Format: "<SURFACE>.<randomBase64url>" - ensures token is rejected on different surfaces
  const csrfToken = generateCsrfToken(surface);
  reply.setCookie("XSRF-TOKEN", csrfToken, {
    ...cookieOptions(),
    httpOnly: false,
    signed: false, // CSRF token doesn't need signing - it's validated by double-submit pattern
  });
}

/**
 * Clear all auth cookies.
 * Must use same domain attribute as set cookies for cross-subdomain clearing.
 */
export function clearSessionCookies(reply: FastifyReply): void {
  const opts = cookieOptions();
  const domain = getCookieDomain();

  // Build clear options with domain if applicable
  const clearOpts: { path: string; domain?: string } = { path: "/" };
  if (domain) {
    clearOpts.domain = domain;
  }

  // Clear session cookie
  reply.setCookie(COOKIE_NAME, "", { ...opts, maxAge: 0 });
  reply.clearCookie(COOKIE_NAME, clearOpts);

  // Clear CSRF cookie
  reply.setCookie("XSRF-TOKEN", "", { ...opts, httpOnly: false, signed: false, maxAge: 0 });
  reply.clearCookie("XSRF-TOKEN", clearOpts);
}

/**
 * Maybe rotate session if close to expiry.
 * Returns false if session is expired.
 *
 * @param req - Fastify request
 * @param reply - Fastify reply
 * @param sess - Current session payload
 * @param surface - Surface to bind new CSRF token to (if rotating)
 */
export function maybeRotateSession(
  req: FastifyRequest,
  reply: FastifyReply,
  sess: SessionPayload,
  surface: Surface = "PLATFORM"
): boolean {
  const { rotateAt, ms } = sessionLifetimes();
  const now = Date.now();

  if (now >= sess.exp) return false; // expired

  // Rotate if within rotateAt window
  if (sess.exp - now < rotateAt) {
    const refreshed: SessionPayload = { ...sess, iat: now, exp: now + ms };
    const encoded = Buffer.from(JSON.stringify(refreshed)).toString("base64url");
    reply.setCookie(COOKIE_NAME, encoded, cookieOptions());

    // Also refresh the surface-bound CSRF token
    const csrfToken = generateCsrfToken(surface);
    reply.setCookie("XSRF-TOKEN", csrfToken, {
      ...cookieOptions(),
      httpOnly: false,
      signed: false,
    });
  }

  return true;
}

/**
 * Get actor user ID from verified session.
 * Returns null if session is invalid or expired.
 */
export function getActorId(req: FastifyRequest): string | null {
  const sess = parseVerifiedSession(req);
  return sess?.userId ?? null;
}
