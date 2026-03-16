-- =============================================================================
-- Migration: 043_regulatory_pool.sql
-- Purpose:   Regulatory / filing intelligence feed pool — sixth additive pool.
--
-- Changes to pool_events:
--   • source_type extended: adds 'sec_feed', 'regulatory_rss', 'agency_feed',
--     'approval_feed'
--   • event_type extended: adds 'regulatory_filing'
--   • new columns: filing_type, regulatory_body, filing_id, filing_date,
--     jurisdiction, document_url, regulatory_event_type
--   • new index: (competitor_id, filing_id) for filing-level dedup
--   • new index: (competitor_id, regulatory_event_type) for pattern queries
--
-- Changes to competitor_feeds:
--   • pool_type extended: adds 'regulatory'
--   • source_type extended: adds 'sec_feed', 'regulatory_rss', 'agency_feed',
--     'approval_feed'
--
-- Changes to signals:
--   • signal_type extended: adds 'material_event', 'acquisition_disclosure',
--     'major_contract_disclosure', 'executive_change',
--     'regulatory_investigation', 'product_approval', 'risk_disclosure',
--     'financial_disclosure', 'compliance_event', 'other_regulatory_event'
--
-- New table: regulatory_sources
--   Stores sector-scoped or regulator-scoped external feeds (FDA approvals,
--   FERC filings, etc.) not tied to a single competitor. Entries matched to
--   tracked competitors at ingest time via name matching.
--   Operator-configured; not auto-discovered at onboarding.
--
-- Design:
--   • Competitor-scoped regulatory feeds: stored in competitor_feeds
--     (pool_type='regulatory'). EDGAR Atom feeds discovered at onboarding.
--   • Sector/regulator-scoped sources: stored in regulatory_sources.
--     Ingestion runs competitor matching against all active competitors.
--   • Individual filings are evidence; promotion creates one signal per
--     classified event per competitor (signal_hash dedup).
--   • Cross-pool dedup: 72h against newsroom + investor (standard);
--     120h for high-value types (material_event, acquisition_disclosure,
--     major_contract_disclosure, product_approval).
--
-- Safe: idempotent (ADD COLUMN IF NOT EXISTS, DROP/ADD CONSTRAINT, CREATE TABLE
--   IF NOT EXISTS). Apply via Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ── Extend pool_events.source_type for regulatory feeds ───────────────────────

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
      'api_feed',
      'sec_feed',
      'regulatory_rss',
      'agency_feed',
      'approval_feed'
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
      'procurement_event',
      'regulatory_filing'
    ));

-- ── Add regulatory-specific evidence columns to pool_events ───────────────────

-- SEC form type or other regulatory form identifier (e.g., "8-K", "10-K", "DEF 14A").
-- Populated at ingest time for EDGAR feeds; NULL for non-structured sources.
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS filing_type TEXT;

-- Regulatory authority name (e.g., "SEC", "FDA", "FERC", "FCA").
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS regulatory_body TEXT;

-- Unique filing identifier from the regulatory system.
-- For SEC EDGAR: accession number in format XXXXXXXXXX-YY-ZZZZZZ.
-- Primary dedup key when present.
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS filing_id TEXT;

-- Filing publication date as reported by the source (may differ from published_at).
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS filing_date DATE;

-- Jurisdiction of the regulatory filing (e.g., "US", "EU", "UK").
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT;

-- Direct URL to the filing document (may differ from event_url which is the index page).
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Classified regulatory event type: set by promote-regulatory-signals.ts.
-- One of: material_event | acquisition_disclosure | major_contract_disclosure |
--         executive_change | regulatory_investigation | product_approval |
--         risk_disclosure | financial_disclosure | compliance_event |
--         other_regulatory_event
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS regulatory_event_type TEXT;

-- Filing-level dedup: one pool_event per (competitor, filing_id).
-- Primary dedup for EDGAR and other structured filing sources.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_events_filing_id
  ON pool_events (competitor_id, filing_id)
  WHERE filing_id IS NOT NULL AND event_type = 'regulatory_filing';

-- Classification index: pattern queries within a competitor's regulatory history.
CREATE INDEX IF NOT EXISTS idx_pool_events_regulatory_type
  ON pool_events (competitor_id, regulatory_event_type, published_at DESC)
  WHERE event_type = 'regulatory_filing';

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
      'procurement',
      'regulatory'
    ));

-- ── Extend competitor_feeds.source_type for regulatory feeds ──────────────────

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
      'api_feed',
      'sec_feed',
      'regulatory_rss',
      'agency_feed',
      'approval_feed'
    ));

-- ── Extend signals.signal_type for regulatory events ──────────────────────────

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
      'other_procurement_event',
      -- Regulatory pool signals (migration 043)
      'material_event',
      'acquisition_disclosure',
      'major_contract_disclosure',
      'executive_change',
      'regulatory_investigation',
      'product_approval',
      'risk_disclosure',
      'financial_disclosure',
      'compliance_event',
      'other_regulatory_event'
    ));

-- ── Create regulatory_sources table ───────────────────────────────────────────
-- Stores sector-scoped or regulator-scoped external feeds (FDA drug approvals,
-- FERC filings, FCA register, etc.) that span multiple companies. Entries are
-- matched to tracked competitors at ingest time by name matching.
-- These sources are operator-configured, not auto-discovered at onboarding.

CREATE TABLE IF NOT EXISTS regulatory_sources (
  id                   UUID        NOT NULL DEFAULT uuid_generate_v4(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_name          TEXT        NOT NULL,
  feed_url             TEXT        NOT NULL,
  source_type          TEXT        NOT NULL DEFAULT 'agency_feed'
    CONSTRAINT regulatory_sources_source_type_check
      CHECK (source_type IN ('sec_feed', 'regulatory_rss', 'agency_feed', 'approval_feed')),
  -- Regulatory authority name (e.g., "SEC", "FDA", "FERC").
  regulator            TEXT,
  -- Sectors this source is relevant to (NULL = apply to all sectors).
  sectors              TEXT[],
  active               BOOLEAN     NOT NULL DEFAULT true,
  discovery_status     TEXT        NOT NULL DEFAULT 'active'
    CONSTRAINT regulatory_sources_discovery_status_check
      CHECK (discovery_status IN ('active', 'feed_unavailable', 'discovery_failed')),
  consecutive_failures INTEGER     NOT NULL DEFAULT 0,
  last_error           TEXT,
  last_fetched_at      TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT regulatory_sources_feed_url_unique UNIQUE (feed_url)
);

CREATE INDEX IF NOT EXISTS idx_regulatory_sources_active
  ON regulatory_sources (active, discovery_status)
  WHERE active = true;

COMMIT;
