-- =============================================================================
-- Migration: 008_intelligence_cadence.sql
-- Purpose:   Support the tiered signal acquisition cadence:
--
--   1. Add page_class to monitored_pages so the three fetch crons can
--      target high_value / standard / ambient pages at different frequencies.
--
--   2. Add confidence_score + signal_hash to signals for weighted gating
--      and per-day deduplication.
--
--   3. Add pressure_index to competitors for cross-signal early warning.
--
--   4. Create activity_events table for ambient intelligence (blog, careers,
--      social feeds) — these are NOT signals; they feed the UI ticker and
--      pressure index only.
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      All columns use ADD COLUMN IF NOT EXISTS.
--            Table uses CREATE TABLE IF NOT EXISTS.
--            Index uses CREATE UNIQUE INDEX IF NOT EXISTS.
--            UPDATE/classification uses idempotent WHERE clauses.
-- =============================================================================

BEGIN;

-- ── 1. Page classification ────────────────────────────────────────────────────

ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS page_class text NOT NULL DEFAULT 'standard';

-- Classify existing pages by page_type.
-- pricing / changelog / newsroom = high_value (monitored every 60 min)
-- blog / careers              = ambient     (monitored every 30 min, no signals)
-- everything else             = standard    (already the default)

UPDATE monitored_pages
  SET page_class = 'high_value'
  WHERE page_type IN ('pricing', 'changelog', 'newsroom')
    AND page_class = 'standard';

UPDATE monitored_pages
  SET page_class = 'ambient'
  WHERE page_type IN ('blog', 'careers')
    AND page_class = 'standard';

-- Add CHECK constraint to prevent invalid values going forward.
-- Safe: DO NOT VALIDATE defers check to future rows only in Postgres,
-- but we're using a standard ADD CONSTRAINT which validates all rows.
-- Since the UPDATE above normalised all rows, this is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitored_pages_page_class_check'
  ) THEN
    ALTER TABLE monitored_pages
      ADD CONSTRAINT monitored_pages_page_class_check
        CHECK (page_class IN ('high_value', 'standard', 'ambient'));
  END IF;
END$$;

-- Index to support the three cron fetch queries (each filters by page_class)
CREATE INDEX IF NOT EXISTS idx_monitored_pages_page_class
  ON monitored_pages (page_class)
  WHERE active = true;

-- ── 2. Signal quality fields ──────────────────────────────────────────────────

-- confidence_score: 0.0–1.0, computed from type weight + recency + observation count.
-- Signals below 0.35 are suppressed. Signals below 0.65 get status='pending_review'
-- and are not sent to the AI interpretation layer.
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS confidence_score float;

-- signal_hash: sha256(competitor_id:signal_type:YYYY-MM-DD).
-- Prevents creating more than one signal per (competitor, type) per calendar day.
-- Partial unique index: NULL values are excluded so legacy signals are unaffected.
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS signal_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS signals_signal_hash_uniq
  ON signals (signal_hash)
  WHERE signal_hash IS NOT NULL;

-- ── 3. Pressure index on competitors ─────────────────────────────────────────
-- Derived field updated hourly by update-pressure-index cron.
-- Allows early-warning interpretation even when individual signal confidence
-- is moderate (0.35–0.64) but aggregate activity is high.

ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS pressure_index float NOT NULL DEFAULT 0.0;

-- ── 4. Activity events (ambient intelligence) ─────────────────────────────────
-- Stores content-change events from ambient pages (blog, careers, etc.).
-- These are NOT signals and are NOT interpreted by OpenAI.
-- They feed: UI ticker, radar node micro-activity, and pressure_index.

CREATE TABLE IF NOT EXISTS activity_events (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id   uuid         NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  event_type      text         NOT NULL,
  source_headline text,
  url             text,
  detected_at     timestamptz  NOT NULL DEFAULT now(),
  page_class      text         NOT NULL DEFAULT 'ambient',
  raw_data        jsonb
);

CREATE INDEX IF NOT EXISTS idx_activity_events_competitor
  ON activity_events (competitor_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_detected
  ON activity_events (detected_at DESC);

-- Prune old activity events automatically (keep 30 days).
-- A cleanup cron or Supabase pg_cron rule can use this, or it can be
-- done inline in the detect-ambient-activity handler.
-- For now: just the table and indexes.

COMMIT;
