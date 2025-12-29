/**
 * Payment Service
 *
 * Handles payment creation and invoice balance recalculation.
 * Ensures invoice status is updated correctly based on payments.
 *
 * Status transitions:
 * - Paid: balance == 0
 * - Partially Paid: 0 < balance < amountCents
 * - Issued: balance == amountCents (no payments yet or initial state)
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Recalculate invoice balance and update status based on payments.
 * Must be called within a transaction after payment changes.
 *
 * @param prisma - Prisma client instance (transaction client)
 * @param invoiceId - The invoice ID to recalculate
 */
export async function recalculateInvoiceBalance(
  prisma: PrismaClient | any,
  invoiceId: number
): Promise<void> {
  // Get invoice with all successful payments
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      Payments: {
        where: {
          status: "succeeded",
        },
      },
    },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  // Sum all successful payments
  const totalPaid = invoice.Payments.reduce(
    (sum: number, payment: any) => sum + payment.amountCents,
    0
  );

  // Calculate balance (never negative)
  const balance = Math.max(0, invoice.amountCents - totalPaid);

  // Determine status
  let status: "paid" | "partially_paid" | "issued" | "draft" = invoice.status;

  // Only auto-update status if invoice is in a payable state
  if (["draft", "issued", "partially_paid", "paid"].includes(invoice.status)) {
    if (balance === 0) {
      status = "paid";
    } else if (balance < invoice.amountCents) {
      status = "partially_paid";
    } else {
      status = "issued";
    }
  }

  // Update invoice
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      balanceCents: balance,
      status,
      paidAt: status === "paid" ? new Date() : invoice.paidAt,
    },
  });
}

/**
 * Create a payment and recalculate invoice balance/status.
 * This should be called within a transaction for consistency.
 *
 * @param prisma - Prisma client instance (transaction client)
 * @param data - Payment creation data
 * @returns The created payment
 */
export async function createPaymentAndRecalculate(
  prisma: PrismaClient | any,
  data: {
    tenantId: number;
    invoiceId: number;
    amountCents: number;
    receivedAt: Date;
    methodType?: string;
    processor?: string;
    processorRef?: string;
    status?: "pending" | "succeeded" | "failed" | "refunded" | "disputed" | "cancelled";
    notes?: string;
    data?: any;
  }
): Promise<any> {
  // Create the payment
  const payment = await prisma.payment.create({
    data: {
      tenantId: data.tenantId,
      invoiceId: data.invoiceId,
      amountCents: data.amountCents,
      receivedAt: data.receivedAt,
      methodType: data.methodType,
      processor: data.processor,
      processorRef: data.processorRef,
      status: data.status || "succeeded",
      notes: data.notes,
      data: data.data,
    },
  });

  // Recalculate invoice balance and status
  await recalculateInvoiceBalance(prisma, data.invoiceId);

  return payment;
}
