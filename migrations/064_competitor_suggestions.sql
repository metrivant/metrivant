-- =============================================================================
-- Migration: 064_competitor_suggestions.sql
-- Purpose:   Auto-discovered competitor suggestions from media observations.
--
-- Weekly cron extracts company names from media articles, scores them,
-- and auto-accepts (triggers onboarding) or auto-rejects based on score.
--
-- Safe: CREATE TABLE IF NOT EXISTS. Apply via Supabase SQL editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS competitor_suggestions (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Entity extracted from media
  company_name        TEXT        NOT NULL,
  domain              TEXT,          -- discovered website URL (may be null)
  sector              TEXT        NOT NULL,
  -- Evidence
  article_count       INTEGER     NOT NULL DEFAULT 0,
  source_count        INTEGER     NOT NULL DEFAULT 0,
  representative_urls TEXT[]      NOT NULL DEFAULT '{}',
  first_seen_at       TIMESTAMPTZ NOT NULL,
  last_seen_at        TIMESTAMPTZ NOT NULL,
  -- Scoring
  relevance_score     NUMERIC     NOT NULL DEFAULT 0,  -- 0.0–1.0
  score_breakdown     JSONB,                            -- { article_weight, source_weight, recency_weight, ... }
  -- Decision
  status              TEXT        NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  decision_reason     TEXT,
  -- If accepted, link to created competitor
  competitor_id       UUID,
  PRIMARY KEY (id),
  CONSTRAINT competitor_suggestions_name_sector_unique
    UNIQUE (company_name, sector)
);

CREATE INDEX IF NOT EXISTS idx_comp_suggestions_status
  ON competitor_suggestions (status, relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_comp_suggestions_sector
  ON competitor_suggestions (sector, last_seen_at DESC);
