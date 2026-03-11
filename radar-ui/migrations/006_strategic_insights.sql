-- ── 006_strategic_insights.sql ───────────────────────────────────────────────
-- Stores AI-generated cross-competitor strategic patterns and responses.
-- Written by the daily cron (/api/strategic-analysis).
-- Read by the /app/strategy page.

CREATE TABLE IF NOT EXISTS strategic_insights (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Pattern classification
  pattern_type         text NOT NULL,   -- feature_convergence | pricing_competition |
                                        -- category_expansion   | enterprise_shift    |
                                        -- product_bundling     | market_repositioning

  -- Content (AI-generated, grounded in real signals)
  strategic_signal     text NOT NULL,   -- headline: "3 rivals launched AI automation in 14 days"
  description          text NOT NULL,   -- 2-3 sentence context paragraph
  recommended_response text NOT NULL,   -- one concrete, specific action for the user

  -- Metadata
  confidence           numeric(4,3) NOT NULL DEFAULT 0,   -- 0.0 – 1.0
  competitor_count     int          NOT NULL DEFAULT 0,
  competitors_involved text[]       NOT NULL DEFAULT '{}',
  is_major             boolean      NOT NULL DEFAULT false, -- triggers email
  signal_window_days   int          NOT NULL DEFAULT 30,

  created_at           timestamptz  NOT NULL DEFAULT now()
);

-- Efficient lookups: latest insights per org
CREATE INDEX IF NOT EXISTS strategic_insights_org_created
  ON strategic_insights (org_id, created_at DESC);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE strategic_insights ENABLE ROW LEVEL SECURITY;

-- Users read their own org's insights
CREATE POLICY "Users read own org strategic_insights"
  ON strategic_insights FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Service role writes (cron)
CREATE POLICY "Service role write strategic_insights"
  ON strategic_insights FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
