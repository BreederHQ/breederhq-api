/**
 * Marketplace Financials Service
 *
 * Provides financial summary data for marketplace providers including:
 * - Revenue totals and trends
 * - Transaction statistics
 * - Stripe Connect payout history
 */

import Stripe from "stripe";
import prisma from "../prisma.js";
import { startOfMonth, subMonths, format } from "date-fns";

// Initialize Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

let stripe: Stripe | null = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2026-01-28.clover",
    typescript: true,
  });
}

export interface RevenueByMonth {
  month: string;
  amountCents: number;
}

export interface TransactionSummary {
  total: number;
  completed: number;
  cancelled: number;
  refunded: number;
  pending: number;
}

export interface Payout {
  id: string;
  amountCents: number;
  status: string;
  createdAt: string;
  arrivalDate: string | null;
}

export interface FinancialsSummary {
  totalRevenueCents: number;
  pendingPayoutCents: number;
  lifetimePayoutCents: number;
  thisMonthRevenueCents: number;
  lastMonthRevenueCents: number;
  revenueByMonth: RevenueByMonth[];
  transactionSummary: TransactionSummary;
  recentPayouts: Payout[];
}

/**
 * Get comprehensive financial summary for a provider
 *
 * @param providerId - The marketplace provider ID
 * @returns Financial summary including revenue, transactions, and payouts
 */
export async function getProviderFinancials(
  providerId: number
): Promise<FinancialsSummary> {
  const provider = await prisma.marketplaceProvider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));

  // Get all transactions for this provider
  const transactions = await prisma.marketplaceTransaction.findMany({
    where: { providerId },
    select: {
      id: true,
      status: true,
      providerPayoutCents: true,
      completedAt: true,
      createdAt: true,
    },
  });

  // Calculate totals from completed transactions
  const completedTransactions = transactions.filter(
    (t) => t.status === "completed"
  );
  const totalRevenueCents = completedTransactions.reduce(
    (sum, t) => sum + Number(t.providerPayoutCents),
    0
  );

  // This month revenue
  const thisMonthTransactions = completedTransactions.filter(
    (t) => t.completedAt && new Date(t.completedAt) >= thisMonthStart
  );
  const thisMonthRevenueCents = thisMonthTransactions.reduce(
    (sum, t) => sum + Number(t.providerPayoutCents),
    0
  );

  // Last month revenue
  const lastMonthTransactions = completedTransactions.filter(
    (t) =>
      t.completedAt &&
      new Date(t.completedAt) >= lastMonthStart &&
      new Date(t.completedAt) < thisMonthStart
  );
  const lastMonthRevenueCents = lastMonthTransactions.reduce(
    (sum, t) => sum + Number(t.providerPayoutCents),
    0
  );

  // Revenue by month (last 6 months)
  const revenueByMonth: RevenueByMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd =
      i === 0
        ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
        : startOfMonth(subMonths(now, i - 1));
    const monthLabel = format(monthStart, "MMM yyyy");

    const monthRevenue = completedTransactions
      .filter(
        (t) =>
          t.completedAt &&
          new Date(t.completedAt) >= monthStart &&
          new Date(t.completedAt) < monthEnd
      )
      .reduce((sum, t) => sum + Number(t.providerPayoutCents), 0);

    revenueByMonth.push({ month: monthLabel, amountCents: monthRevenue });
  }

  // Transaction summary
  const transactionSummary: TransactionSummary = {
    total: transactions.length,
    completed: transactions.filter((t) => t.status === "completed").length,
    cancelled: transactions.filter((t) => t.status === "cancelled").length,
    refunded: transactions.filter((t) => t.status === "refunded").length,
    pending: transactions.filter((t) =>
      ["pending", "invoiced", "paid", "started"].includes(t.status)
    ).length,
  };

  // Get Stripe payouts if connected
  let pendingPayoutCents = 0;
  let lifetimePayoutCents = 0;
  let recentPayouts: Payout[] = [];

  if (
    stripe &&
    provider.stripeConnectAccountId &&
    provider.stripeConnectPayoutsEnabled
  ) {
    try {
      // Get balance
      const balance = await stripe.balance.retrieve({
        stripeAccount: provider.stripeConnectAccountId,
      });

      pendingPayoutCents = balance.pending.reduce(
        (sum, b) => sum + (b.currency === "usd" ? b.amount : 0),
        0
      );

      // Get recent payouts
      const payouts = await stripe.payouts.list(
        { limit: 10 },
        { stripeAccount: provider.stripeConnectAccountId }
      );

      recentPayouts = payouts.data.map((p) => ({
        id: p.id,
        amountCents: p.amount,
        status: p.status,
        createdAt: new Date(p.created * 1000).toISOString(),
        arrivalDate: p.arrival_date
          ? new Date(p.arrival_date * 1000).toISOString()
          : null,
      }));

      // Calculate lifetime payouts from successful payouts
      lifetimePayoutCents = payouts.data
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0);
    } catch (error) {
      console.error("[Financials] Error fetching Stripe data:", error);
      // Continue with zeros if Stripe fails
    }
  }

  return {
    totalRevenueCents,
    pendingPayoutCents,
    lifetimePayoutCents,
    thisMonthRevenueCents,
    lastMonthRevenueCents,
    revenueByMonth,
    transactionSummary,
    recentPayouts,
  };
}
