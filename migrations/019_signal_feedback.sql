-- Signal quality feedback — operator verdicts per signal
-- Applied by: Supabase SQL Editor
-- Date: 2026-03-20

CREATE TABLE IF NOT EXISTS signal_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id   UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  verdict     TEXT NOT NULL CHECK (verdict IN ('useful', 'noise', 'unsure')),
  noise_category TEXT CHECK (noise_category IN (
    'cosmetic_change', 'dynamic_content', 'false_positive', 'irrelevant', 'duplicate'
  )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signal_id)
);

-- Index for batch lookups (Telescope loads feedback for N signal IDs at once)
CREATE INDEX IF NOT EXISTS idx_signal_feedback_signal_id ON signal_feedback(signal_id);

-- RLS: authenticated users can manage feedback for signals belonging to their org's competitors
ALTER TABLE signal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org signal feedback" ON signal_feedback
  FOR SELECT USING (
    signal_id IN (
      SELECT s.id FROM signals s
      JOIN competitors c ON c.id = s.competitor_id
      JOIN tracked_competitors tc ON tc.competitor_id = c.id
      JOIN organizations o ON o.id = tc.org_id
      WHERE o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own org signal feedback" ON signal_feedback
  FOR INSERT WITH CHECK (
    signal_id IN (
      SELECT s.id FROM signals s
      JOIN competitors c ON c.id = s.competitor_id
      JOIN tracked_competitors tc ON tc.competitor_id = c.id
      JOIN organizations o ON o.id = tc.org_id
      WHERE o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org signal feedback" ON signal_feedback
  FOR UPDATE USING (
    signal_id IN (
      SELECT s.id FROM signals s
      JOIN competitors c ON c.id = s.competitor_id
      JOIN tracked_competitors tc ON tc.competitor_id = c.id
      JOIN organizations o ON o.id = tc.org_id
      WHERE o.owner_id = auth.uid()
    )
  );
