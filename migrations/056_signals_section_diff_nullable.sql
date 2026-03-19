-- =============================================================================
-- Migration 056: Make signals.section_diff_id nullable + cumulative constraints
-- =============================================================================
--
-- Problem: signals.section_diff_id was created NOT NULL in the original manual
-- table setup before migrations were introduced. Migration 013 defined it as
-- nullable (no NOT NULL), but CREATE TABLE IF NOT EXISTS was skipped because
-- the table already existed — so the NOT NULL constraint was never dropped.
--
-- Pool event signals (careers, investor, product, regulatory) have no
-- section_diff_id — they originate from feeds, not page diffs. promote-careers-
-- signals (and all future pool promote handlers) set section_diff_id: null,
-- which hits the NOT NULL constraint with error code 23502, silently blocking
-- every pool signal insert.
--
-- This migration also idempotently re-applies the cumulative signal_type and
-- source_type CHECK constraints from migration 055, so both issues are resolved
-- in a single SQL Editor paste. Safe to run even if 055 was already applied.
--
-- Apply via Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- ── Drop NOT NULL on section_diff_id ─────────────────────────────────────────
-- Pool event signals (careers, investor, product, regulatory) have no diff.
-- Page-diff signals continue to set this — no data loss, no behavior change.

ALTER TABLE signals
  ALTER COLUMN section_diff_id DROP NOT NULL;

-- ── signals.signal_type — cumulative set through migration 043 ────────────────
-- Idempotent: safe to re-run if migration 055 was already applied.

ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_signal_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_signal_type_check
    CHECK (signal_type IN (
      -- Page diff signals (original pipeline)
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
      'other_investor_event',
      -- Product pool signals (migration 041)
      'major_release',
      'feature_update',
      'integration_release',
      'security_update',
      'bugfix_release',
      'api_change',
      'docs_update',
      'deprecation',
      'other_product_event',
      -- Procurement pool signals (migration 042)
      'major_contract_award',
      'framework_award',
      'tender_selection',
      'bid_notice',
      'program_award',
      'supplier_selection',
      'contract_extension',
      'partner_award',
      'other_procurement_event',
      -- Regulatory pool signals (migration 043)
      'material_event',
      'acquisition_disclosure',
      'major_contract_disclosure',
      'executive_change',
      'regulatory_investigation',
      'product_approval',
      'risk_disclosure',
      'financial_disclosure',
      'compliance_event',
      'other_regulatory_event'
    ));

-- ── signals.source_type — cumulative set through migration 039 ────────────────
-- Idempotent: safe to re-run if migration 055 was already applied.

ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_source_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_source_type_check
    CHECK (source_type IN ('page_diff', 'feed_event', 'pool_event'));

COMMIT;
