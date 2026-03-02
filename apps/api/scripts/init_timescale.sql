-- TimescaleDB schema for risk time-series (temporal replay, H3 timeline, risk-at-time).
-- Run against the TimescaleDB instance (e.g. psql $TIMESCALE_URL -f init_timescale.sql).
-- Requires: CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Risk snapshots: one row per (time, h3_cell) for time-range queries and replay.
CREATE TABLE IF NOT EXISTS risk_snapshots (
    time TIMESTAMPTZ NOT NULL,
    h3_cell TEXT NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'medium',
    p_agi DOUBLE PRECISION NOT NULL DEFAULT 0,
    p_bio DOUBLE PRECISION NOT NULL DEFAULT 0,
    p_nuclear DOUBLE PRECISION NOT NULL DEFAULT 0,
    p_climate DOUBLE PRECISION NOT NULL DEFAULT 0,
    p_financial DOUBLE PRECISION NOT NULL DEFAULT 0,
    p_total DOUBLE PRECISION NOT NULL DEFAULT 0,
    source_module TEXT NOT NULL DEFAULT '',
    event_id TEXT
);

-- Convert to hypertable (partition by time) for efficient time-range scans.
SELECT create_hypertable('risk_snapshots', 'time', if_not_exists => TRUE);

-- Index for lookups by cell and time.
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_h3_time ON risk_snapshots (h3_cell, time DESC);

-- Optional: retention policy (e.g. drop data older than 2 years).
-- SELECT add_retention_policy('risk_snapshots', INTERVAL '2 years', if_not_exists => TRUE);
