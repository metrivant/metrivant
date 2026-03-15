-- =============================================================================
-- Migration: 016_fix_signals_status_constraint.sql
-- Purpose:   Fix chk_signals_status constraint to include 'pending_review'.
--
-- Root cause (NODE-C Sentry, 2026-03-15):
--   The live DB has a constraint named 'chk_signals_status' that was created
--   before 'pending_review' was added as a valid status in migration 008
--   (Intelligence Cadence). This constraint only allows a subset of the values
--   the code now writes, causing:
--     "new row for relation "signals" violates check constraint "chk_signals_status""
--   on every detect-signals run that produces a pending_review signal.
--
--   Migration 010 added 'signals_status_check' (different name, correct values)
--   but the older 'chk_signals_status' constraint was not removed, so both
--   constraints co-exist and the stricter one blocks inserts.
--
-- Fix: Drop the stale chk_signals_status constraint and ensure
--   signals_status_check covers all valid values.
-- =============================================================================

BEGIN;

-- Drop the stale constraint that excludes 'pending_review'.
ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS chk_signals_status;

-- Ensure the correct constraint exists with all valid values.
-- This is idempotent: migration 010 already adds signals_status_check,
-- but we re-create it here to guarantee the allowed set is correct.
ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_status_check;

ALTER TABLE signals
  ADD CONSTRAINT signals_status_check
    CHECK (status IN ('pending', 'pending_review', 'in_progress', 'interpreted', 'failed'));

COMMIT;
