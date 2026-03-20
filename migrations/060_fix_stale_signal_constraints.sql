-- =============================================================================
-- Migration 060: Fix stale signal CHECK constraints blocking pool signals
-- =============================================================================
--
-- Root cause: Two CHECK constraints exist on signals.signal_type:
--   1. chk_signal_type         — original, predates migration system (STALE)
--   2. signals_signal_type_check — migration-managed (correct but shadowed)
--
-- The stale chk_signal_type was never dropped by migrations 038–056 because
-- they target signals_signal_type_check by name. PostgreSQL enforces ALL
-- CHECK constraints — so even though the migration-managed constraint allows
-- hiring_spike, the stale one rejects it with error 23514.
--
-- Impact: ALL pool promote handlers (careers, investor, product, procurement,
-- regulatory) fail on signal insert. 862+ pending pool events are stuck.
--
-- Fix: Drop both constraints, re-add the single correct one.
-- Apply via Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- ── Drop stale original constraint ──────────────────────────────────────────
ALTER TABLE signals DROP CONSTRAINT IF EXISTS chk_signal_type;

-- ── Drop migration-managed constraint (idempotent re-create) ────────────────
ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_signal_type_check;

-- ── Re-add with full cumulative signal_type set (migrations 013–043) ────────
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

-- ── Also fix stale source_type constraint if present ────────────────────────
ALTER TABLE signals DROP CONSTRAINT IF EXISTS chk_source_type;
ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_source_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_source_type_check
    CHECK (source_type IN ('page_diff', 'feed_event'));

COMMIT;
