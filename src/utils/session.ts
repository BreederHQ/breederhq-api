// src/utils/session.ts
// Centralized session cookie utilities with signature verification

import type { FastifyRequest, FastifyReply } from "fastify";

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
 * COOKIE_SECRET is required in production/staging.
 * In dev, it defaults to a dev-only value if not set (logged as warning).
 */
export function getCookieSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  // In development, allow a fallback (but warn)
  const isDev = NODE_ENV === "development" || NODE_ENV === "dev" || !NODE_ENV;
  if (isDev) {
    console.warn(
      "[session] WARNING: COOKIE_SECRET not set or too short. Using insecure dev default. " +
      "Set COOKIE_SECRET (min 32 chars) for production!"
    );
    return "INSECURE_DEV_SECRET_DO_NOT_USE_IN_PROD";
  }
  // Production/staging: crash if secret is missing
  throw new Error(
    "FATAL: COOKIE_SECRET environment variable is required and must be at least 32 characters. " +
    "Cannot start server without secure cookie signing."
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
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: Math.floor(ms / 1000),
    signed: true, // <-- CRITICAL: sign the cookie
  } as const;
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
 * Creates both the session cookie (HttpOnly, signed) and CSRF token (not HttpOnly).
 */
export function setSessionCookies(
  reply: FastifyReply,
  sess: Omit<SessionPayload, "iat" | "exp">
): void {
  const now = Date.now();
  const { ms } = sessionLifetimes();
  const payload: SessionPayload = { ...sess, iat: now, exp: now + ms };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  // Session cookie (HttpOnly, signed)
  reply.setCookie(COOKIE_NAME, encoded, cookieOptions());

  // CSRF token (not HttpOnly, also signed for consistency)
  const csrfToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  reply.setCookie("XSRF-TOKEN", csrfToken, {
    ...cookieOptions(),
    httpOnly: false,
    signed: false, // CSRF token doesn't need signing - it's just a random value
  });
}

/**
 * Clear all auth cookies.
 */
export function clearSessionCookies(reply: FastifyReply): void {
  const opts = cookieOptions();
  reply.setCookie(COOKIE_NAME, "", { ...opts, maxAge: 0 });
  reply.clearCookie(COOKIE_NAME, { path: "/" });
  reply.setCookie("XSRF-TOKEN", "", { ...opts, httpOnly: false, signed: false, maxAge: 0 });
  reply.clearCookie("XSRF-TOKEN", { path: "/" });
}

/**
 * Maybe rotate session if close to expiry.
 * Returns false if session is expired.
 */
export function maybeRotateSession(
  req: FastifyRequest,
  reply: FastifyReply,
  sess: SessionPayload
): boolean {
  const { rotateAt, ms } = sessionLifetimes();
  const now = Date.now();

  if (now >= sess.exp) return false; // expired

  // Rotate if within rotateAt window
  if (sess.exp - now < rotateAt) {
    const refreshed: SessionPayload = { ...sess, iat: now, exp: now + ms };
    const encoded = Buffer.from(JSON.stringify(refreshed)).toString("base64url");
    reply.setCookie(COOKIE_NAME, encoded, cookieOptions());
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
