-- =============================================================================
-- Migration 055: Fix signals constraints — cumulative careers + pool types
-- =============================================================================
--
-- Problem: migration 039 extended signals.signal_type and signals.source_type
-- for careers pool signals (hiring_spike, new_function, new_region, role_cluster;
-- source_type 'pool_event'). If migration 039 was only partially applied to the
-- signals table, promote-careers-signals fails on every insert with a CHECK
-- constraint violation serialised as "[object Object]" in pipeline_events.
--
-- This migration idempotently sets both constraints to the full cumulative
-- set from migrations 038–043. Safe to run even if 039 was fully applied.
--
-- Apply via Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- ── signals.signal_type — cumulative set through migration 043 ────────────────

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

-- ── signals.source_type — add 'pool_event' for careers pattern signals ────────
-- Migration 039 added this. Idempotent re-apply in case it was skipped.

ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_source_type_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_source_type_check
    CHECK (source_type IN ('page_diff', 'feed_event', 'pool_event'));

COMMIT;
