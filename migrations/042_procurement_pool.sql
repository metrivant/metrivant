-- =============================================================================
-- Migration: 042_procurement_pool.sql
-- Purpose:   Procurement / contract intelligence feed pool — fifth additive pool.
--
-- Changes to pool_events:
--   • source_type extended: adds 'procurement_feed', 'contract_feed',
--     'award_feed', 'api_feed'
--   • event_type extended: adds 'procurement_event'
--   • new columns: buyer_name, contract_value, currency, contract_id,
--     program_name, awardee_name, region, procurement_event_type
--   • new index: (competitor_id, contract_id) for contract-level dedup
--   • new index: (competitor_id, procurement_event_type) for pattern queries
--
-- Changes to competitor_feeds:
--   • pool_type extended: adds 'procurement'
--   • source_type extended: adds 'procurement_feed', 'contract_feed',
--     'award_feed', 'api_feed'
--
-- Changes to signals:
--   • signal_type extended: adds 'major_contract_award', 'framework_award',
--     'tender_selection', 'bid_notice', 'program_award', 'supplier_selection',
--     'contract_extension', 'partner_award', 'other_procurement_event'
--
-- New table: procurement_sources
--   Stores sector-scoped external procurement sources (government portals,
--   award feeds) that are not tied to a single competitor. Entries from these
--   sources are matched to tracked competitors at ingest time via name matching.
--
-- Design:
--   • Competitor-scoped procurement feeds: stored in competitor_feeds
--     (pool_type='procurement'). One feed config per competitor.
--   • Sector-scoped external sources: stored in procurement_sources.
--     Ingestion runs competitor matching against all active competitors.
--   • Individual award entries are evidence; promotion creates one signal
--     per classified event per competitor (signal_hash dedup).
--   • Tiered cross-pool dedup: 72h against newsroom, 120h against investor
--     for high-value types (major_contract_award, program_award, framework_award).
--
-- Safe: idempotent (ADD COLUMN IF NOT EXISTS, DROP/ADD CONSTRAINT, CREATE TABLE
--   IF NOT EXISTS). Apply via Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ── Extend pool_events.source_type for procurement feeds ──────────────────────

ALTER TABLE pool_events
  DROP CONSTRAINT IF EXISTS pool_events_source_type_check;

ALTER TABLE pool_events
  ADD CONSTRAINT pool_events_source_type_check
    CHECK (source_type IN (
      'rss',
      'atom',
      'newsroom_feed',
      'greenhouse',
      'lever',
      'ashby',
      'investor_rss',
      'investor_atom',
      'investor_feed',
      'changelog_feed',
      'release_feed',
      'github_release',
      'docs_feed',
      'procurement_feed',
      'contract_feed',
      'award_feed',
      'api_feed'
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
      'product_release',
      'procurement_event'
    ));

-- ── Add procurement-specific evidence columns to pool_events ──────────────────

-- Buyer / contracting authority name (e.g., "U.S. Department of Defense")
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS buyer_name TEXT;

-- Contract value in the currency specified by the currency column.
-- NULL when no structured value is available in the feed entry.
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC;

-- ISO 4217 currency code (e.g., "USD", "EUR", "GBP").
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS currency TEXT;

-- Procurement system contract ID (e.g., US federal PIID, UK Crown Commercial ref).
-- Used as a primary dedup key when present.
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS contract_id TEXT;

-- Program name associated with this award (e.g., "JEDI", "F-35 JSF").
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS program_name TEXT;

-- Awardee / supplier name as published in the source (raw, unmodified).
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS awardee_name TEXT;

-- Geographic region referenced in the award (country, state, region string).
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS region TEXT;

-- Classified procurement event type: set by promote-procurement-signals.ts.
-- One of: major_contract_award | framework_award | tender_selection | bid_notice |
--         program_award | supplier_selection | contract_extension |
--         partner_award | other_procurement_event
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS procurement_event_type TEXT;

-- Contract-level dedup: one pool_event per (competitor, contract_id).
-- Primary dedup for structured procurement sources that provide stable IDs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_events_contract_id
  ON pool_events (competitor_id, contract_id)
  WHERE contract_id IS NOT NULL AND event_type = 'procurement_event';

-- Classification index: pattern queries within a competitor's award history.
CREATE INDEX IF NOT EXISTS idx_pool_events_procurement_type
  ON pool_events (competitor_id, procurement_event_type, published_at DESC)
  WHERE event_type = 'procurement_event';

-- ── Extend competitor_feeds.pool_type ─────────────────────────────────────────

ALTER TABLE competitor_feeds
  DROP CONSTRAINT IF EXISTS competitor_feeds_pool_type_check;

ALTER TABLE competitor_feeds
  ADD CONSTRAINT competitor_feeds_pool_type_check
    CHECK (pool_type IN (
      'newsroom',
      'investor',
      'careers',
      'product',
      'procurement'
    ));

-- ── Extend competitor_feeds.source_type for procurement feeds ─────────────────

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
      'docs_feed',
      'procurement_feed',
      'contract_feed',
      'award_feed',
      'api_feed'
    ));

-- ── Extend signals.signal_type for procurement events ─────────────────────────

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
      'major_release',
      'feature_update',
      'integration_release',
      'security_update',
      'bugfix_release',
      'api_change',
      'docs_update',
      'deprecation',
      'other_product_event',
      -- Procurement pool signals (migration 042)
      'major_contract_award',
      'framework_award',
      'tender_selection',
      'bid_notice',
      'program_award',
      'supplier_selection',
      'contract_extension',
      'partner_award',
      'other_procurement_event'
    ));

-- ── Create procurement_sources table ──────────────────────────────────────────
-- Stores sector-scoped external procurement feeds (government portals, award
-- registries) that are not tied to a specific competitor. Entries from these
-- sources are matched to tracked competitors at ingest time by name matching.
-- These sources are operator-configured, not auto-discovered at onboarding.

CREATE TABLE IF NOT EXISTS procurement_sources (
  id                   UUID        NOT NULL DEFAULT uuid_generate_v4(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_name          TEXT        NOT NULL,
  feed_url             TEXT        NOT NULL,
  source_type          TEXT        NOT NULL DEFAULT 'procurement_feed'
    CONSTRAINT procurement_sources_source_type_check
      CHECK (source_type IN ('procurement_feed', 'contract_feed', 'award_feed', 'api_feed')),
  -- Sectors this source is relevant to (NULL = apply to all sectors).
  -- Used to filter source activation by sector if needed.
  sectors              TEXT[],
  active               BOOLEAN     NOT NULL DEFAULT true,
  discovery_status     TEXT        NOT NULL DEFAULT 'active'
    CONSTRAINT procurement_sources_discovery_status_check
      CHECK (discovery_status IN ('active', 'feed_unavailable', 'discovery_failed')),
  consecutive_failures INTEGER     NOT NULL DEFAULT 0,
  last_error           TEXT,
  last_fetched_at      TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT procurement_sources_feed_url_unique UNIQUE (feed_url)
);

CREATE INDEX IF NOT EXISTS idx_procurement_sources_active
  ON procurement_sources (active, discovery_status)
  WHERE active = true;

COMMIT;
