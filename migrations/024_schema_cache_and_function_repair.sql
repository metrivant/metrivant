-- =============================================================================
-- Migration: 024_schema_cache_and_function_repair.sql
-- Purpose:   Fixes two active production errors (Sentry NODE-K and NODE-C):
--
--   1. build_section_baselines function ambiguity (NODE-K):
--      Migration 021 added build_section_baselines(batch_limit int DEFAULT 500).
--      The original 0-arg overload still exists, causing PostgREST to fail with
--      "Could not choose the best candidate function" on every build-baselines call.
--      Fix: drop the old 0-arg version, leaving only the new one.
--
--   2. PostgREST schema cache stale (NODE-C + NODE-E):
--      signals.competitor_id (added in migration 015) is not visible to PostgREST,
--      causing detect-signals to fail. Reload the schema cache to fix.
--      Also resolves NODE-1 (organizations table) and NODE-E (radar_feed all zero
--      downstream of NODE-C).
--
-- HOW TO APPLY: paste each block separately in the Supabase SQL editor.
-- All blocks are idempotent (safe to re-run).
-- =============================================================================


-- ============================================================
-- Block 1: Drop old 0-arg build_section_baselines overload
-- ============================================================
-- The migration 021 version takes (batch_limit int DEFAULT 500).
-- PostgREST cannot resolve ambiguity when both exist.
-- This drops only the 0-arg version — the new version remains.

DROP FUNCTION IF EXISTS public.build_section_baselines();


-- ============================================================
-- Block 2: Reload PostgREST schema cache
-- ============================================================
-- Forces PostgREST to re-introspect the Postgres schema.
-- Fixes NODE-C (signals.competitor_id), NODE-1 (organizations),
-- and unblocks NODE-E (radar_feed all-zero downstream of NODE-C).
-- Safe to run at any time — no data changes, no locks.

NOTIFY pgrst, 'reload schema';
