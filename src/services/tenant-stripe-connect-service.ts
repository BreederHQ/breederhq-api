/**
 * Tenant Stripe Connect Service
 *
 * Handles Stripe Connect (Express) account management for breeder tenants.
 * Enables breeders to receive payments for invoices via their own Stripe account.
 *
 * Key Business Requirement: Breeders receive 100% of payments (minus Stripe's
 * standard processing fees). The platform does NOT take a cut on direct invoices.
 */

import Stripe from "stripe";
import prisma from "../prisma.js";

// Initialize Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

// ============================================================================
// Types
// ============================================================================

export interface TenantConnectStatus {
  connected: boolean;
  accountId: string | null;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
}

export interface TenantOnboardingResult {
  accountLinkUrl: string;
  accountId: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create a Stripe Connect Express account for a tenant (breeder)
 *
 * @param tenantId - The tenant ID
 * @returns The Stripe account ID
 */
export async function createTenantConnectAccount(tenantId: number): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      organizations: {
        take: 1,
        select: {
          party: {
            select: { email: true },
          },
        },
      },
    },
  });

  if (!tenant) {
    throw new Error("tenant_not_found");
  }

  // Get email from organization or tenant
  const email = (tenant.organizations[0]?.party as any)?.email || tenant.primaryEmail;

  // Create Express account
  const account = await stripe.accounts.create({
    type: "express",
    email: email || undefined,
    business_profile: {
      name: tenant.name,
    },
    metadata: {
      tenantId: String(tenantId),
      source: "breederhq_platform",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Save account ID to tenant
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeConnectAccountId: account.id,
    },
  });

  return account.id;
}

/**
 * Create an account link for Stripe Connect onboarding
 *
 * @param accountId - The Stripe account ID
 * @param returnUrl - URL to redirect to after onboarding
 * @param refreshUrl - URL to redirect to if link expires
 * @returns The account link URL
 */
export async function createTenantAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  });

  return accountLink.url;
}

/**
 * Get the status of a tenant's Stripe Connect account
 *
 * @param accountId - The Stripe account ID
 * @returns Account status details
 */
export async function getTenantAccountStatus(accountId: string): Promise<TenantConnectStatus> {
  const account = await stripe.accounts.retrieve(accountId);

  return {
    connected: true,
    accountId,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    chargesEnabled: account.charges_enabled ?? false,
  };
}

/**
 * Create a login link to the Stripe Express Dashboard
 *
 * @param accountId - The Stripe account ID
 * @returns The dashboard login URL
 */
export async function createTenantDashboardLink(accountId: string): Promise<string> {
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink.url;
}

/**
 * Handle Stripe webhook for tenant account updates
 *
 * @param event - The Stripe event
 */
export async function handleTenantAccountUpdated(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;
  const tenantId = account.metadata?.tenantId;
  const source = account.metadata?.source;

  // Only handle platform accounts (not marketplace provider accounts)
  if (source !== "breederhq_platform") {
    return;
  }

  if (!tenantId) {
    console.warn("[Tenant Stripe Connect] Account update received without tenantId in metadata");
    return;
  }

  const tenantIdNum = Number(tenantId);
  if (isNaN(tenantIdNum)) {
    console.warn("[Tenant Stripe Connect] Invalid tenantId in metadata:", tenantId);
    return;
  }

  const payoutsEnabled = account.payouts_enabled ?? false;

  await prisma.tenant.update({
    where: { id: tenantIdNum },
    data: {
      stripeConnectPayoutsEnabled: payoutsEnabled,
      stripeConnectOnboardingComplete: account.details_submitted ?? false,
      // Auto-switch to stripe payment mode when onboarding is complete
      marketplacePaymentMode: payoutsEnabled ? "stripe" : "manual",
      // Auto-set invoicing mode to stripe when payouts become enabled
      ...(payoutsEnabled ? { invoicingMode: "stripe" } : {}),
    },
  });

  console.log("[Tenant Stripe Connect] Account updated for tenant:", tenantIdNum, {
    payoutsEnabled,
    detailsSubmitted: account.details_submitted,
  });
}

// ============================================================================
// OAuth Flow (for existing Stripe accounts)
// ============================================================================

/**
 * Generate OAuth URL for connecting an existing Stripe account
 *
 * @param tenantId - The tenant ID
 * @param redirectUri - OAuth callback URL
 * @returns The OAuth authorization URL
 */
export function generateOAuthUrl(tenantId: number, redirectUri: string): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;

  if (!clientId) {
    throw new Error("STRIPE_CONNECT_CLIENT_ID environment variable is required for OAuth");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
    state: String(tenantId), // We'll verify this on callback
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

/**
 * Handle OAuth callback - exchange code for connected account ID
 *
 * @param code - OAuth authorization code
 * @param tenantId - The tenant ID (from state parameter)
 * @returns The connected account ID
 */
export async function handleOAuthCallback(code: string, tenantId: number): Promise<string> {
  const response = await stripe.oauth.token({
    grant_type: "authorization_code",
    code,
  });

  const connectedAccountId = response.stripe_user_id;

  if (!connectedAccountId) {
    throw new Error("oauth_failed");
  }

  // Get account status
  const account = await stripe.accounts.retrieve(connectedAccountId);

  // Save to tenant
  const payoutsEnabled = account.payouts_enabled ?? false;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeConnectAccountId: connectedAccountId,
      stripeConnectPayoutsEnabled: payoutsEnabled,
      stripeConnectOnboardingComplete: account.details_submitted ?? false,
      marketplacePaymentMode: payoutsEnabled ? "stripe" : "manual",
      // Auto-set invoicing mode to stripe when payouts are enabled
      ...(payoutsEnabled ? { invoicingMode: "stripe" } : {}),
    },
  });

  console.log("[Tenant Stripe Connect] OAuth completed for tenant:", tenantId, {
    accountId: connectedAccountId,
    payoutsEnabled,
  });

  return connectedAccountId;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a tenant has Stripe Connect configured and enabled
 *
 * @param tenantId - The tenant ID
 * @returns Whether the tenant can accept Stripe payments
 */
export async function canTenantAcceptStripePayments(tenantId: number): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stripeConnectAccountId: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectOnboardingComplete: true,
    },
  });

  if (!tenant) {
    return false;
  }

  return !!(
    tenant.stripeConnectAccountId &&
    tenant.stripeConnectPayoutsEnabled &&
    tenant.stripeConnectOnboardingComplete
  );
}

/**
 * Get tenant's Stripe Connect account ID if configured
 *
 * @param tenantId - The tenant ID
 * @returns The Stripe account ID or null
 */
export async function getTenantStripeAccountId(tenantId: number): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeConnectAccountId: true },
  });

  return tenant?.stripeConnectAccountId ?? null;
}
