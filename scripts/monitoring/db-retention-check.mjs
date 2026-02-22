#!/usr/bin/env node

/**
 * scripts/monitoring/db-retention-check.mjs
 *
 * Analyzes tables for data retention opportunities — identifies rows that
 * could be archived or purged based on age, helping control storage costs.
 *
 * This is a READ-ONLY diagnostic. It does NOT delete anything.
 *
 * Usage:
 *   npm run db:dev:retention        (runs against dev-prototype)
 *   npm run db:prod:retention       (runs against prod-prototype)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Retention Policy Definitions ─────────────────────────────────────────

const RETENTION_POLICIES = [
  {
    label: "Audit Logs",
    table: '"AuditLog"',
    column: '"createdAt"',
    thresholds: [
      { age: "90 days", label: "> 90 days" },
      { age: "180 days", label: "> 6 months" },
      { age: "365 days", label: "> 1 year" },
    ],
  },
  {
    label: "Notifications",
    table: '"Notification"',
    column: '"createdAt"',
    thresholds: [
      { age: "30 days", label: "> 30 days (read)", condition: 'AND "read" = true' },
      { age: "90 days", label: "> 90 days (all)" },
      { age: "180 days", label: "> 6 months" },
    ],
  },
  {
    label: "Activity Logs",
    table: '"ActivityLog"',
    column: '"createdAt"',
    thresholds: [
      { age: "90 days", label: "> 90 days" },
      { age: "180 days", label: "> 6 months" },
      { age: "365 days", label: "> 1 year" },
    ],
  },
  {
    label: "Party Activity",
    table: '"PartyActivity"',
    column: '"createdAt"',
    thresholds: [
      { age: "180 days", label: "> 6 months" },
      { age: "365 days", label: "> 1 year" },
    ],
  },
  {
    label: "Email Logs",
    table: '"EmailLog"',
    column: '"createdAt"',
    thresholds: [
      { age: "30 days", label: "> 30 days" },
      { age: "90 days", label: "> 90 days" },
      { age: "180 days", label: "> 6 months" },
    ],
  },
  {
    label: "Webhook Events",
    table: '"WebhookEvent"',
    column: '"createdAt"',
    thresholds: [
      { age: "30 days", label: "> 30 days" },
      { age: "90 days", label: "> 90 days" },
    ],
  },
  {
    label: "Monitoring Snapshots",
    table: "_monitoring.table_stats",
    column: "captured_at",
    thresholds: [
      { age: "90 days", label: "> 90 days" },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function n(val) {
  return Number(val ?? 0);
}

function fmt(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function divider(title) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(70)}`);
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  let totalReclaimable = 0;

  try {
    divider("DATA RETENTION ANALYSIS (read-only - no data is deleted)");
    console.log();

    for (const policy of RETENTION_POLICIES) {
      try {
        // Check table exists and get row count
        const countResult = await prisma.$queryRawUnsafe(
          `SELECT count(*) AS total FROM ${policy.table}`
        );
        const totalRows = n(countResult[0].total);

        if (totalRows === 0) continue;

        // Get table size
        let tableBytes = 0;
        try {
          // Strip quotes for pg_total_relation_size
          const cleanName = policy.table.replace(/"/g, "");
          const sizeResult = await prisma.$queryRawUnsafe(
            `SELECT pg_total_relation_size('"${cleanName}"') AS bytes`
          );
          tableBytes = n(sizeResult[0].bytes);
        } catch {
          // Schema-qualified tables need different approach
          try {
            const sizeResult = await prisma.$queryRawUnsafe(
              `SELECT pg_total_relation_size('${policy.table}') AS bytes`
            );
            tableBytes = n(sizeResult[0].bytes);
          } catch {
            tableBytes = 0;
          }
        }

        console.log(`  ${policy.label} (${policy.table})`);
        console.log(`     Total rows: ${totalRows.toLocaleString()}  |  Size: ${tableBytes > 0 ? fmt(tableBytes) : "unknown"}`);

        for (const threshold of policy.thresholds) {
          const condition = threshold.condition || "";
          const query = `
            SELECT count(*) AS cnt
            FROM ${policy.table}
            WHERE ${policy.column} < NOW() - INTERVAL '${threshold.age}'
            ${condition}
          `;

          try {
            const result = await prisma.$queryRawUnsafe(query);
            const count = n(result[0].cnt);
            const pct = totalRows > 0 ? ((count / totalRows) * 100).toFixed(1) : "0.0";

            const estimatedBytes = tableBytes > 0
              ? Math.round((count / totalRows) * tableBytes)
              : 0;

            if (count > 0) totalReclaimable += estimatedBytes;

            const indicator = count > totalRows * 0.5 ? "[HIGH]" :
                              count > totalRows * 0.2 ? "[MED] " : "[LOW] ";

            console.log(
              `     ${indicator} ${threshold.label}: ${count.toLocaleString()} rows (${pct}%)` +
              (estimatedBytes > 0 ? ` ~ ${fmt(estimatedBytes)}` : "")
            );
          } catch {
            console.log(`     [SKIP] ${threshold.label}: query failed (column may not exist)`);
          }
        }
        console.log();
      } catch {
        // Table doesn't exist, skip
        continue;
      }
    }

    // ── Orphaned Data Detection ──────────────────────────────────────────
    divider("ORPHANED DATA CHECK");
    console.log();

    const orphanChecks = [
      {
        label: "Documents without tenant",
        query: `SELECT count(*) AS cnt FROM "Document" WHERE "tenantId" IS NULL`,
      },
      {
        label: "Tag assignments without tag",
        query: `SELECT count(*) AS cnt FROM "TagAssignment" ta
                LEFT JOIN "Tag" t ON ta."tagId" = t.id
                WHERE t.id IS NULL`,
      },
      {
        label: "Media without animal",
        query: `SELECT count(*) AS cnt FROM "Media" m
                LEFT JOIN "Animal" a ON m."animalId" = a.id
                WHERE m."animalId" IS NOT NULL AND a.id IS NULL`,
      },
    ];

    for (const check of orphanChecks) {
      try {
        const result = await prisma.$queryRawUnsafe(check.query);
        const count = n(result[0].cnt);
        const indicator = count > 0 ? "[!]" : "[OK]";
        console.log(`  ${indicator} ${check.label}: ${count.toLocaleString()}`);
      } catch {
        console.log(`  [??] ${check.label}: check failed (table structure may differ)`);
      }
    }

    // ── Summary ──────────────────────────────────────────────────────────
    divider("RETENTION SUMMARY");
    console.log(`  Estimated reclaimable storage: ${fmt(totalReclaimable)}`);
    console.log();
    console.log("  Next steps:");
    console.log("     1. Review the thresholds above and decide on retention policies");
    console.log("     2. Create a migration with DELETE statements for approved cleanups");
    console.log("     3. For large tables, delete in batches (10k-50k rows per transaction)");
    console.log("     4. Run VACUUM ANALYZE after cleanup to reclaim disk space");
    console.log();
    console.log("  This report is READ-ONLY. No data was modified.\n");

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error("Retention check failed:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
