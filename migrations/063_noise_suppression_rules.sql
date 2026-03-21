-- =============================================================================
-- Migration: 063_noise_suppression_rules.sql
-- Purpose:   Automated noise pattern suppression rules learned from signal_feedback.
--
-- The learn-noise-patterns weekly cron analyzes signal_feedback verdicts and
-- identifies (section_type, competitor_id, signal_type) triples that are
-- consistently marked as noise. detect-signals checks these rules before
-- creating signals, suppressing known-noisy patterns automatically.
--
-- Rules can be deactivated by setting active=false via SQL.
--
-- Safe: CREATE TABLE IF NOT EXISTS. Apply via Supabase SQL editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS noise_suppression_rules (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The pattern triple that identifies a noisy signal source
  section_type    TEXT        NOT NULL,
  competitor_id   UUID        NOT NULL,
  signal_type     TEXT        NOT NULL,
  -- Statistics from signal_feedback at rule creation/update time
  noise_rate      NUMERIC     NOT NULL,  -- 0.0–1.0, ratio of noise verdicts
  sample_count    INTEGER     NOT NULL,  -- total feedback verdicts for this pattern
  noise_count     INTEGER     NOT NULL,  -- count of "noise" verdicts
  -- Optional: most common noise_category for this pattern
  primary_noise_category TEXT,
  -- Active flag — set to false to disable without deleting
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  -- One rule per (section_type, competitor_id, signal_type)
  CONSTRAINT noise_rules_pattern_unique
    UNIQUE (section_type, competitor_id, signal_type)
);

-- Lookup by active rules (detect-signals hot path)
CREATE INDEX IF NOT EXISTS idx_noise_rules_active
  ON noise_suppression_rules (active, competitor_id, section_type, signal_type)
  WHERE active = TRUE;

-- Audit: when was each rule last refreshed
CREATE INDEX IF NOT EXISTS idx_noise_rules_updated
  ON noise_suppression_rules (updated_at DESC);
