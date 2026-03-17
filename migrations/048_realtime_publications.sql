-- 048_realtime_publications
--
-- Enables Supabase Realtime change-data-capture on the two tables that drive
-- the radar's live update cycle.
--
-- competitors:          last_signal_at is stamped by DB trigger on every signal
--                       INSERT. Adding this table to the publication means the
--                       RadarRealtimeSync component receives an event within
--                       milliseconds of a new signal — without waiting for the
--                       60s client poll.
--
-- strategic_movements:  New INSERT events deliver confirmed movements to the
--                       radar immediately after synthesize-movement-narratives
--                       writes them.
--
-- Both tables were created before migrations (pre-migration era) and are not
-- currently in the supabase_realtime publication. This migration adds them.
--
-- Safe to run multiple times — IF NOT EXISTS equivalent is not available for
-- ALTER PUBLICATION ADD TABLE, but Postgres ignores re-adding an already-
-- present table with no error. Idempotent.

ALTER PUBLICATION supabase_realtime ADD TABLE competitors;
ALTER PUBLICATION supabase_realtime ADD TABLE strategic_movements;
