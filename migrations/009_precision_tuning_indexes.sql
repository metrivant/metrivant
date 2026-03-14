-- =============================================================================
-- Migration: 009_precision_tuning_indexes.sql
-- Purpose:   Performance indexes supporting the precision tuning pass.
--
--   All hot query paths now have targeted indexes, including:
--   - Batch diff detection (detect-diffs) — eliminates N+1 by bulk-loading
--     all diffs for changed pages; needs (monitored_page_id, last_seen_at) index
--   - Signal detection (detect-signals) — partial index on the confirmed/
--     unprocessed diff set; makes the LIMIT 50 scan O(1) instead of full-table
--   - Movement detection (detect-movements) — covers interpreted+date+confidence
--   - Pressure index (update-pressure-index) — covers per-page signal window
--   - Interpretation claim (interpret-signals RPC) — partial index on pending
--   - Extract-sections batch — covers sections_extracted+fetched_at
--   - Baseline lookup — covers the bulk IN() on monitored_page_id
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      All indexes use CREATE INDEX IF NOT EXISTS; no schema changes.
-- =============================================================================

BEGIN;

-- ── section_diffs ─────────────────────────────────────────────────────────────

-- detect-diffs batch load: bulk fetch all diffs for changed pages sorted by recency
CREATE INDEX IF NOT EXISTS idx_section_diffs_page_last_seen
  ON section_diffs (monitored_page_id, last_seen_at DESC);

-- detect-signals: partial index on the exact WHERE clause used by the cron.
-- Scanning only the confirmed+unprocessed+non-noise subset is orders of magnitude
-- faster than a full table scan when the pipeline is healthy.
CREATE INDEX IF NOT EXISTS idx_section_diffs_pending_signals
  ON section_diffs (last_seen_at ASC)
  WHERE confirmed = true AND signal_detected = false AND is_noise = false;

-- detect-ambient-activity: same shape but for ambient page processing
CREATE INDEX IF NOT EXISTS idx_section_diffs_pending_ambient
  ON section_diffs (last_seen_at ASC)
  WHERE confirmed = true AND signal_detected = false;

-- ── page_sections ─────────────────────────────────────────────────────────────

-- detect-diffs: top-N valid sections ordered by recency
CREATE INDEX IF NOT EXISTS idx_page_sections_valid_recent
  ON page_sections (created_at DESC)
  WHERE validation_status = 'valid';

-- detect-diffs: resolve (page, section_type) → latest section efficiently
CREATE INDEX IF NOT EXISTS idx_page_sections_page_type_created
  ON page_sections (monitored_page_id, section_type, created_at DESC);

-- detect-signals + detect-diffs: batch hash lookup for existing current sections
-- (covered by PK already, but explicit composite index helps query planner)
CREATE INDEX IF NOT EXISTS idx_page_sections_id_hash
  ON page_sections (id, section_hash);

-- ── snapshots ─────────────────────────────────────────────────────────────────

-- extract-sections: WHERE sections_extracted=false ORDER BY fetched_at ASC LIMIT N
CREATE INDEX IF NOT EXISTS idx_snapshots_pending_extraction
  ON snapshots (fetched_at ASC)
  WHERE sections_extracted = false;

-- ── section_baselines ─────────────────────────────────────────────────────────

-- detect-diffs: bulk fetch baselines for all active monitored pages
CREATE INDEX IF NOT EXISTS idx_section_baselines_page
  ON section_baselines (monitored_page_id);

-- ── signals ───────────────────────────────────────────────────────────────────

-- detect-movements: WHERE interpreted=true AND detected_at>=:since AND confidence filter
CREATE INDEX IF NOT EXISTS idx_signals_interpreted_date
  ON signals (detected_at DESC)
  WHERE interpreted = true;

-- update-pressure-index: bulk signal fetch per page within 7-day window
CREATE INDEX IF NOT EXISTS idx_signals_page_detected
  ON signals (monitored_page_id, detected_at DESC);

-- interpret-signals claim RPC: pending signals ordered for processing
CREATE INDEX IF NOT EXISTS idx_signals_pending_claim
  ON signals (detected_at ASC)
  WHERE status = 'pending' AND interpreted = false;

-- update-pressure-index: promote pending_review signals for high-pressure competitors
CREATE INDEX IF NOT EXISTS idx_signals_pending_review
  ON signals (monitored_page_id)
  WHERE status = 'pending_review' AND interpreted = false;

-- signal_hash deduplication (already in 008, but ensure it exists)
CREATE UNIQUE INDEX IF NOT EXISTS signals_signal_hash_uniq
  ON signals (signal_hash)
  WHERE signal_hash IS NOT NULL;

-- ── activity_events ───────────────────────────────────────────────────────────

-- Already covered by migration 008; repeated here as safety net
CREATE INDEX IF NOT EXISTS idx_activity_events_competitor
  ON activity_events (competitor_id, detected_at DESC);

-- ── strategic_movements ───────────────────────────────────────────────────────

-- detect-movements upsert: ON CONFLICT (competitor_id, movement_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_strategic_movements_dedup
  ON strategic_movements (competitor_id, movement_type);

-- UI feed: competitor movements ordered by recency
CREATE INDEX IF NOT EXISTS idx_strategic_movements_competitor_recent
  ON strategic_movements (competitor_id, last_seen_at DESC);

-- ── competitors ───────────────────────────────────────────────────────────────

-- update-pressure-index: fetch only active competitors
CREATE INDEX IF NOT EXISTS idx_competitors_active
  ON competitors (id)
  WHERE active = true;

-- ── monitored_pages ───────────────────────────────────────────────────────────

-- Already in 008; repeated as safety net
CREATE INDEX IF NOT EXISTS idx_monitored_pages_page_class
  ON monitored_pages (page_class)
  WHERE active = true;

-- detect-signals join: look up competitor_id + page_class from diff
CREATE INDEX IF NOT EXISTS idx_monitored_pages_id_class_competitor
  ON monitored_pages (id, page_class, competitor_id);

COMMIT;
