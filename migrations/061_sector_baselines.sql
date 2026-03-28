-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 061: Sector Baselines
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Creates sector_baselines table for competitive benchmarking.
-- Stores median, p75, and p90 metrics per sector to enable "above/below sector avg"
-- indicators in the UI.
--
-- Metrics tracked:
--   - signals_per_week: average signal generation rate
--   - pressure_index: average competitor pressure
--   - hiring_velocity: average roles posted per week
--   - movement_frequency: average movements per month
--
-- Calculated by /api/calculate-sector-baselines cron (weekly).
-- Sample size tracks how many orgs contributed to the baseline.
--
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Sector baselines table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sector_baselines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector            text NOT NULL,
  metric_type       text NOT NULL,
  median_value      numeric NOT NULL DEFAULT 0,
  p75_value         numeric NOT NULL DEFAULT 0,
  p90_value         numeric NOT NULL DEFAULT 0,
  sample_size       integer NOT NULL DEFAULT 0,
  calculated_at     timestamptz NOT NULL DEFAULT NOW(),
  created_at        timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (sector, metric_type, calculated_at)
);

-- Index for fast lookups by sector + metric
CREATE INDEX IF NOT EXISTS idx_sector_baselines_lookup
  ON sector_baselines (sector, metric_type, calculated_at DESC);

-- RLS: Read-only for authenticated users
ALTER TABLE sector_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sector_baselines_read"
  ON sector_baselines
  FOR SELECT
  TO authenticated
  USING (true);

-- Comment
COMMENT ON TABLE sector_baselines IS
  'Competitive benchmarking baselines per sector. '
  'Calculated weekly by /api/calculate-sector-baselines. '
  'Enables "above/below sector avg" indicators in UI.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Verification
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- SELECT * FROM sector_baselines ORDER BY calculated_at DESC LIMIT 10;
-- Expected: Empty initially, populated after first cron run
--
-- Valid metric_type values:
--   - signals_per_week
--   - pressure_index
--   - hiring_velocity
--   - movement_frequency
