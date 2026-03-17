-- 046_discovery_candidates
--
-- Adds a write-only JSONB column to monitored_pages that preserves the full
-- ranked candidate list from onboarding discovery.
--
-- Shape (written by onboard-competitor, never read by runtime):
--   {
--     "discovered_at": "<ISO timestamp>",
--     "candidates": [
--       { "url": "...", "score": 0.85, "selected": true },
--       { "url": "...", "score": 0.60, "rejected": true, "reject_reason": "single_post" },
--       { "url": "...", "score": 0.40 }
--     ]
--   }
--
-- Purpose: operator audit trail for why a specific URL was chosen over alternatives.
-- Not used by any pipeline stage — purely observational metadata.

ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS discovery_candidates JSONB;
