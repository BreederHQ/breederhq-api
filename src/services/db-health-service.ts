// src/services/db-health-service.ts
/**
 * Database Health Monitoring Service
 *
 * Provides structured health check data from PostgreSQL system views.
 * Used by:
 *   - Admin API route (GET /api/v1/admin/db-health)
 *   - Daily cron job (db-health-monitor.ts) for email alerts
 */

import prisma from "../prisma.js";

// ============================================================================
// Types
// ============================================================================

export interface TableSizeRow {
  schema: string;
  table: string;
  rowCount: number;
  totalBytes: number;
  dataBytes: number;
  indexBytes: number;
  totalSize: string; // human-readable
}

export interface InsertActivityRow {
  schema: string;
  table: string;
  rowCount: number;
  inserts: number;
  updates: number;
  deletes: number;
  insertRatio: number;
}

export interface MissingIndexRow {
  schema: string;
  table: string;
  rowCount: number;
  seqScans: number;
  idxScans: number;
  seqPct: number;
  totalSize: string;
}

export interface BloatRow {
  schema: string;
  table: string;
  liveTuples: number;
  deadTuples: number;
  deadPct: number;
  lastVacuum: string | null;
}

export interface IndexRow {
  table: string;
  indexName: string;
  indexBytes: number;
  indexSize: string;
  scans: number;
}

export interface ConnectionInfo {
  total: number;
  active: number;
  idle: number;
  idleInTransaction: number;
  longestConnectionSec: number;
}

export type AlertSeverity = "warning" | "critical";
export type AlertType =
  | "high_insert_ratio"
  | "missing_index"
  | "table_bloat"
  | "unused_index"
  | "idle_in_transaction";

export interface Alert {
  severity: AlertSeverity;
  table: string;
  type: AlertType;
  message: string;
  value: number;
  threshold: number;
}

export interface DbHealthReport {
  capturedAt: string;
  totalSizeBytes: number;
  totalSizeHuman: string;
  tableCount: number;
  tableSizes: TableSizeRow[];
  insertActivity: InsertActivityRow[];
  missingIndexes: MissingIndexRow[];
  tableBloat: BloatRow[];
  largestIndexes: IndexRow[];
  connections: ConnectionInfo;
  alerts: Alert[];
}

export interface GrowthRow {
  schema: string;
  table: string;
  capturedAt: string;
  rowCount: number;
  totalBytes: number;
  totalSize: string;
  rowGrowth: number;
  sizeGrowth: string;
  newInserts: number;
}

// ============================================================================
// Thresholds (configurable via env)
// ============================================================================

const THRESHOLDS = {
  insertRatioWarning: Number(process.env.DB_HEALTH_INSERT_RATIO_WARN ?? 5),
  insertRatioCritical: Number(process.env.DB_HEALTH_INSERT_RATIO_CRIT ?? 20),
  insertRatioMinRows: Number(process.env.DB_HEALTH_INSERT_RATIO_MIN_ROWS ?? 100),
  seqScanPctWarning: Number(process.env.DB_HEALTH_SEQ_SCAN_WARN ?? 80),
  seqScanMinRows: Number(process.env.DB_HEALTH_SEQ_SCAN_MIN_ROWS ?? 1000),
  deadTuplePctWarning: Number(process.env.DB_HEALTH_DEAD_TUPLE_WARN ?? 20),
  deadTuplePctCritical: Number(process.env.DB_HEALTH_DEAD_TUPLE_CRIT ?? 50),
  unusedIndexMinBytes: 1024 * 1024, // 1 MB
  idleInTxWarning: 3,
};

// ============================================================================
// Helpers
// ============================================================================

