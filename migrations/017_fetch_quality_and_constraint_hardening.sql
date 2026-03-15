-- =============================================================================
-- Migration: 017_fetch_quality_and_constraint_hardening.sql
-- Purpose:   Three idempotent fixes:
--
--   1. snapshots.fetch_quality column — fetch-snapshots.ts has a TODO and a
--      42703 fallback since this column was not yet in the schema. Adding it
--      removes the fallback code path and allows shell-page detection metadata
--      to persist for pipeline-health diagnostics.
--
--   2. section_type constraints (safe re-apply of migration 014 step 1+2) —
--      adds 'headline' to the allowed list in page_sections and extraction_rules.
--      Idempotent: DROP CONSTRAINT IF EXISTS before ADD. Safe to apply even if
--      migration 014 was already applied.
--
--   3. section_diffs unique constraint (safe re-apply of migration 014 step 3) —
--      required by detect-diffs ON CONFLICT (monitored_page_id, section_type,
--      previous_section_id). Uses ctid-based dedup (UUID-safe) instead of
--      MIN(id) which fails for UUID primary keys.
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      All steps are idempotent. Safe to re-run.
-- =============================================================================

BEGIN;

-- ── 1. Add fetch_quality column to snapshots ──────────────────────────────────
--
-- 'full'  = normal page with meaningful content (≥3 text-bearing elements)
-- 'shell' = bot wall / JS-only shell / anti-scrape response (<3 elements)
--
-- Default 'full' is correct for all historical rows (fetched before this
-- observability column existed — assume normal unless flagged otherwise).

ALTER TABLE snapshots
  ADD COLUMN IF NOT EXISTS fetch_quality text NOT NULL DEFAULT 'full'
  CHECK (fetch_quality IN ('full', 'shell'));

-- ── 2. Fix page_sections section_type check constraint ────────────────────────
--
-- Adds 'headline' (h1/h2 extraction) which was missing from the original
-- constraint, causing extract-sections to fail with 23514 (Sentry NODE-7).

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

-- ── 3. Fix extraction_rules section_type check constraint ─────────────────────

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

-- ── 4. section_diffs dedup unique constraint ──────────────────────────────────
--
-- Required by detect-diffs ON CONFLICT (monitored_page_id, section_type,
-- previous_section_id). Without this, ON CONFLICT raises 42P10 (Sentry NODE-B).
--
-- Dedup using ctid (physical row pointer) — UUID-safe unlike MIN(id).
-- Keeps the earliest physical row per (page, section_type, previous_section_id).

DELETE FROM section_diffs a
USING section_diffs b
WHERE a.ctid > b.ctid
  AND a.monitored_page_id    = b.monitored_page_id
  AND a.section_type         = b.section_type
  AND a.previous_section_id  = b.previous_section_id
  AND a.previous_section_id IS NOT NULL;

ALTER TABLE section_diffs
  DROP CONSTRAINT IF EXISTS section_diffs_page_type_previous_unique;

ALTER TABLE section_diffs
  ADD CONSTRAINT section_diffs_page_type_previous_unique
  UNIQUE (monitored_page_id, section_type, previous_section_id);

COMMIT;
