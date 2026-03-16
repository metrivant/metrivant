-- =============================================================================
-- Migration: 039_careers_pool.sql
-- Purpose:   Careers / hiring pool — second additive signal pool.
--
-- Extends the pool_events architecture (migration 038) to support structured
-- ATS job posting evidence, and adds hiring pattern signal types.
--
-- Changes to pool_events:
--   • event_type extended: adds 'job_posting'
--   • new columns: external_event_id, department, location, employment_type,
--     department_normalized
--   • new indexes: external_event_id dedup, department_normalized pattern queries
--
-- Changes to competitor_feeds:
--   • source_type extended: adds 'greenhouse', 'lever', 'ashby', 'workday'
--   • (pool_type = 'careers' was already present in migration 038 schema)
--
-- Changes to signals:
--   • signal_type extended: adds 'hiring_spike', 'new_function', 'new_region',
--     'role_cluster'
--   • source_type extended: adds 'pool_event' (careers promotions use this)
--
-- Design:
--   • Individual job postings are evidence, not signals.
--   • Pattern detection (hiring_spike / new_function / new_region / role_cluster)
--     aggregates evidence into one signal per pattern per week.
--   • department_normalized stores the canonical function (engineering, sales, etc.)
--     alongside the raw department name from the ATS.
--
-- Safe: idempotent (ADD COLUMN IF NOT EXISTS, DROP/ADD CONSTRAINT).
-- Apply via Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ── Extend pool_events.event_type ─────────────────────────────────────────────

ALTER TABLE pool_events
  DROP CONSTRAINT IF EXISTS pool_events_event_type_check;

ALTER TABLE pool_events
  ADD CONSTRAINT pool_events_event_type_check
    CHECK (event_type IN (
      'press_release',
      'newsroom_post',
      'investor_update',
      'job_posting'
    ));

-- ── Add careers-specific evidence columns to pool_events ─────────────────────

-- ATS-native job identifier (Greenhouse integer ID, Lever/Ashby UUID, etc.)
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS external_event_id TEXT;

-- Raw department / team name from the ATS (preserved for audit).
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS department TEXT;

-- Job location as returned by the ATS.
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS location TEXT;

-- Employment type as returned by the ATS (Full-time, Part-time, Contract, etc.)
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS employment_type TEXT;

-- Canonical function derived from department via deterministic keyword mapping.
-- One of: engineering | infrastructure | data | research | sales | marketing |
--         operations | security | design | product | legal | finance | hr |
--         support | executive | other
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS department_normalized TEXT;

-- Primary ATS dedup: one pool_event per (competitor, ATS job id).
-- Prevents re-inserting the same posting across ingest runs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_events_external_id
  ON pool_events (competitor_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

-- Pattern detection index: group by normalized function within a time window.
CREATE INDEX IF NOT EXISTS idx_pool_events_dept_normalized
  ON pool_events (competitor_id, department_normalized, created_at DESC)
  WHERE event_type = 'job_posting';

-- Location pattern index: detect new geographies.
CREATE INDEX IF NOT EXISTS idx_pool_events_location
  ON pool_events (competitor_id, location, created_at DESC)
  WHERE event_type = 'job_posting' AND location IS NOT NULL;

-- ── Extend competitor_feeds.source_type for ATS platforms ────────────────────

ALTER TABLE competitor_feeds
  DROP CONSTRAINT IF EXISTS competitor_feeds_source_type_check;

ALTER TABLE competitor_feeds
  ADD CONSTRAINT competitor_feeds_source_type_check
    CHECK (source_type IN (
      'rss',
      'atom',
      'newsroom_feed',
      'greenhouse',
      'lever',
      'ashby',
      'workday'
    ));

-- ── Extend signals.signal_type for hiring patterns ───────────────────────────

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
      'feed_newsroom_post',
      'hiring_spike',
      'new_function',
      'new_region',
      'role_cluster'
    ));

-- ── Extend signals.source_type for pool-originated signals ───────────────────
-- 'pool_event' covers careers pattern signals.
-- 'feed_event' (from migration 038) covers newsroom feed signals.
-- Both are retained for distinct provenance tracking.

ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_source_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_source_type_check
    CHECK (source_type IN ('page_diff', 'feed_event', 'pool_event'));

COMMIT;
