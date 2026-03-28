-- Migration 069: Novelty Scoring System
-- Adds novelty detection columns to signals table to distinguish first-time strategic
-- moves (high novelty) from repeated operational patterns (low novelty).
--
-- Core insight: First-time behaviors predict strategic pivots. Repeated behaviors are noise.
--
-- Applied: 2026-03-28
-- Successfully applied to Supabase production database

BEGIN;

-- Add novelty scoring columns
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS novelty_score DECIMAL(3,2) CHECK (novelty_score >= 0.0 AND novelty_score <= 1.0),
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurrence_count INTEGER DEFAULT 1 CHECK (recurrence_count >= 1);

-- Add index for novelty lookups (used in detect-signals to check prior occurrences)
CREATE INDEX IF NOT EXISTS idx_signals_novelty_lookup
  ON signals(competitor_id, signal_type, detected_at DESC)
  WHERE status IN ('pending', 'interpreted');

-- Add index for high-novelty signal queries (used in briefs, activity stream)
CREATE INDEX IF NOT EXISTS idx_signals_high_novelty
  ON signals(novelty_score DESC, detected_at DESC)
  WHERE novelty_score >= 0.8 AND status = 'interpreted';

COMMENT ON COLUMN signals.novelty_score IS
  'Novelty score (0.0-1.0). 1.0 = first occurrence, <0.3 = operational pattern. Computed at signal creation.';

COMMENT ON COLUMN signals.first_seen_at IS
  'Timestamp of first occurrence of this signal_type for this competitor. NULL if this is the first.';

COMMENT ON COLUMN signals.recurrence_count IS
  'Number of times this signal_type has occurred for this competitor in last 90d. Starts at 1.';

COMMIT;
