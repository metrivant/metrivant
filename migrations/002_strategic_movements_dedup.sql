-- Remove duplicate strategic_movements rows, keeping the most recently updated per
-- (competitor_id, movement_type). Required before adding the unique constraint.
DELETE FROM strategic_movements
WHERE id NOT IN (
  SELECT DISTINCT ON (competitor_id, movement_type) id
  FROM strategic_movements
  ORDER BY competitor_id, movement_type, last_seen_at DESC NULLS LAST
);

-- Enforce one active movement record per competitor per movement type.
-- detect-movements.ts upserts on this constraint every cycle.
ALTER TABLE strategic_movements
  ADD CONSTRAINT strategic_movements_competitor_type_unique
  UNIQUE (competitor_id, movement_type);
