-- ── 005_momentum.sql ─────────────────────────────────────────────────────────
-- Competitor momentum tracking: current state + time series history.
-- The cron (/api/update-momentum, every 6h) writes here.
-- The sparkline UI reads momentum_history.

-- Current momentum state per (org, competitor)
CREATE TABLE IF NOT EXISTS competitor_momentum (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  competitor_id        uuid NOT NULL,
  competitor_name      text NOT NULL,
  momentum_score       numeric(8,3) NOT NULL DEFAULT 0,
  momentum_state       text NOT NULL DEFAULT 'cooling',  -- cooling | stable | rising | accelerating
  previous_state       text,
  threshold_crossed_at timestamptz,                      -- when last acceleration threshold crossed
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, competitor_id)
);

-- Time-series snapshots for sparkline (written every 6h per competitor per org)
CREATE TABLE IF NOT EXISTS momentum_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  competitor_id   uuid NOT NULL,
  momentum_score  numeric(8,3) NOT NULL DEFAULT 0,
  momentum_state  text NOT NULL DEFAULT 'cooling',
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS momentum_history_lookup
  ON momentum_history (org_id, competitor_id, recorded_at DESC);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE competitor_momentum ENABLE ROW LEVEL SECURITY;
ALTER TABLE momentum_history    ENABLE ROW LEVEL SECURITY;

-- Users can read momentum data for their own org
CREATE POLICY "Users read own org competitor_momentum"
  ON competitor_momentum FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users read own org momentum_history"
  ON momentum_history FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Service role writes (cron)
CREATE POLICY "Service role write competitor_momentum"
  ON competitor_momentum FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role write momentum_history"
  ON momentum_history FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
