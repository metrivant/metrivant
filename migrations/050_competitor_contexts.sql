-- Migration 050: competitor_contexts
-- Persistent strategic intelligence context per competitor.
-- Updated by interpret-signals after each interpretation batch.
-- Read by interpret-signals as system context prefix before GPT-4o call.

CREATE TABLE IF NOT EXISTS competitor_contexts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id     UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL,
  competitor_name   TEXT NOT NULL,
  hypothesis        TEXT,                          -- current strategic hypothesis (1–2 sentences)
  confidence_level  TEXT NOT NULL DEFAULT 'low',  -- low | medium | high
  evidence_trail    JSONB NOT NULL DEFAULT '[]',  -- [{date, signal_type, summary, verdict: validates|contradicts|neutral}]
  open_questions    JSONB NOT NULL DEFAULT '[]',  -- [string]
  strategic_arc     TEXT,                          -- rolling 3-month summary
  signal_count      INTEGER NOT NULL DEFAULT 0,
  last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS competitor_contexts_competitor_id_idx
  ON competitor_contexts(competitor_id);

CREATE INDEX IF NOT EXISTS competitor_contexts_org_id_idx
  ON competitor_contexts(org_id);
