-- Migration: 051_security_hardening.sql
-- Purpose: Remediate Supabase security warnings.
--   1. Enable RLS on public.interpretations (currently disabled)
--   2. Revoke broad anon/authenticated SELECT on Security Definer views that are
--      never queried by anon/authenticated roles — only the service-role accesses them.
--
-- Access audit (verified against codebase 2026-03-18):
--   interpretations      → lib/supabase.ts (service-role only, 6 api/ handlers)
--   radar_feed           → not queried via Supabase at all; radar-ui uses runtime API
--   competitor_velocity_7d, latest_snapshots, latest_two_snapshots,
--   pipeline_backlog, pipeline_counts, pipeline_health
--                        → no .from() queries anywhere in codebase
--
-- Service-role bypasses RLS and REVOKE; no policies are needed for backend access.
-- No application code paths are broken by these changes.

-- ── Part A: Enable RLS on interpretations ─────────────────────────────────────
-- Resolves: "RLS Disabled on public.interpretations"
-- No SELECT policy added — service-role bypasses RLS by default.
-- If a future feature needs authenticated-role read access, add a policy at that time.

ALTER TABLE public.interpretations ENABLE ROW LEVEL SECURITY;

-- ── Part B: Revoke anon/authenticated SELECT on Security Definer views ─────────
-- Resolves: "Security Definer View" warnings for all six views.
-- These views were created without explicit security_invoker = true, so Postgres
-- defaults to SECURITY DEFINER (view runs as the defining role, bypassing RLS on
-- underlying tables). Since no anon/authenticated code ever queries these views,
-- revoking their access eliminates the attack surface without any functional impact.
--
-- Service-role is unaffected by REVOKE (superuser/service-role ignores privilege checks).

REVOKE SELECT ON public.competitor_velocity_7d   FROM anon, authenticated;
REVOKE SELECT ON public.latest_snapshots          FROM anon, authenticated;
REVOKE SELECT ON public.latest_two_snapshots      FROM anon, authenticated;
REVOKE SELECT ON public.pipeline_backlog          FROM anon, authenticated;
REVOKE SELECT ON public.pipeline_counts           FROM anon, authenticated;
REVOKE SELECT ON public.pipeline_health           FROM anon, authenticated;
REVOKE SELECT ON public.radar_feed                FROM anon, authenticated;
