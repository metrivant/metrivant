-- ── Migration 011: Database Integrity Repair ─────────────────────────────────
--
-- Audit findings addressed in this migration:
--
--   A. Signal deduplication hash — missing column + unique constraint
--   B. section_baselines unique constraint — missing UNIQUE(page, type)
--   C. Missing indexes — pipeline hot paths (competitor_id, signal_type, created_at)
--   D. tracked_competitors UPDATE RLS policy — missing (needed for name/URL edits)
--
-- NOT addressed (design choices, not defects):
--   • competitor_id FK on UI aggregate tables (momentum, positioning) — soft
--     cross-boundary references; adding FK would require same-transaction pipeline
--     inserts, which breaks the decoupled cron architecture.
--   • alerts.signal_id stored as text — intentional cross-boundary reference.
--   • organizations/alerts DELETE policies — no product path deletes these.
--   • competitors / monitored_pages dedup on url — pipeline handles this at app layer.
--
-- Run this in your Supabase SQL editor.

-- ── A. Signal deduplication hash ─────────────────────────────────────────────
--
-- Adds dedup_hash to signals. Computed by the pipeline as:
--   encode(sha256((monitored_page_id || signal_type || coalesce(section_diff_id::text, ''))::bytea), 'hex')
--
-- Existing rows get NULL (hash not backfilled — they predate the constraint).
-- The partial unique index ignores NULLs, so no backfill is required.

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS dedup_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS signals_dedup_hash_idx
  ON signals (dedup_hash)
  WHERE dedup_hash IS NOT NULL;

COMMENT ON COLUMN signals.dedup_hash IS
  'SHA-256 hex of (monitored_page_id || signal_type || coalesce(section_diff_id::text, '''')). '
  'Set by the pipeline before insert. Prevents duplicate signals under concurrent execution.';

-- ── B. section_baselines unique constraint ────────────────────────────────────
--
-- build_section_baselines upserts one baseline per (page, section_type).
-- Without this constraint, concurrent executions can insert duplicate baselines,
-- causing detect-diffs to compare against the wrong baseline.

ALTER TABLE section_baselines
  ADD CONSTRAINT IF NOT EXISTS section_baselines_page_type_unique
  UNIQUE (monitored_page_id, section_type);

-- ── C. Missing indexes ────────────────────────────────────────────────────────
--
-- All indexes use IF NOT EXISTS — safe to re-run.

-- signals — primary pipeline query targets
CREATE INDEX IF NOT EXISTS signals_monitored_page_id_idx
  ON signals (monitored_page_id);

CREATE INDEX IF NOT EXISTS signals_signal_type_idx
  ON signals (signal_type);

CREATE INDEX IF NOT EXISTS signals_detected_at_idx
  ON signals (detected_at DESC);

-- Partial index for claim_pending_signals / fail_exhausted_signals hot path.
CREATE INDEX IF NOT EXISTS signals_pending_status_idx
  ON signals (status, retry_count)
  WHERE status IN ('pending', 'processing');

-- monitored_pages — FK column, no index was created by the FK constraint itself
CREATE INDEX IF NOT EXISTS monitored_pages_competitor_id_idx
  ON monitored_pages (competitor_id);

CREATE INDEX IF NOT EXISTS monitored_pages_active_idx
  ON monitored_pages (active)
  WHERE active = true;

-- snapshots — latest snapshot per page is the most common lookup
CREATE INDEX IF NOT EXISTS snapshots_monitored_page_id_fetched_at_idx
  ON snapshots (monitored_page_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS snapshots_status_idx
  ON snapshots (status);

-- page_sections — FK columns queried by detect-diffs and build-baselines
CREATE INDEX IF NOT EXISTS page_sections_monitored_page_id_idx
  ON page_sections (monitored_page_id);

CREATE INDEX IF NOT EXISTS page_sections_snapshot_id_idx
  ON page_sections (snapshot_id);

-- section_diffs — detect-signals queries by (page, status)
CREATE INDEX IF NOT EXISTS section_diffs_monitored_page_id_status_idx
  ON section_diffs (monitored_page_id, status);

-- strategic_movements — radar_feed view join on competitor_id + recency sort
CREATE INDEX IF NOT EXISTS strategic_movements_competitor_id_idx
  ON strategic_movements (competitor_id);

CREATE INDEX IF NOT EXISTS strategic_movements_last_seen_at_idx
  ON strategic_movements (last_seen_at DESC);

-- interpretations — one-to-one FK lookup
CREATE INDEX IF NOT EXISTS interpretations_signal_id_idx
  ON interpretations (signal_id);

-- competitors — pipeline queries active competitors
CREATE INDEX IF NOT EXISTS competitors_active_idx
  ON competitors (active)
  WHERE active = true;

-- created_at range indexes for time-windowed queries
CREATE INDEX IF NOT EXISTS signals_created_at_idx
  ON signals (created_at DESC);

-- ── D. tracked_competitors UPDATE RLS policy ──────────────────────────────────
--
-- The existing policies cover SELECT, INSERT, DELETE.
-- UPDATE is required for future name/URL correction flows.

CREATE POLICY IF NOT EXISTS "tracked competitors org member update"
  ON tracked_competitors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = tracked_competitors.org_id
        AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = tracked_competitors.org_id
        AND o.owner_id = auth.uid()
    )
  );

-- ── Pipeline code change required (not SQL) ───────────────────────────────────
--
-- After applying this migration, update the signal insertion code in
-- metrivant-runtime/src/stages/detect-signals.ts to compute and pass dedup_hash:
--
--   import { createHash } from 'crypto';
--
--   function signalDedupHash(
--     monitored_page_id: string,
--     signal_type: string,
--     section_diff_id: string | null
--   ): string {
--     return createHash('sha256')
--       .update(monitored_page_id + signal_type + (section_diff_id ?? ''))
--       .digest('hex');
--   }
--
-- Then in the signal insert:
--   { ..., dedup_hash: signalDedupHash(page_id, type, diff_id) }
--
-- With the partial unique index in place, concurrent inserts of the same signal
-- will hit ON CONFLICT DO NOTHING and the second insert becomes a no-op.
