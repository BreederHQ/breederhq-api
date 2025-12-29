// scripts/backfill-invoice-categories.ts
// Idempotent script to backfill Invoice.category for existing invoices based on legacy heuristic
// Run with: npx tsx scripts/backfill-invoice-categories.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfillInvoiceCategories() {
  console.log("Starting invoice category backfill...");

  try {
    // Get all invoices without a category set (or with default OTHER)
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { category: "OTHER" },
          { category: null as any }, // In case schema allows null
        ],
      },
      include: {
        LineItems: {
          select: {
            kind: true,
          },
        },
      },
    });

    console.log(`Found ${invoices.length} invoices to potentially update`);

    let updated = 0;
    let skipped = 0;

    for (const invoice of invoices) {
      let newCategory: string | null = null;

      // Legacy heuristic: if there are line items, use them to determine category
      if (invoice.LineItems && invoice.LineItems.length > 0) {
        const hasDeposit = invoice.LineItems.some(item => item.kind === "DEPOSIT");
        const hasService = invoice.LineItems.some(item => item.kind === "SERVICE_FEE");
        const hasGoods = invoice.LineItems.some(item => item.kind === "GOODS");

        if (hasDeposit && (hasService || hasGoods)) {
          newCategory = "MIXED";
        } else if (hasDeposit) {
          newCategory = "DEPOSIT";
        } else if (hasService) {
          newCategory = "SERVICE";
        } else if (hasGoods) {
          newCategory = "GOODS";
        }
      }

      // If no line items or couldn't determine from line items, fall back to legacy serviceCode check
      if (!newCategory && invoice.data) {
        const data = invoice.data as any;
        const serviceCode = data?.serviceCode || "";
        if (typeof serviceCode === "string" && serviceCode.toLowerCase().includes("deposit")) {
          newCategory = "DEPOSIT";
        }
      }

      // Update if we determined a new category
      if (newCategory && newCategory !== invoice.category) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { category: newCategory as any },
        });
        updated++;
        console.log(`Updated invoice ${invoice.invoiceNumber} (ID: ${invoice.id}) -> ${newCategory}`);
      } else {
        skipped++;
      }
    }

    console.log(`\nBackfill complete:`);
    console.log(`- Updated: ${updated} invoices`);
    console.log(`- Skipped: ${skipped} invoices`);
  } catch (error) {
    console.error("Error during backfill:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  backfillInvoiceCategories()
    .then(() => {
      console.log("Backfill script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Backfill script failed:", error);
      process.exit(1);
    });
}

export { backfillInvoiceCategories };
