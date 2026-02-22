#!/usr/bin/env node

/**
 * scripts/monitoring/db-health-check.mjs
 *
 * Database health diagnostic — run against dev or prod to get an instant
 * picture of table sizes, growth anomalies, missing indexes, and bloat.
 *
 * Usage:
 *   npm run db:dev:health        (runs against dev-prototype)
 *   npm run db:prod:health       (runs against prod-prototype)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────

function fmt(bytes) {
  if (!bytes || bytes === 0n) return "0 B";
  const n = Number(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function n(val) {
  // Prisma $queryRawUnsafe returns BigInt for count/sum columns
  return Number(val ?? 0);
}

function divider(title) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(70)}`);
}

function printTable(rows, columns) {
  if (rows.length === 0) {
    console.log("  (none)\n");
    return;
  }

  const widths = columns.map((col) =>
    Math.max(
      col.header.length,
      ...rows.map((r) => String(col.value(r)).length)
    )
  );

  const header = columns
    .map((col, i) => col.header.padEnd(widths[i]))
    .join("  ");
  console.log(`  ${header}`);
  console.log(`  ${widths.map((w) => "-".repeat(w)).join("  ")}`);

  for (const row of rows) {
    const line = columns
      .map((col, i) => {
        const val = String(col.value(row));
        return col.align === "right" ? val.padStart(widths[i]) : val.padEnd(widths[i]);
      })
      .join("  ");
    console.log(`  ${line}`);
  }
  console.log();
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  try {
    // ── 1. Table Sizes ───────────────────────────────────────────────────
    divider("TABLE SIZES (Top 25 by total size)");

    const sizeRows = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        relname AS table_name,
        n_live_tup AS row_count,
        pg_total_relation_size(relid) AS total_bytes,
        pg_indexes_size(relid) AS index_bytes,
        pg_relation_size(relid) AS table_bytes
      FROM pg_stat_user_tables
      WHERE schemaname IN ('public', 'marketplace')
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 25
    `);

    printTable(sizeRows, [
      { header: "Schema", value: (r) => r.schemaname },
      { header: "Table", value: (r) => r.table_name },
      { header: "Rows", value: (r) => n(r.row_count).toLocaleString(), align: "right" },
      { header: "Total", value: (r) => fmt(r.total_bytes), align: "right" },
      { header: "Data", value: (r) => fmt(r.table_bytes), align: "right" },
      { header: "Indexes", value: (r) => fmt(r.index_bytes), align: "right" },
    ]);

    const totalBytes = sizeRows.reduce((sum, r) => sum + n(r.total_bytes), 0);
    console.log(`  Total database size: ${fmt(totalBytes)}\n`);

    // ── 2. Insert Activity ───────────────────────────────────────────────
    divider("INSERT ACTIVITY (Top 20 by cumulative inserts since stats reset)");

    const insertRows = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        relname AS table_name,
        n_live_tup AS row_count,
        n_tup_ins AS inserts,
        n_tup_upd AS updates,
        n_tup_del AS deletes,
        CASE WHEN n_live_tup > 0
          THEN round(n_tup_ins::numeric / n_live_tup, 2)
          ELSE 0
        END AS insert_ratio
      FROM pg_stat_user_tables
      WHERE schemaname IN ('public', 'marketplace')
        AND n_tup_ins > 0
      ORDER BY n_tup_ins DESC
      LIMIT 20
    `);

    printTable(insertRows, [
      { header: "Table", value: (r) => `${r.schemaname}.${r.table_name}` },
      { header: "Rows", value: (r) => n(r.row_count).toLocaleString(), align: "right" },
      { header: "Inserts", value: (r) => n(r.inserts).toLocaleString(), align: "right" },
      { header: "Updates", value: (r) => n(r.updates).toLocaleString(), align: "right" },
      { header: "Deletes", value: (r) => n(r.deletes).toLocaleString(), align: "right" },
      { header: "Ins:Row", value: (r) => `${r.insert_ratio}x`, align: "right" },
    ]);

    const suspicious = insertRows.filter(
      (r) => Number(r.insert_ratio) > 5 && n(r.row_count) > 100
    );
    if (suspicious.length > 0) {
      console.log("  WARNING: HIGH INSERT RATIOS (possible runaway inserts or missing upserts):");
      for (const r of suspicious) {
        console.log(
          `     ${r.schemaname}.${r.table_name}: ${r.insert_ratio}x ` +
          `(${n(r.inserts).toLocaleString()} inserts for ${n(r.row_count).toLocaleString()} live rows)`
        );
      }
      console.log();
    }

    // ── 3. Missing Indexes ───────────────────────────────────────────────
    divider("MISSING INDEX CANDIDATES (seq scans > idx scans, 500+ rows)");

    const idxRows = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        relname AS table_name,
        seq_scan,
        idx_scan,
        CASE WHEN (seq_scan + idx_scan) > 0
          THEN round(seq_scan::numeric / (seq_scan + idx_scan) * 100, 1)
          ELSE 0
        END AS seq_pct,
        n_live_tup AS row_count,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size
      FROM pg_stat_user_tables
      WHERE schemaname IN ('public', 'marketplace')
        AND n_live_tup > 500
        AND seq_scan > idx_scan
      ORDER BY seq_pct DESC
      LIMIT 15
    `);

    printTable(idxRows, [
      { header: "Table", value: (r) => `${r.schemaname}.${r.table_name}` },
      { header: "Rows", value: (r) => n(r.row_count).toLocaleString(), align: "right" },
      { header: "Seq Scans", value: (r) => n(r.seq_scan).toLocaleString(), align: "right" },
      { header: "Idx Scans", value: (r) => n(r.idx_scan).toLocaleString(), align: "right" },
      { header: "Seq %", value: (r) => `${r.seq_pct}%`, align: "right" },
      { header: "Size", value: (r) => r.total_size, align: "right" },
    ]);

    if (idxRows.length > 0) {
      console.log(
        "  TIP: Tables with >80% sequential scans likely need indexes on commonly filtered columns.\n" +
        "       Check WHERE clauses in your queries for these tables.\n"
      );
    }

    // ── 4. Dead Tuple Bloat ──────────────────────────────────────────────
    divider("TABLE BLOAT (dead tuples - update-heavy or vacuum issues)");

    const bloatRows = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        relname AS table_name,
        n_live_tup AS live,
        n_dead_tup AS dead,
        CASE WHEN n_live_tup > 0
          THEN round(n_dead_tup::numeric / n_live_tup * 100, 1)
          ELSE 0
        END AS dead_pct,
        last_autovacuum,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname IN ('public', 'marketplace')
        AND n_dead_tup > 100
      ORDER BY dead_pct DESC
      LIMIT 15
    `);

    printTable(bloatRows, [
      { header: "Table", value: (r) => `${r.schemaname}.${r.table_name}` },
      { header: "Live", value: (r) => n(r.live).toLocaleString(), align: "right" },
      { header: "Dead", value: (r) => n(r.dead).toLocaleString(), align: "right" },
      { header: "Dead %", value: (r) => `${r.dead_pct}%`, align: "right" },
      {
        header: "Last Vacuum",
        value: (r) =>
          r.last_autovacuum
            ? new Date(r.last_autovacuum).toISOString().slice(0, 16)
            : "never",
      },
    ]);

    const bloated = bloatRows.filter((r) => Number(r.dead_pct) > 20);
    if (bloated.length > 0) {
      console.log("  WARNING: Tables with >20% dead tuples may need VACUUM ANALYZE or have update-heavy patterns.\n");
    }

    // ── 5. Largest Indexes ───────────────────────────────────────────────
    divider("LARGEST INDEXES (Top 15 - potential unused index candidates)");

    const indexRows = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        relname AS table_name,
        indexrelname AS index_name,
        idx_scan AS scans,
        pg_relation_size(indexrelid) AS index_bytes
      FROM pg_stat_user_indexes
      WHERE schemaname IN ('public', 'marketplace')
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 15
    `);

    printTable(indexRows, [
      { header: "Table", value: (r) => r.table_name },
      { header: "Index", value: (r) => r.index_name },
      { header: "Size", value: (r) => fmt(r.index_bytes), align: "right" },
      { header: "Scans", value: (r) => n(r.scans).toLocaleString(), align: "right" },
    ]);

    const unusedIndexes = indexRows.filter(
      (r) => n(r.scans) === 0 && n(r.index_bytes) > 1024 * 1024
    );
    if (unusedIndexes.length > 0) {
      console.log("  WARNING: Indexes with 0 scans and >1MB may be candidates for removal (saves storage cost).\n");
    }

    // ── 6. pg_stat_statements (if available) ─────────────────────────────
    divider("TOP QUERIES BY CALL COUNT (if pg_stat_statements enabled)");

    try {
      const stmtRows = await prisma.$queryRawUnsafe(`
        SELECT
          calls,
          round(mean_exec_time::numeric, 2) AS avg_ms,
          round(total_exec_time::numeric, 0) AS total_ms,
          rows,
          left(query, 120) AS query_preview
        FROM pg_stat_statements
        WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
        ORDER BY calls DESC
        LIMIT 15
      `);

      printTable(stmtRows, [
        { header: "Calls", value: (r) => n(r.calls).toLocaleString(), align: "right" },
        { header: "Avg ms", value: (r) => r.avg_ms, align: "right" },
        { header: "Total ms", value: (r) => n(r.total_ms).toLocaleString(), align: "right" },
        { header: "Rows", value: (r) => n(r.rows).toLocaleString(), align: "right" },
        { header: "Query", value: (r) => r.query_preview },
      ]);
    } catch {
      console.log("  pg_stat_statements not available (normal on some Neon plans).\n");
    }

    // ── 7. Connection Info ───────────────────────────────────────────────
    divider("CONNECTION INFO");

    const connRows = await prisma.$queryRawUnsafe(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE state = 'active') AS active,
        count(*) FILTER (WHERE state = 'idle') AS idle,
        count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
        max(EXTRACT(EPOCH FROM now() - backend_start))::int AS longest_conn_sec
      FROM pg_stat_activity
      WHERE backend_type = 'client backend'
    `);

    const conn = connRows[0];
    console.log(`  Total connections:        ${n(conn.total)}`);
    console.log(`  Active:                   ${n(conn.active)}`);
    console.log(`  Idle:                     ${n(conn.idle)}`);
    console.log(`  Idle in transaction:      ${n(conn.idle_in_tx)}`);
    console.log(`  Longest connection:       ${n(conn.longest_conn_sec)}s`);

    if (n(conn.idle_in_tx) > 3) {
      console.log("\n  WARNING: Multiple idle-in-transaction connections - possible connection leak or missing commit.");
    }

    // ── 8. Monitoring Snapshot ───────────────────────────────────────────
    divider("MONITORING SNAPSHOT");

    try {
      const hasMonitoring = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.schemata
          WHERE schema_name = '_monitoring'
        ) AS exists
      `);

      if (hasMonitoring[0].exists) {
        const snapResult = await prisma.$queryRawUnsafe(
          `SELECT _monitoring.capture_table_stats() AS captured`
        );
        console.log(`  Captured snapshot: ${n(snapResult[0].captured)} tables recorded.\n`);

        const countResult = await prisma.$queryRawUnsafe(
          `SELECT count(DISTINCT captured_at) AS snapshots FROM _monitoring.table_stats`
        );
        console.log(`  Total snapshots in history: ${n(countResult[0].snapshots)}\n`);
      } else {
        console.log(
          "  _monitoring schema not found. Run the migration to enable snapshot tracking:\n" +
          "     npm run db:dev:sync\n"
        );
      }
    } catch (e) {
      console.log(`  Could not capture snapshot: ${e.message}\n`);
    }

    // ── Summary ──────────────────────────────────────────────────────────
    divider("SUMMARY");
    console.log(`  Database size:      ${fmt(totalBytes)}`);
    console.log(`  Tables scanned:     ${sizeRows.length}`);
    console.log(`  Missing indexes:    ${idxRows.length} candidates`);
    console.log(`  Bloated tables:     ${bloated.length} with >20% dead tuples`);
    console.log(`  Unused indexes:     ${unusedIndexes.length} with 0 scans >1MB`);
    console.log(`  Suspicious inserts: ${suspicious.length} tables with >5x insert ratio`);
    console.log();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error("Health check failed:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
