-- Migration 035: Weekly briefs orchestrator columns
--
-- Adds structured artifact columns to weekly_briefs so the orchestrator
-- can store pre-generated intelligence alongside the assembled BriefContent.
--
-- sector_summary  — copied from sector_intelligence.summary (latest within 7d)
-- movements       — MovementArtifact[] used as prompt input and stored for auditing
-- activity        — ActivityArtifact[] (latest radar_narratives per competitor)
-- brief_markdown  — deterministic markdown rendering of BriefContent (email-friendly)
--
-- The existing `content` column (BriefContent JSON) and `signal_count` column
-- are preserved unchanged for backwards compatibility with the briefs UI.

ALTER TABLE weekly_briefs
  ADD COLUMN IF NOT EXISTS sector_summary TEXT,
  ADD COLUMN IF NOT EXISTS movements      JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS activity       JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS brief_markdown TEXT;

COMMENT ON COLUMN weekly_briefs.sector_summary IS
  'Copied from sector_intelligence.summary — cross-competitor sector analysis paragraph.';
COMMENT ON COLUMN weekly_briefs.movements IS
  'Array of {competitor_name, movement_type, movement_summary, strategic_implication, confidence_level} — movement artifacts used as prompt input.';
COMMENT ON COLUMN weekly_briefs.activity IS
  'Array of {competitor_name, narrative, signal_count} — latest radar narrative per competitor.';
COMMENT ON COLUMN weekly_briefs.brief_markdown IS
  'Deterministic markdown rendering of brief content. Suitable for email plain-text fallback and LLM context.';
