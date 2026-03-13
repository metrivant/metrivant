-- ── Migration 015: Clean State + RLS Repair ───────────────────────────────────
--
-- 1. Ensures tracked_competitors UPDATE RLS policy exists (idempotent).
--    Migration 011 added this but may not have been applied to production.
--    Supabase upsert with onConflict requires this policy to resolve conflicts.
--
-- 2. Removes test competitors (Linear, Monday, Airtable, Asana, ClickUp, Coda)
--    from tracked_competitors across all orgs.
--
-- Run this in the Supabase SQL editor.

-- ── 1. tracked_competitors UPDATE RLS policy (idempotent) ─────────────────────

DO $$ BEGIN
  CREATE POLICY "tracked competitors org member update"
    ON tracked_competitors FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = tracked_competitors.org_id
          AND o.owner_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = tracked_competitors.org_id
          AND o.owner_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ── 2. Remove test competitors ─────────────────────────────────────────────────

DELETE FROM tracked_competitors
WHERE LOWER(name) IN (
  'linear',
  'monday',
  'monday.com',
  'airtable',
  'asana',
  'clickup',
  'coda'
);