function n(val: unknown): number {
  if (typeof val === "bigint") return Number(val);
  return Number(val ?? 0);
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ============================================================================
// Core report
// ============================================================================

export async function captureHealthReport(): Promise<DbHealthReport> {
  const alerts: Alert[] = [];

  // 1. Table sizes
  const sizeRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      schemaname AS schema,
      relname AS table,
      n_live_tup AS row_count,
      pg_total_relation_size(relid) AS total_bytes,
      pg_relation_size(relid) AS data_bytes,
      pg_indexes_size(relid) AS index_bytes,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'marketplace')
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 30
  `);

  const tableSizes: TableSizeRow[] = sizeRows.map((r) => ({
    schema: r.schema,
    table: r.table,
    rowCount: n(r.row_count),
    totalBytes: n(r.total_bytes),
    dataBytes: n(r.data_bytes),
    indexBytes: n(r.index_bytes),
    totalSize: r.total_size,
  }));

  const totalSizeBytes = tableSizes.reduce((s, r) => s + r.totalBytes, 0);

  // 2. Insert activity
  const insertRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      schemaname AS schema,
      relname AS table,
      n_live_tup AS row_count,
      n_tup_ins AS inserts,
      n_tup_upd AS updates,
      n_tup_del AS deletes,
      CASE WHEN n_live_tup > 0
        THEN round(n_tup_ins::numeric / n_live_tup, 2)
        ELSE 0
      END AS insert_ratio
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'marketplace') AND n_tup_ins > 0
    ORDER BY n_tup_ins DESC
    LIMIT 25
  `);

  const insertActivity: InsertActivityRow[] = insertRows.map((r) => ({
    schema: r.schema,
    table: r.table,
    rowCount: n(r.row_count),
    inserts: n(r.inserts),
    updates: n(r.updates),
    deletes: n(r.deletes),
    insertRatio: Number(r.insert_ratio),
  }));

  // Check insert thresholds
  for (const row of insertActivity) {
    if (row.rowCount < THRESHOLDS.insertRatioMinRows) continue;
    if (row.insertRatio >= THRESHOLDS.insertRatioCritical) {
      alerts.push({
        severity: "critical",
        table: `${row.schema}.${row.table}`,
        type: "high_insert_ratio",
        message: `Insert ratio ${row.insertRatio}x (${row.inserts.toLocaleString()} inserts for ${row.rowCount.toLocaleString()} live rows) — possible runaway inserts or missing upsert`,
        value: row.insertRatio,
        threshold: THRESHOLDS.insertRatioCritical,
      });
    } else if (row.insertRatio >= THRESHOLDS.insertRatioWarning) {
      alerts.push({
        severity: "warning",
        table: `${row.schema}.${row.table}`,
        type: "high_insert_ratio",
        message: `Insert ratio ${row.insertRatio}x — elevated churn (${row.inserts.toLocaleString()} inserts, ${row.rowCount.toLocaleString()} live)`,
        value: row.insertRatio,
        threshold: THRESHOLDS.insertRatioWarning,
      });
    }
  }

  // 3. Missing indexes
  const idxRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      schemaname AS schema,
      relname AS table,
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

  const missingIndexes: MissingIndexRow[] = idxRows.map((r) => ({
    schema: r.schema,
    table: r.table,
    rowCount: n(r.row_count),
    seqScans: n(r.seq_scan),
    idxScans: n(r.idx_scan),
    seqPct: Number(r.seq_pct),
    totalSize: r.total_size,
  }));

  for (const row of missingIndexes) {
    if (row.rowCount >= THRESHOLDS.seqScanMinRows && row.seqPct >= THRESHOLDS.seqScanPctWarning) {
      alerts.push({
        severity: "warning",
        table: `${row.schema}.${row.table}`,
        type: "missing_index",
        message: `${row.seqPct}% sequential scans on ${row.rowCount.toLocaleString()} rows — likely needs an index`,
        value: row.seqPct,
        threshold: THRESHOLDS.seqScanPctWarning,
      });
    }
  }

  // 4. Dead tuple bloat
  const bloatRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      schemaname AS schema,
      relname AS table,
      n_live_tup AS live,
      n_dead_tup AS dead,
      CASE WHEN n_live_tup > 0
        THEN round(n_dead_tup::numeric / n_live_tup * 100, 1)
        ELSE 0
      END AS dead_pct,
      last_autovacuum
    FROM pg_stat_user_tables
    WHERE schemaname IN ('public', 'marketplace') AND n_dead_tup > 100
    ORDER BY dead_pct DESC
    LIMIT 15
  `);

  const tableBloat: BloatRow[] = bloatRows.map((r) => ({
    schema: r.schema,
    table: r.table,
    liveTuples: n(r.live),
    deadTuples: n(r.dead),
    deadPct: Number(r.dead_pct),
    lastVacuum: r.last_autovacuum
      ? new Date(r.last_autovacuum).toISOString()
      : null,
  }));

  for (const row of tableBloat) {
    const pct = row.deadPct;
    if (pct >= THRESHOLDS.deadTuplePctCritical) {
      alerts.push({
        severity: "critical",
        table: `${row.schema}.${row.table}`,
        type: "table_bloat",
        message: `${pct}% dead tuples (${row.deadTuples.toLocaleString()} dead / ${row.liveTuples.toLocaleString()} live) — needs VACUUM ANALYZE`,
        value: pct,
        threshold: THRESHOLDS.deadTuplePctCritical,
      });
    } else if (pct >= THRESHOLDS.deadTuplePctWarning) {
      alerts.push({
        severity: "warning",
        table: `${row.schema}.${row.table}`,
        type: "table_bloat",
        message: `${pct}% dead tuples — update-heavy table, monitor vacuum schedule`,
        value: pct,
        threshold: THRESHOLDS.deadTuplePctWarning,
      });
    }
  }

  // 5. Largest indexes
  const indexQueryRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      relname AS table,
      indexrelname AS index_name,
      idx_scan AS scans,
      pg_relation_size(indexrelid) AS index_bytes,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
    FROM pg_stat_user_indexes
    WHERE schemaname IN ('public', 'marketplace')
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 15
  `);

  const largestIndexes: IndexRow[] = indexQueryRows.map((r) => ({
    table: r.table,
    indexName: r.index_name,
    indexBytes: n(r.index_bytes),
    indexSize: r.index_size,
    scans: n(r.scans),
  }));

  for (const row of largestIndexes) {
    if (row.scans === 0 && row.indexBytes > THRESHOLDS.unusedIndexMinBytes) {
      alerts.push({
        severity: "warning",
        table: row.table,
        type: "unused_index",
        message: `Index "${row.indexName}" (${row.indexSize}) has 0 scans — candidate for removal`,
        value: 0,
        threshold: 1,
      });
    }
  }

  // 6. Connections
  const connRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE state = 'active') AS active,
      count(*) FILTER (WHERE state = 'idle') AS idle,
      count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
      COALESCE(max(EXTRACT(EPOCH FROM now() - backend_start))::int, 0) AS longest_conn_sec
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
  `);

  const c = connRows[0];
  const connections: ConnectionInfo = {
    total: n(c.total),
    active: n(c.active),
    idle: n(c.idle),
    idleInTransaction: n(c.idle_in_tx),
    longestConnectionSec: n(c.longest_conn_sec),
  };

  if (connections.idleInTransaction > THRESHOLDS.idleInTxWarning) {
    alerts.push({
      severity: "warning",
      table: "-",
      type: "idle_in_transaction",
      message: `${connections.idleInTransaction} idle-in-transaction connections — possible connection leak`,
      value: connections.idleInTransaction,
      threshold: THRESHOLDS.idleInTxWarning,
    });
  }

  return {
    capturedAt: new Date().toISOString(),
    totalSizeBytes,
    totalSizeHuman: fmtBytes(totalSizeBytes),
    tableCount: tableSizes.length,
    tableSizes,
    insertActivity,
    missingIndexes,
    tableBloat,
    largestIndexes,
    connections,
    alerts,
  };
}

// ============================================================================
// Monitoring snapshot (requires _monitoring schema)
// ============================================================================

export async function captureSnapshot(): Promise<number | null> {
  try {
    const exists: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = '_monitoring'
      ) AS exists
    `);

    if (!exists[0]?.exists) return null;

    const result: any[] = await prisma.$queryRawUnsafe(
      `SELECT _monitoring.capture_table_stats() AS captured`
    );
    return n(result[0]?.captured);
  } catch {
    return null;
  }
}

export async function purgeOldSnapshots(retentionDays = 90): Promise<number> {
  try {
    const result: any[] = await prisma.$queryRawUnsafe(
      `SELECT _monitoring.purge_old_stats($1) AS deleted`,
      retentionDays
    );
    return n(result[0]?.deleted);
  } catch {
    return 0;
  }
}

export async function getGrowthHistory(days = 30): Promise<GrowthRow[]> {
  try {
    const exists: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = '_monitoring'
      ) AS exists
    `);

    if (!exists[0]?.exists) return [];

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM _monitoring.v_growth_rate
      WHERE captured_at > NOW() - INTERVAL '${days} days'
      ORDER BY captured_at DESC, row_growth DESC
      LIMIT 200
    `);

    return rows.map((r) => ({
      schema: r.schema_name,
      table: r.table_name,
      capturedAt: new Date(r.captured_at).toISOString(),
      rowCount: n(r.row_count),
      totalBytes: n(r.total_bytes ?? 0),
      totalSize: r.total_size ?? fmtBytes(n(r.total_bytes ?? 0)),
      rowGrowth: n(r.row_growth),
      sizeGrowth: r.size_growth ?? "0 B",
      newInserts: n(r.new_inserts),
    }));
  } catch {
    return [];
  }
}
