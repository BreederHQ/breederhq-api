-- migrate:up

-- =============================================================================
-- Monitoring schema for tracking database growth, performance, and cost signals
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS _monitoring;

-- Daily snapshots of table sizes and activity counters
CREATE TABLE _monitoring.table_stats (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schema_name     TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    row_count       BIGINT NOT NULL DEFAULT 0,
    total_bytes     BIGINT NOT NULL DEFAULT 0,
    index_bytes     BIGINT NOT NULL DEFAULT 0,
    toast_bytes     BIGINT NOT NULL DEFAULT 0,
    inserts         BIGINT NOT NULL DEFAULT 0,   -- cumulative since pg_stat reset
    updates         BIGINT NOT NULL DEFAULT 0,
    deletes         BIGINT NOT NULL DEFAULT 0,
    dead_tuples     BIGINT NOT NULL DEFAULT 0,
    seq_scans       BIGINT NOT NULL DEFAULT 0,
    idx_scans       BIGINT NOT NULL DEFAULT 0
);

-- Index for time-range queries and per-table lookups
CREATE INDEX idx_table_stats_captured
    ON _monitoring.table_stats (captured_at DESC);

CREATE INDEX idx_table_stats_table_time
    ON _monitoring.table_stats (schema_name, table_name, captured_at DESC);

-- Function to capture a snapshot of all user tables
CREATE OR REPLACE FUNCTION _monitoring.capture_table_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    rows_inserted INTEGER;
BEGIN
    INSERT INTO _monitoring.table_stats (
        captured_at, schema_name, table_name,
        row_count, total_bytes, index_bytes, toast_bytes,
        inserts, updates, deletes, dead_tuples,
        seq_scans, idx_scans
    )
    SELECT
        NOW(),
        s.schemaname,
        s.relname,
        s.n_live_tup,
        pg_total_relation_size(s.relid),
        pg_indexes_size(s.relid),
        COALESCE(pg_total_relation_size(s.relid) - pg_relation_size(s.relid) - pg_indexes_size(s.relid), 0),
        s.n_tup_ins,
        s.n_tup_upd,
        s.n_tup_del,
        s.n_dead_tup,
        s.seq_scan,
        s.idx_scan
    FROM pg_stat_user_tables s
    WHERE s.schemaname IN ('public', 'marketplace');

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted;
END;
$$;

-- View: current table sizes ranked by total size
CREATE OR REPLACE VIEW _monitoring.v_table_sizes AS
SELECT
    schemaname AS schema_name,
    relname AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size,
    pg_total_relation_size(relid) AS total_bytes
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'marketplace')
ORDER BY pg_total_relation_size(relid) DESC;

-- View: tables with high sequential scan ratio (missing index candidates)
CREATE OR REPLACE VIEW _monitoring.v_missing_indexes AS
SELECT
    schemaname AS schema_name,
    relname AS table_name,
    seq_scan,
    idx_scan,
    CASE WHEN (seq_scan + idx_scan) > 0
        THEN round(seq_scan::numeric / (seq_scan + idx_scan) * 100, 1)
        ELSE 0
    END AS seq_scan_pct,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'marketplace')
  AND n_live_tup > 500
  AND seq_scan > idx_scan
ORDER BY seq_scan_pct DESC;

-- View: tables with excessive dead tuples (bloat / update-heavy)
CREATE OR REPLACE VIEW _monitoring.v_table_bloat AS
SELECT
    schemaname AS schema_name,
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    CASE WHEN n_live_tup > 0
        THEN round(n_dead_tup::numeric / n_live_tup * 100, 1)
        ELSE 0
    END AS dead_pct,
    last_autovacuum,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'marketplace')
  AND n_dead_tup > 100
ORDER BY dead_pct DESC;

-- View: daily growth rate (requires at least 2 snapshots)
CREATE OR REPLACE VIEW _monitoring.v_growth_rate AS
WITH ranked AS (
    SELECT
        schema_name,
        table_name,
        captured_at,
        row_count,
        total_bytes,
        inserts,
        LAG(row_count) OVER (PARTITION BY schema_name, table_name ORDER BY captured_at) AS prev_row_count,
        LAG(total_bytes) OVER (PARTITION BY schema_name, table_name ORDER BY captured_at) AS prev_bytes,
        LAG(inserts) OVER (PARTITION BY schema_name, table_name ORDER BY captured_at) AS prev_inserts,
        LAG(captured_at) OVER (PARTITION BY schema_name, table_name ORDER BY captured_at) AS prev_captured_at
    FROM _monitoring.table_stats
)
SELECT
    schema_name,
    table_name,
    captured_at,
    row_count,
    pg_size_pretty(total_bytes) AS total_size,
    row_count - COALESCE(prev_row_count, row_count) AS row_growth,
    pg_size_pretty(total_bytes - COALESCE(prev_bytes, total_bytes)) AS size_growth,
    inserts - COALESCE(prev_inserts, inserts) AS new_inserts,
    EXTRACT(EPOCH FROM captured_at - prev_captured_at) / 3600.0 AS hours_between
FROM ranked
WHERE prev_captured_at IS NOT NULL
ORDER BY captured_at DESC, (row_count - COALESCE(prev_row_count, row_count)) DESC;

-- Self-cleanup: auto-purge monitoring snapshots older than 90 days
-- (prevents the monitoring table itself from becoming a growth problem)
CREATE OR REPLACE FUNCTION _monitoring.purge_old_stats(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM _monitoring.table_stats
    WHERE captured_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN rows_deleted;
END;
$$;

COMMENT ON SCHEMA _monitoring IS 'Database monitoring: table growth tracking, performance diagnostics, cost signals';
COMMENT ON FUNCTION _monitoring.capture_table_stats() IS 'Capture a point-in-time snapshot of all user table sizes and activity counters';
COMMENT ON FUNCTION _monitoring.purge_old_stats(INTEGER) IS 'Remove monitoring snapshots older than N days (default 90)';

-- migrate:down

DROP SCHEMA IF EXISTS _monitoring CASCADE;
