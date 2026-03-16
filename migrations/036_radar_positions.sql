-- ── 036_radar_positions — Temporal trail storage ──────────────────────────────
--
-- Stores computed SVG node positions for the temporal movement trail feature.
-- Populated by radar-ui after each layout computation (max once per 6h per org).
-- Coordinate space: SVG user units matching radar viewBox 0 0 1000 1000.
-- Retention: 28 days (purged by retention cron — see retention-config.ts).
--
-- Query pattern (radar-feed Step 7.5):
--   SELECT competitor_id, x, y, created_at
--   FROM   radar_positions
--   WHERE  org_id = $1
--     AND  competitor_id = ANY($2)
--     AND  created_at >= NOW() - INTERVAL '28 days'
--   ORDER  BY competitor_id, created_at DESC;

CREATE TABLE IF NOT EXISTS radar_positions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id  UUID        NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  org_id         UUID        NOT NULL,
  x              NUMERIC     NOT NULL CHECK (x >= 0 AND x <= 1000),
  y              NUMERIC     NOT NULL CHECK (y >= 0 AND y <= 1000),
  pressure_index NUMERIC     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary access: trail assembly per org+competitor (newest-first)
CREATE INDEX IF NOT EXISTS idx_radar_positions_org_comp_time
  ON radar_positions (org_id, competitor_id, created_at DESC);

-- Retention sweep by age
CREATE INDEX IF NOT EXISTS idx_radar_positions_created_at
  ON radar_positions (created_at);
