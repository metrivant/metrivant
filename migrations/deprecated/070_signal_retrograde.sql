-- Migration 070: Signal Retrograde Tracking
-- Adds retrograded_at timestamp to track signals downgraded due to hallucinated interpretations

-- Add retrograded_at column to signals
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS retrograded_at TIMESTAMPTZ;

COMMENT ON COLUMN signals.retrograded_at IS 'Timestamp when signal confidence was retroactively reduced due to hallucinated interpretation; prevents re-interpretation';

-- Index for retrograde-signals handler queries
CREATE INDEX IF NOT EXISTS idx_signals_retrograded
  ON signals(retrograded_at)
  WHERE retrograded_at IS NOT NULL;

-- Index for interpret-signals exclusion filter
CREATE INDEX IF NOT EXISTS idx_signals_pending_not_retrograded
  ON signals(status, retrograded_at)
  WHERE status = 'pending' AND retrograded_at IS NULL;

-- Update claim_pending_signals RPC to exclude retrograded signals
CREATE OR REPLACE FUNCTION claim_pending_signals(batch_size integer DEFAULT 5)
RETURNS TABLE(id uuid, signal_type text, retry_count integer) AS $$
BEGIN
  RETURN QUERY
  UPDATE signals s
  SET
    status     = 'in_progress',
    updated_at = now()
  FROM (
    SELECT s2.id
    FROM signals s2
    WHERE
      s2.status         = 'pending'
      AND s2.interpreted   = false
      AND s2.retrograded_at IS NULL  -- Exclude retrograded signals (Phase 3: validation feedback)
    ORDER BY s2.detected_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ) claimed
  WHERE s.id = claimed.id
  RETURNING s.id, s.signal_type, s.retry_count;
END;
$$ LANGUAGE plpgsql;
