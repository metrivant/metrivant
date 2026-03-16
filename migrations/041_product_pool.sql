-- =============================================================================
-- Migration: 041_product_pool.sql
-- Purpose:   Product / changelog / release feed pool — fourth additive pool.
--
-- Also fixes a cumulative schema gap from migrations 039–040:
--   pool_events.source_type was never extended beyond the original three values
--   in migration 038 ('rss', 'atom', 'newsroom_feed'), even though the careers
--   and investor ingestion functions write ATS/investor source types into it.
--   This migration corrects that omission in one idempotent operation.
--
-- Changes to pool_events:
--   • source_type extended (cumulative fix + product types):
--       adds 'greenhouse', 'lever', 'ashby'          (careers, missed in 039)
--       adds 'investor_rss', 'investor_atom', 'investor_feed' (investor, missed in 040)
--       adds 'changelog_feed', 'release_feed', 'github_release', 'docs_feed' (product)
--   • event_type extended: adds 'product_release'
--   • new column: product_event_type — classified product event type (set during promotion)
--   • new column: version_tag — semver tag extracted at ingestion (e.g. "v1.2.3")
--   • new indexes for product pattern queries
--
-- Changes to competitor_feeds:
--   • source_type extended: adds 'changelog_feed', 'release_feed', 'github_release',
--     'docs_feed'
--   • pool_type = 'product' was already present in migration 038 schema
--
-- Changes to signals:
--   • signal_type extended: adds 'major_release', 'feature_update',
--     'integration_release', 'security_update', 'bugfix_release',
--     'api_change', 'docs_update', 'deprecation', 'other_product_event'
--   • 'feature_launch' already exists (page-diff origin); reused by product pool
--     via distinct source_type = 'feed_event'
--   • signal.source_type = 'feed_event' already covers product feed signals
--
-- Design:
--   • Raw product feed entries are stored as event_type = 'product_release'.
--   • version_tag is extracted at ingestion from the entry title or GUID.
--   • During promotion, semver classification takes precedence; keyword fallback
--     used when no valid semver tag is present.
--   • product_event_type stored on pool_events for provenance + downstream query.
--   • One signal per classified product event per competitor (signal_hash dedup).
--   • Cross-pool dedup: product signals supersede newsroom signals for the same
--     event_url within a 48-hour window.
--
-- Safe: idempotent (ADD COLUMN IF NOT EXISTS, DROP/ADD CONSTRAINT).
-- Apply via Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ── Fix pool_events.source_type (cumulative gap from migrations 039–040) ──────
-- DROP/ADD pattern is idempotent: safe to re-apply if constraint already matches.

ALTER TABLE pool_events
  DROP CONSTRAINT IF EXISTS pool_events_source_type_check;

ALTER TABLE pool_events
  ADD CONSTRAINT pool_events_source_type_check
    CHECK (source_type IN (
      -- Original (migration 038)
      'rss',
      'atom',
      'newsroom_feed',
      -- Careers ATS sources (migration 039 — omitted from pool_events constraint)
      'greenhouse',
      'lever',
      'ashby',
      -- Investor feed sources (migration 040 — omitted from pool_events constraint)
      'investor_rss',
      'investor_atom',
      'investor_feed',
      -- Product feed sources (new in migration 041)
      'changelog_feed',
      'release_feed',
      'github_release',
      'docs_feed'
    ));

-- ── Extend pool_events.event_type ─────────────────────────────────────────────

ALTER TABLE pool_events
  DROP CONSTRAINT IF EXISTS pool_events_event_type_check;

ALTER TABLE pool_events
  ADD CONSTRAINT pool_events_event_type_check
    CHECK (event_type IN (
      'press_release',
      'newsroom_post',
      'investor_update',
      'job_posting',
      'product_release'
    ));

-- ── Add product-specific evidence columns to pool_events ─────────────────────

-- Classified product event type: set by promote-product-signals.ts during promotion.
-- One of: major_release | feature_update | feature_launch | integration_release |
--         security_update | bugfix_release | api_change | docs_update |
--         deprecation | other_product_event
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS product_event_type TEXT;

-- Semantic version tag extracted from the release entry at ingestion time.
-- e.g. "v1.2.3", "v2.0", "2.1.0-beta"
-- NULL when no parseable version is found in the title/GUID.
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS version_tag TEXT;

-- Classification index: pattern queries and cross-pool dedup.
CREATE INDEX IF NOT EXISTS idx_pool_events_product_event_type
  ON pool_events (competitor_id, product_event_type, published_at DESC)
  WHERE event_type = 'product_release';

-- Version-tag index: semver queries within a competitor's release history.
CREATE INDEX IF NOT EXISTS idx_pool_events_version_tag
  ON pool_events (competitor_id, version_tag)
  WHERE event_type = 'product_release' AND version_tag IS NOT NULL;

-- ── Extend competitor_feeds.source_type for product feed platforms ────────────

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
      'workday',
      'investor_rss',
      'investor_atom',
      'investor_feed',
      'changelog_feed',
      'release_feed',
      'github_release',
      'docs_feed'
    ));

-- ── Extend signals.signal_type for product events ─────────────────────────────
-- Note: 'feature_launch' already exists (used by page-diff pipeline).
-- It is reused here for product-feed feature launches; source_type='feed_event'
-- distinguishes provenance without requiring a separate signal type.

ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_signal_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_signal_type_check
    CHECK (signal_type IN (
      -- Page diff signals (original pipeline)
      'price_point_change',
      'tier_change',
      'feature_launch',
      'positioning_shift',
      'content_change',
      'hiring_surge',
      -- Newsroom feed signals (migration 038)
      'feed_press_release',
      'feed_newsroom_post',
      -- Careers pool signals (migration 039)
      'hiring_spike',
      'new_function',
      'new_region',
      'role_cluster',
      -- Investor pool signals (migration 040)
      'earnings_release',
      'acquisition',
      'divestiture',
      'guidance_update',
      'major_contract',
      'capital_raise',
      'strategic_investment',
      'partnership',
      'investor_presentation',
      'other_investor_event',
      -- Product pool signals (migration 041)
      -- 'feature_launch' is shared with page-diff — no duplicate needed
      'major_release',
      'feature_update',
      'integration_release',
      'security_update',
      'bugfix_release',
      'api_change',
      'docs_update',
      'deprecation',
      'other_product_event'
    ));

COMMIT;
