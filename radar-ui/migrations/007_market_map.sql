-- ── 007_market_map.sql ───────────────────────────────────────────────────────
-- Market map: current competitor positioning + movement history.
-- Written by the daily cron (/api/update-positioning, 9:00 UTC).
-- Read by the /app/market-map page.

-- Current positioning per (org, competitor)
CREATE TABLE IF NOT EXISTS competitor_positioning (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  competitor_id           uuid NOT NULL,
  competitor_name         text NOT NULL,

  -- Two-axis positioning (0-100 each)
  market_focus_score      numeric(5,2) NOT NULL DEFAULT 50,
    -- 0 = single-workflow niche specialist
    -- 100 = broad horizontal platform
  customer_segment_score  numeric(5,2) NOT NULL DEFAULT 50,
    -- 0 = individual / tiny teams
    -- 100 = enterprise / Fortune 500

  confidence              numeric(4,3) NOT NULL DEFAULT 0,
  rationale               text,       -- AI-generated explanation grounded in signals

  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, competitor_id)
);

-- Time-series positioning snapshots for movement trails
CREATE TABLE IF NOT EXISTS positioning_history (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  competitor_id           uuid NOT NULL,
  competitor_name         text NOT NULL,
  market_focus_score      numeric(5,2) NOT NULL,
  customer_segment_score  numeric(5,2) NOT NULL,
  recorded_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS positioning_history_lookup
  ON positioning_history (org_id, competitor_id, recorded_at DESC);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE competitor_positioning ENABLE ROW LEVEL SECURITY;
ALTER TABLE positioning_history    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own org competitor_positioning"
  ON competitor_positioning FOR SELECT
  USING (org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

CREATE POLICY "Users read own org positioning_history"
  ON positioning_history FOR SELECT
  USING (org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

CREATE POLICY "Service role write competitor_positioning"
  ON competitor_positioning FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role write positioning_history"
  ON positioning_history FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
