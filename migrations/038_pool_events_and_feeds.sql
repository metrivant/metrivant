-- =============================================================================
-- Migration: 038_pool_events_and_feeds.sql
-- Purpose:   Additive signal pool — newsroom / press release feed ingestion.
--
-- New tables:
--   pool_events       — append-only feed event log (source-of-truth before promotion)
--   competitor_feeds  — one feed config per competitor per pool_type
--
-- Schema extensions to signals:
--   signals.source_type     — 'page_diff' (existing) | 'feed_event' (new)
--   signals.signal_type     — extend CHECK to include feed_press_release, feed_newsroom_post
--
-- Design principles:
--   • pool_events is append-only; status transitions via normalization_status
--   • feed signals flow through existing signals → interpretations → movements pipeline
--   • section_diff_id remains nullable (already was); feed signals set it to NULL
--   • signal_hash is the primary dedup key for feed signals
--   • competitor_feeds.pool_type is future-safe (investor, careers, product planned)
--
-- Safe: idempotent (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
-- Apply via Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ── pool_events ───────────────────────────────────────────────────────────────
-- Append-only feed event log. Every ingested feed entry lands here first.
-- Relevance filtering and signal promotion happen as a separate step.

CREATE TABLE IF NOT EXISTS pool_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  competitor_id         UUID        NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  source_type           TEXT        NOT NULL
    CONSTRAINT pool_events_source_type_check
      CHECK (source_type IN ('rss', 'atom', 'newsroom_feed')),
  source_url            TEXT        NOT NULL,
  event_type            TEXT        NOT NULL DEFAULT 'press_release'
    CONSTRAINT pool_events_event_type_check
      CHECK (event_type IN ('press_release', 'newsroom_post', 'investor_update')),
  title                 TEXT        NOT NULL,
  summary               TEXT,
  event_url             TEXT,
  published_at          TIMESTAMPTZ,
  content_hash          TEXT        NOT NULL,
  raw_payload           JSONB,
  normalization_status  TEXT        NOT NULL DEFAULT 'pending'
    CONSTRAINT pool_events_normalization_status_check
      CHECK (normalization_status IN ('pending', 'promoted', 'suppressed', 'duplicate')),
  suppression_reason    TEXT,
  promoted_signal_id    UUID        REFERENCES signals(id)
);

-- Primary dedup: one event per (competitor, content_hash).
-- content_hash is derived from GUID → title+date → title+url (in order of preference).
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_events_dedup
  ON pool_events (competitor_id, content_hash);

-- Secondary dedup: one event per (competitor, event_url) where URL is known.
-- Prevents duplicate entries when the same article is published with different GUIDs
-- across feed restarts (uncommon but observed on enterprise newsrooms).
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_events_event_url_dedup
  ON pool_events (competitor_id, event_url)
  WHERE event_url IS NOT NULL;

-- Processing queue index: promote-feed-signals queries this frequently.
CREATE INDEX IF NOT EXISTS idx_pool_events_pending
  ON pool_events (created_at DESC)
  WHERE normalization_status = 'pending';

-- Competitor timeline index: used by coverage queries and UI.
CREATE INDEX IF NOT EXISTS idx_pool_events_competitor
  ON pool_events (competitor_id, created_at DESC);

-- ── competitor_feeds ──────────────────────────────────────────────────────────
-- Feed configuration per competitor per pool type.
-- pool_type is future-safe: 'newsroom' first, others planned but not implemented.
-- UNIQUE (competitor_id, pool_type) ensures at most one feed per type per competitor.

CREATE TABLE IF NOT EXISTS competitor_feeds (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  competitor_id         UUID        NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  feed_url              TEXT,
  source_type           TEXT        NOT NULL DEFAULT 'rss'
    CONSTRAINT competitor_feeds_source_type_check
      CHECK (source_type IN ('rss', 'atom', 'newsroom_feed')),
  pool_type             TEXT        NOT NULL DEFAULT 'newsroom'
    CONSTRAINT competitor_feeds_pool_type_check
      CHECK (pool_type IN ('newsroom', 'investor', 'careers', 'product')),
  discovery_status      TEXT        NOT NULL DEFAULT 'pending'
    CONSTRAINT competitor_feeds_discovery_status_check
      CHECK (discovery_status IN ('pending', 'active', 'feed_unavailable', 'discovery_failed')),
  discovered_at         TIMESTAMPTZ,
  last_fetched_at       TIMESTAMPTZ,
  last_error            TEXT,
  consecutive_failures  INT         NOT NULL DEFAULT 0,
  UNIQUE (competitor_id, pool_type)
);

-- Active feeds index: ingest-feeds queries this to build its work queue.
CREATE INDEX IF NOT EXISTS idx_competitor_feeds_active
  ON competitor_feeds (competitor_id)
  WHERE discovery_status = 'active';

-- ── Extend signals.signal_type ────────────────────────────────────────────────
-- Add feed_press_release and feed_newsroom_post to the allowed signal types.
-- Drops and recreates the CHECK constraint — this is safe; no data validation change
-- for existing rows (they all have valid signal_types from the old constraint).

ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_signal_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_signal_type_check
    CHECK (signal_type IN (
      'price_point_change',
      'tier_change',
      'feature_launch',
      'positioning_shift',
      'content_change',
      'hiring_surge',
      'feed_press_release',
      'feed_newsroom_post'
    ));

-- ── Add signals.source_type ───────────────────────────────────────────────────
-- Provenance tracking: was this signal produced by a page diff or a feed event?
-- Default 'page_diff' for all existing rows.

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'page_diff'
    CONSTRAINT signals_source_type_check
      CHECK (source_type IN ('page_diff', 'feed_event'));

-- Index for feed-signal queries (coverage reports, dedup checks).
CREATE INDEX IF NOT EXISTS idx_signals_source_type
  ON signals (source_type, detected_at DESC)
  WHERE source_type = 'feed_event';

COMMIT;
