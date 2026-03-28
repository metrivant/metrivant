-- =============================================================================
-- METRIVANT SYSTEM REPAIR - COMPLETE FIX SCRIPT
-- Apply all critical fixes in one transaction
-- =============================================================================
--
-- This script addresses 3 critical issues found in system diagnostics:
--   1. Pool signals blocked (migration 060 constraint error)
--   2. Ancient signals stuck in pending (60+ days)
--   3. Zero pressure index on competitors with signals
--
-- Run time: ~5 seconds
-- Safe to run multiple times (idempotent)
-- Apply via Supabase SQL Editor
-- =============================================================================

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- FIX 1: Pool Signals Constraint (Migration 060 Corrected)
-- ═════════════════════════════════════════════════════════════════════════════
-- Unblocks 823 job_posting events waiting to become signals

-- Drop stale original constraints
ALTER TABLE signals DROP CONSTRAINT IF EXISTS chk_signal_type;
ALTER TABLE signals DROP CONSTRAINT IF EXISTS chk_source_type;

-- Drop and recreate migration-managed constraints with correct values
ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_signal_type_check;
ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_source_type_check;

-- Add signal_type constraint (full cumulative set from migrations 013-043)
ALTER TABLE signals
  ADD CONSTRAINT signals_signal_type_check
    CHECK (signal_type IN (
      -- Page diff signals
      'price_point_change', 'tier_change', 'feature_launch',
      'positioning_shift', 'content_change', 'hiring_surge',
      -- Newsroom feed signals
      'feed_press_release', 'feed_newsroom_post',
      -- Careers pool signals
      'hiring_spike', 'new_function', 'new_region', 'role_cluster',
      -- Investor pool signals
      'earnings_release', 'acquisition', 'divestiture', 'guidance_update',
      'major_contract', 'capital_raise', 'strategic_investment',
      'partnership', 'investor_presentation', 'other_investor_event',
      -- Product pool signals
      'major_release', 'feature_update', 'integration_release',
      'security_update', 'bugfix_release', 'api_change',
      'docs_update', 'deprecation', 'other_product_event',
      -- Procurement pool signals
      'major_contract_award', 'framework_award', 'tender_selection',
      'bid_notice', 'program_award', 'supplier_selection',
      'contract_extension', 'partner_award', 'other_procurement_event',
      -- Regulatory pool signals
      'material_event', 'acquisition_disclosure', 'major_contract_disclosure',
      'executive_change', 'regulatory_investigation', 'product_approval',
      'risk_disclosure', 'financial_disclosure', 'compliance_event',
      'other_regulatory_event'
    ));

-- Add source_type constraint (CORRECTED: includes 'pool_event')
ALTER TABLE signals
  ADD CONSTRAINT signals_source_type_check
    CHECK (source_type IN ('page_diff', 'feed_event', 'pool_event'));

RAISE NOTICE '[1/3] Pool signals constraint fixed - 823 events ready for promotion';

-- ═════════════════════════════════════════════════════════════════════════════
-- FIX 2: Stuck Signals (60+ days old, conf >= 0.65, never interpreted)
-- ═════════════════════════════════════════════════════════════════════════════
-- Resets retry state so interpret-signals cron picks them up

WITH reset_signals AS (
  UPDATE signals
  SET
    retry_count = 0,
    updated_at = NOW()
  WHERE
    status = 'pending'
    AND interpreted = false
    AND confidence_score >= 0.65
    AND detected_at < NOW() - INTERVAL '30 days'
    AND (updated_at IS NULL OR updated_at < NOW() - INTERVAL '24 hours')
  RETURNING id
)
SELECT RAISE(NOTICE, '[2/3] Reset % stuck signals for reprocessing', COUNT(*))
FROM reset_signals;

-- ═════════════════════════════════════════════════════════════════════════════
-- FIX 3: Zero Pressure Index (Competitors with signals but pressure=0)
-- ═════════════════════════════════════════════════════════════════════════════
-- Recalculates pressure using runtime formula

WITH signal_pressure AS (
  SELECT
    s.competitor_id,
    SUM(
      CASE s.severity
        WHEN 'critical' THEN 2.0
        WHEN 'high' THEN 1.5
        WHEN 'medium' THEN 1.0
        WHEN 'low' THEN 0.5
        ELSE 1.0
      END
      * s.confidence_score
      * EXP(-EXTRACT(EPOCH FROM (NOW() - s.detected_at)) / (24.0 * 3600.0) * 0.2)
    ) as calculated_pressure
  FROM signals s
  WHERE
    s.status = 'interpreted'
    AND s.detected_at > NOW() - INTERVAL '30 days'
  GROUP BY s.competitor_id
),
updated_competitors AS (
  UPDATE competitors c
  SET
    pressure_index = LEAST(10.0, GREATEST(0.0, sp.calculated_pressure)),
    updated_at = NOW()
  FROM signal_pressure sp
  WHERE
    c.id = sp.competitor_id
    AND (c.pressure_index IS NULL OR c.pressure_index = 0.0)
    AND sp.calculated_pressure > 0.01
  RETURNING c.id
)
SELECT RAISE(NOTICE, '[3/3] Updated pressure index for % competitors', COUNT(*))
FROM updated_competitors;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (Run separately to confirm fixes)
-- ═════════════════════════════════════════════════════════════════════════════

-- Verify constraint includes 'pool_event'
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname = 'signals_source_type_check';
-- Expected: CHECK ((source_type = ANY (ARRAY['page_diff'::text, 'feed_event'::text, 'pool_event'::text])))

-- Verify stuck signals were reset
-- SELECT COUNT(*) FROM signals
-- WHERE status='pending' AND interpreted=false AND detected_at < NOW() - INTERVAL '30 days';
-- Expected: Should decrease to near-zero after next interpret-signals run

-- Verify pressure index updated
-- SELECT COUNT(*) FROM competitors WHERE pressure_index > 0;
-- Expected: Should match number of competitors with interpreted signals
