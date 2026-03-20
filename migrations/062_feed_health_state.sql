-- =============================================================================
-- Migration: 062_feed_health_state.sql
-- Purpose:   Add feed_health_state + last_health_check_at to competitor_feeds.
--
-- The check-feed-health weekly cron validates all feeds and writes health state.
-- Nullable — existing rows default to NULL (unknown until first check).
--
-- Safe: ADD COLUMN IF NOT EXISTS. Apply via Supabase SQL editor.
-- =============================================================================

ALTER TABLE competitor_feeds
  ADD COLUMN IF NOT EXISTS feed_health_state TEXT;

ALTER TABLE competitor_feeds
  ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ;
