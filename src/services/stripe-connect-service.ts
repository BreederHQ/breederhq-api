/**
 * Stripe Connect Service
 *
 * Handles Stripe Connect (Express) account management for marketplace providers.
 * Enables providers to receive automated payouts for platform transactions.
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

/**
 * Create a Stripe Connect Express account for a provider
 *
 * @param providerId - The marketplace provider ID
 * @returns The Stripe account ID
 */
export async function createConnectAccount(providerId: number): Promise<string> {
  const provider = await prisma.marketplaceProvider.findUnique({
    where: { id: providerId },
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  // Create Express account
  const account = await stripe.accounts.create({
    type: "express",
    email: provider.publicEmail || provider.user?.email || undefined,
    business_profile: {
      name: provider.businessName,
    },
    metadata: {
      providerId: String(providerId),
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Save account ID to provider
  await prisma.marketplaceProvider.update({
    where: { id: providerId },
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
export async function createAccountLink(
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
 * Get the status of a Stripe Connect account
 *
 * @param accountId - The Stripe account ID
 * @returns Account status details
 */
export async function getAccountStatus(accountId: string): Promise<{
  connected: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
}> {
  const account = await stripe.accounts.retrieve(accountId);

  return {
    connected: true,
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
export async function createDashboardLink(accountId: string): Promise<string> {
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink.url;
}

/**
 * Handle Stripe webhook for account updates
 *
 * @param event - The Stripe event
 */
export async function handleAccountUpdated(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;
  const providerId = account.metadata?.providerId;

  if (!providerId) {
    console.warn("[Stripe Connect] Account update received without providerId in metadata");
    return;
  }

  const providerIdNum = Number(providerId);
  if (isNaN(providerIdNum)) {
    console.warn("[Stripe Connect] Invalid providerId in metadata:", providerId);
    return;
  }

  await prisma.marketplaceProvider.update({
    where: { id: providerIdNum },
    data: {
      stripeConnectPayoutsEnabled: account.payouts_enabled ?? false,
      stripeConnectDetailsSubmitted: account.details_submitted ?? false,
      stripeConnectOnboardingComplete: account.details_submitted ?? false,
      // Auto-switch to stripe payment mode when onboarding is complete
      paymentMode: account.payouts_enabled ? "stripe" : "manual",
    },
  });

  console.log("[Stripe Connect] Account updated for provider:", providerIdNum, {
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
}

/**
 * Create a payment intent for a transaction (platform payment)
 *
 * @param transactionId - The marketplace transaction ID
 * @param connectedAccountId - The provider's Stripe account ID
 * @returns The payment intent
 */
export async function createTransactionPaymentIntent(
  transactionId: number,
  connectedAccountId: string
): Promise<Stripe.PaymentIntent> {
  const transaction = await prisma.marketplaceTransaction.findUnique({
    where: { id: transactionId },
    include: {
      client: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  // Calculate platform fee (already stored on transaction)
  const applicationFeeAmount = Number(transaction.platformFeeCents);
  const totalAmount = Number(transaction.totalCents);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount,
    currency: "usd",
    application_fee_amount: applicationFeeAmount,
    transfer_data: {
      destination: connectedAccountId,
    },
    metadata: {
      transactionId: String(transactionId),
      providerId: String(transaction.providerId),
      clientId: String(transaction.clientId),
    },
  });

  return paymentIntent;
}
