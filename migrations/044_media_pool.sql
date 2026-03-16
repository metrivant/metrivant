-- =============================================================================
-- Migration: 044_media_pool.sql
-- Purpose:   Market / media narrative detection — seventh intelligence pool.
--
-- This pool does NOT use pool_events or signals.
-- Data flow: media RSS → media_observations → cluster detection → sector_narratives
--            → sector_intelligence → weekly brief "Market Context"
--
-- New tables:
--   media_observations  — raw article metadata from curated sector media feeds.
--                         Short retention (30 days). High volume. Not evidence.
--   sector_narratives   — detected narrative clusters. Permanent retention.
--                         These are the output artifact — not inputs to signals.
--
-- Retention:
--   media_observations: 30 days (pruned by retention cron tier 5)
--   sector_narratives:  permanent
--
-- Safe: CREATE TABLE IF NOT EXISTS. Apply via Supabase SQL editor.
-- =============================================================================

BEGIN;

-- ── media_observations ────────────────────────────────────────────────────────
-- Temporary staging table for article metadata from curated sector feeds.
-- Stores title + extracted keywords only — no article body (most sources
-- are paywalled; body scraping is explicitly out of scope).
-- 30-day TTL enforced by daily retention job.

CREATE TABLE IF NOT EXISTS media_observations (
  id           UUID        NOT NULL DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Sector this observation belongs to (matches organizations.sector values)
  sector       TEXT        NOT NULL,
  -- Human-readable name of the media source (e.g., "Defense News")
  source_name  TEXT        NOT NULL,
  -- Article title as published in the RSS feed
  title        TEXT        NOT NULL,
  -- Article URL (may be null for paywalled feeds that omit links)
  url          TEXT,
  -- Publication timestamp from the feed entry
  published_at TIMESTAMPTZ,
  -- Dedup fingerprint: sha256(sector:source_name:title)[:40]
  content_hash TEXT        NOT NULL,
  -- Extracted keywords after stopword removal and sector allowlist filtering.
  -- Array of normalized keyword strings (lowercase, trimmed).
  keywords     TEXT[]      NOT NULL DEFAULT '{}',
  PRIMARY KEY (id),
  CONSTRAINT media_observations_content_hash_unique UNIQUE (content_hash)
);

-- Fast dedup check on insert
CREATE INDEX IF NOT EXISTS idx_media_observations_content_hash
  ON media_observations (content_hash);

-- Cluster detection query: all observations for a sector within a time window
CREATE INDEX IF NOT EXISTS idx_media_observations_sector_time
  ON media_observations (sector, published_at DESC);

-- Retention pruning: delete rows older than 30 days
CREATE INDEX IF NOT EXISTS idx_media_observations_created_at
  ON media_observations (created_at);

-- ── sector_narratives ─────────────────────────────────────────────────────────
-- Detected narrative clusters representing active discourse themes in a sector.
-- Written by the ingest-media-feeds cron when a keyword or phrase appears in
-- ≥5 articles from ≥3 distinct sources within a 7-day rolling window.
-- Permanent retention — these are the intelligence artifact.

CREATE TABLE IF NOT EXISTS sector_narratives (
  id                   UUID        NOT NULL DEFAULT uuid_generate_v4(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Sector this narrative belongs to
  sector               TEXT        NOT NULL,
  -- Human-readable theme label derived from the top keyword pair in the cluster.
  -- Normalized lowercase; used as the upsert key within a sector.
  theme_label          TEXT        NOT NULL,
  -- All keywords contributing to this cluster
  keywords             TEXT[]      NOT NULL DEFAULT '{}',
  -- Number of distinct source publications in the cluster
  source_count         INTEGER     NOT NULL,
  -- Number of distinct articles in the cluster
  article_count        INTEGER     NOT NULL,
  -- Up to 3 representative article URLs from the cluster
  representative_urls  TEXT[]      NOT NULL DEFAULT '{}',
  -- Timestamp of the earliest article in the cluster
  first_detected_at    TIMESTAMPTZ NOT NULL,
  -- Timestamp of the most recent article in the cluster
  last_detected_at     TIMESTAMPTZ NOT NULL,
  -- Confidence score: min(1.0, (article_count/10) + (source_count/10))
  confidence_score     NUMERIC     NOT NULL,
  PRIMARY KEY (id),
  -- One narrative row per (sector, theme_label) — updated on re-detection
  CONSTRAINT sector_narratives_sector_theme_unique UNIQUE (sector, theme_label)
);

-- Query for recent narratives by sector (sector intelligence + brief integration)
CREATE INDEX IF NOT EXISTS idx_sector_narratives_sector_recent
  ON sector_narratives (sector, last_detected_at DESC);

-- Query for high-confidence narratives
CREATE INDEX IF NOT EXISTS idx_sector_narratives_confidence
  ON sector_narratives (sector, confidence_score DESC);

COMMIT;
