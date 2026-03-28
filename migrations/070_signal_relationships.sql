-- Migration 070: Signal Causality Graph
-- Creates signal_relationships table to store cause→effect relationships between signals,
-- enabling strategic narrative synthesis from isolated point events.
--
-- Core insight: Sequences like hiring_spike → product_launch → price_change reveal
-- strategic intent (market expansion) that's invisible when signals are viewed atomically.
--
-- Applied: [pending]
-- Run this in Supabase SQL Editor

BEGIN;

-- Signal relationships table
CREATE TABLE IF NOT EXISTS signal_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source and target signals
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  related_signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,

  -- Relationship type
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('precursor', 'consequence', 'corroboration')),

  -- Confidence in this relationship (0.0-1.0)
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),

  -- Detection metadata
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detection_method TEXT NOT NULL DEFAULT 'template_match', -- 'template_match' | 'ai_validated'

  -- Template or reasoning that detected this relationship
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate relationships
  UNIQUE(signal_id, related_signal_id, relationship_type)
);

-- Indexes for relationship queries
CREATE INDEX IF NOT EXISTS idx_signal_relationships_signal_id
  ON signal_relationships(signal_id);

CREATE INDEX IF NOT EXISTS idx_signal_relationships_related_signal_id
  ON signal_relationships(related_signal_id);

CREATE INDEX IF NOT EXISTS idx_signal_relationships_type
  ON signal_relationships(relationship_type, confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_signal_relationships_detected_at
  ON signal_relationships(detected_at DESC);

-- Index for loading full causal chains per competitor
CREATE INDEX IF NOT EXISTS idx_signal_relationships_competitor_lookup
  ON signal_relationships(signal_id, detected_at DESC)
  WHERE confidence_score >= 0.6;

COMMENT ON TABLE signal_relationships IS
  'Stores cause→effect relationships between signals to enable strategic narrative synthesis. Populated by detect-signal-causality handler.';

COMMENT ON COLUMN signal_relationships.relationship_type IS
  'precursor: signal_id happened before and likely caused related_signal_id. consequence: signal_id is a result of related_signal_id. corroboration: both signals support the same strategic hypothesis.';

COMMENT ON COLUMN signal_relationships.confidence_score IS
  'Confidence in this relationship (0.0-1.0). Template matches start at 0.6-0.7, AI validation can increase to 0.8-0.95.';

COMMENT ON COLUMN signal_relationships.metadata IS
  'Detection context: template_name, time_gap_days, ai_reasoning, sector_context, etc.';

COMMIT;
