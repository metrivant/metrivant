-- Migration 068: Autonomous Noise Detection Metadata
-- Adds noise_metadata column to track detection reasoning for ops visibility

-- Add metadata column to section_diffs for noise detection details
ALTER TABLE section_diffs
  ADD COLUMN IF NOT EXISTS noise_metadata JSONB;

COMMENT ON COLUMN section_diffs.noise_metadata IS 'Metadata from autonomous noise detection (similarity scores, correlation counts, etc.) for ops dashboard visibility';

-- Create index for ops dashboard queries filtering by noise reason
CREATE INDEX IF NOT EXISTS idx_section_diffs_noise_reason
  ON section_diffs(noise_reason)
  WHERE is_noise = true;

-- Create index for ops dashboard to analyze noise patterns
CREATE INDEX IF NOT EXISTS idx_section_diffs_is_noise_created
  ON section_diffs(is_noise, created_at DESC);
