-- =============================================================================
-- Migration: 066_confidence_calibration.sql
-- Purpose:   Self-calibrating confidence weights learned from signal_feedback.
--
-- Weekly cron analyzes signal_feedback verdicts per section_type, computes
-- accuracy rates, and writes weight adjustments. detect-signals reads these
-- adjustments and applies them on top of base SECTION_WEIGHTS.
--
-- Safe: CREATE TABLE IF NOT EXISTS. Apply via Supabase SQL editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS confidence_calibration (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  section_type    TEXT        NOT NULL,
  -- Computed from signal_feedback
  sample_count    INTEGER     NOT NULL,
  valid_count     INTEGER     NOT NULL,
  noise_count     INTEGER     NOT NULL,
  accuracy_rate   NUMERIC     NOT NULL,  -- valid / (valid + noise), 0.0–1.0
  -- Weight adjustment: applied as multiplier to base SECTION_WEIGHTS
  -- e.g., 0.85 means reduce base weight by 15%
  weight_multiplier NUMERIC  NOT NULL DEFAULT 1.0,
  PRIMARY KEY (id),
  CONSTRAINT confidence_calibration_section_unique UNIQUE (section_type)
);
