-- ── 000_initial_schema.sql ───────────────────────────────────────────────────
-- Captured from live Supabase instance on 2026-03-14.
--
-- IMPORTANT: This file documents the radar_feed view as it exists in the live
-- database. It is NOT the authoritative data source for the radar UI.
--
-- The UI calls metrivant-runtime.vercel.app/api/radar-feed which runs its own
-- query against the pipeline tables (signals, strategic_movements, etc.).
-- This view is a simplified stub that only joins tracked_competitors with
-- competitor_momentum and hardcodes signal/movement fields as NULL/0.
--
-- This file exists solely as a disaster-recovery reference. If the Supabase
-- project is ever rebuilt from scratch, run this first, then run migrations
-- 001 through 012 (pipeline) and radar-ui/001 through radar-ui/018 (SaaS).
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTE: The core pipeline tables (competitors, monitored_pages, snapshots,
-- page_sections, section_baselines, section_diffs, signals, interpretations,
-- strategic_movements, extraction_rules) have NO CREATE TABLE migration.
-- They were created directly in Supabase and must be recreated manually from
-- the live schema if the project is ever torn down.
-- Run: SELECT * FROM information_schema.columns WHERE table_schema = 'public'
-- ORDER BY table_name, ordinal_position;
-- to capture the full live schema before any destructive operation.

CREATE OR REPLACE VIEW radar_feed AS
SELECT tc.org_id,
    tc.id AS competitor_id,
    tc.name AS competitor_name,
    tc.website_url,
    (COALESCE(cm.momentum_score, (0)::numeric))::numeric(8,3) AS momentum_score,
    COALESCE(cm.momentum_state, 'cooling'::text) AS momentum_state,
    0 AS signals_7d,
    (0)::numeric(8,3) AS weighted_velocity_7d,
    NULL::timestamp with time zone AS last_signal_at,
    NULL::text AS latest_movement_type,
    NULL::numeric(4,3) AS latest_movement_confidence,
    NULL::integer AS latest_movement_signal_count,
    NULL::numeric(8,3) AS latest_movement_velocity,
    NULL::timestamp with time zone AS latest_movement_first_seen_at,
    NULL::timestamp with time zone AS latest_movement_last_seen_at,
    NULL::text AS latest_movement_summary
   FROM (tracked_competitors tc
     LEFT JOIN competitor_momentum cm ON (((cm.org_id = tc.org_id) AND (cm.competitor_id = tc.id))));
