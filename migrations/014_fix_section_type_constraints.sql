-- Fix three production errors discovered via Sentry (2026-03-14):
--
-- 1. chk_section_type_page_sections (page_sections) — 'headline' not in allowed list
--    → extract-sections fails with 23514 (check constraint violation)
--
-- 2. chk_section_type (extraction_rules) — 'headline' not in allowed list
--    → onboard-competitor fails with 23514 (check constraint violation)
--
-- 3. section_diffs_page_type_previous_unique missing
--    → detect-diffs ON CONFLICT fails with 42P10 (no matching unique constraint)
--
-- All three changes are idempotent (DROP IF EXISTS before ADD).

-- ── 1. Fix page_sections section_type check constraint ────────────────────────
--
-- NOT VALID: adds constraint for future inserts without scanning existing rows.
-- Avoids spurious 23514 from concurrent pipeline activity during the scan.
-- VALIDATE CONSTRAINT runs as a separate step after NOT VALID succeeds.

ALTER TABLE page_sections
  DROP CONSTRAINT IF EXISTS chk_section_type_page_sections;

ALTER TABLE page_sections
  ADD CONSTRAINT chk_section_type_page_sections
  CHECK (section_type IN (
    'hero', 'headline', 'product_mentions',
    'pricing_plans', 'pricing_references',
    'release_feed', 'features_overview',
    'announcements', 'careers_feed'
  )) NOT VALID;

ALTER TABLE page_sections
  VALIDATE CONSTRAINT chk_section_type_page_sections;

-- ── 2. Fix extraction_rules section_type check constraint ─────────────────────

ALTER TABLE extraction_rules
  DROP CONSTRAINT IF EXISTS chk_section_type;

ALTER TABLE extraction_rules
  ADD CONSTRAINT chk_section_type
  CHECK (section_type IN (
    'hero', 'headline', 'product_mentions',
    'pricing_plans', 'pricing_references',
    'release_feed', 'features_overview',
    'announcements', 'careers_feed'
  )) NOT VALID;

ALTER TABLE extraction_rules
  VALIDATE CONSTRAINT chk_section_type;

-- ── 3. Ensure section_diffs dedup unique constraint exists ────────────────────
--
-- Required by detect-diffs ON CONFLICT (monitored_page_id, section_type,
-- previous_section_id). If duplicates exist from concurrent cron runs before
-- this constraint was in place, remove them first (keep lowest id per triplet).

DELETE FROM section_diffs sd
WHERE sd.id NOT IN (
  SELECT MIN(id)
  FROM section_diffs
  GROUP BY monitored_page_id, section_type, previous_section_id
);

ALTER TABLE section_diffs
  DROP CONSTRAINT IF EXISTS section_diffs_page_type_previous_unique;

ALTER TABLE section_diffs
  ADD CONSTRAINT section_diffs_page_type_previous_unique
  UNIQUE (monitored_page_id, section_type, previous_section_id);
