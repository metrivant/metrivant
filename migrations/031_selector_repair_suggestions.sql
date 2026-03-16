-- Migration 031: Selector repair suggestions
--
-- Stores AI-proposed CSS selector fixes for operator review via Supabase table editor.
-- The deterministic pipeline is never modified automatically — proposals must be
-- manually accepted by the operator (copy proposed_selector → extraction_rules.selector).

CREATE TABLE IF NOT EXISTS selector_repair_suggestions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  monitored_page_id       UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  section_type            TEXT NOT NULL,

  previous_selector       TEXT NOT NULL,
  proposed_selector       TEXT NOT NULL,

  test_extraction_content TEXT,

  confidence              NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
  rationale               TEXT,

  snapshot_id             UUID REFERENCES snapshots(id) ON DELETE SET NULL,

  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- Operator review queue: filter status = 'pending'
CREATE INDEX IF NOT EXISTS idx_selector_repair_pending
  ON selector_repair_suggestions (monitored_page_id, section_type)
  WHERE status = 'pending';

-- Duplicate proposal guard: prevent re-proposing for already-pending/accepted pairs
CREATE INDEX IF NOT EXISTS idx_selector_repair_by_page_section
  ON selector_repair_suggestions (monitored_page_id, section_type, status);

COMMENT ON TABLE selector_repair_suggestions IS
  'AI-proposed CSS selector fixes for operator review. Never auto-applied to extraction_rules.';
COMMENT ON COLUMN selector_repair_suggestions.status IS
  'pending = awaiting review; accepted = operator manually updated extraction_rules; rejected = declined.';
COMMENT ON COLUMN selector_repair_suggestions.test_extraction_content IS
  'Content extracted by proposed_selector during validation — confirms selector targets correct content.';
