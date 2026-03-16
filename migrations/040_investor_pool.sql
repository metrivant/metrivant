-- =============================================================================
-- Migration: 040_investor_pool.sql
-- Purpose:   Investor / financial intelligence feed pool — third additive pool.
--
-- Extends the pool_events architecture (migration 038) to support structured
-- investor feed evidence, and adds investor event signal types.
--
-- Changes to pool_events:
--   • No new event_type needed — 'investor_update' already present (migration 038)
--   • New column: investor_event_type — classified event type after keyword analysis
--   • New index: (competitor_id, investor_event_type) for cross-pool dedup queries
--
-- Changes to competitor_feeds:
--   • source_type extended: adds 'investor_rss', 'investor_atom', 'investor_feed'
--   • pool_type = 'investor' was already present in migration 038 schema
--
-- Changes to signals:
--   • signal_type extended: adds 'earnings_release', 'acquisition', 'divestiture',
--     'guidance_update', 'major_contract', 'capital_raise', 'strategic_investment',
--     'partnership', 'investor_presentation', 'other_investor_event'
--   • signal.source_type = 'feed_event' already covers investor feed signals
--
-- Design:
--   • Raw investor feed entries are stored as event_type = 'investor_update'.
--   • During promotion, deterministic keyword classification assigns
--     investor_event_type (earnings_release, acquisition, etc.).
--   • investor_event_type is stored on pool_events for provenance + query.
--   • One signal per classified event per competitor (signal_hash dedup).
--   • Cross-pool dedup: investor signals supersede newsroom signals for the
--     same event_url within a 48-hour window.
--
-- Safe: idempotent (ADD COLUMN IF NOT EXISTS, DROP/ADD CONSTRAINT).
-- Apply via Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ── Add investor_event_type to pool_events ─────────────────────────────────────
-- Stores the deterministic classification result produced during promotion.
-- NULL until promote-investor-signals.ts classifies the event.
ALTER TABLE pool_events
  ADD COLUMN IF NOT EXISTS investor_event_type TEXT;

-- Classification index: cross-pool dedup and pattern queries.
CREATE INDEX IF NOT EXISTS idx_pool_events_investor_event_type
  ON pool_events (competitor_id, investor_event_type, published_at DESC)
  WHERE event_type = 'investor_update';

-- Cross-pool dedup index: match investor and newsroom events by event_url.
CREATE INDEX IF NOT EXISTS idx_pool_events_event_url_published
  ON pool_events (competitor_id, event_url, published_at DESC)
  WHERE event_url IS NOT NULL;

-- ── Extend competitor_feeds.source_type for investor feed platforms ───────────

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
      'investor_feed'
    ));

-- ── Extend signals.signal_type for investor events ────────────────────────────

ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_signal_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_signal_type_check
    CHECK (signal_type IN (
      -- Page diff signals (original)
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
      'other_investor_event'
    ));

COMMIT;
