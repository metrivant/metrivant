-- =============================================================================
-- Migration: 061_sector_narratives_summary.sql
-- Purpose:   Add narrative_summary column to sector_narratives for GPT enrichment.
--
-- The promote-media-signals handler generates a 2-3 sentence narrative summary
-- per cluster using gpt-4o-mini. This column stores that AI-generated text.
-- The weekly brief pipeline uses narrative_summary (when available) instead of
-- raw theme_label for the Market Context section.
--
-- Safe: ALTER TABLE ADD COLUMN IF NOT EXISTS. Nullable. No existing data affected.
-- Apply via Supabase SQL editor.
-- =============================================================================

ALTER TABLE sector_narratives
  ADD COLUMN IF NOT EXISTS narrative_summary TEXT;

-- Track when the narrative was last enriched by GPT
ALTER TABLE sector_narratives
  ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMPTZ;
