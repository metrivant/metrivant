-- Migration 053: Hypothesis change alerting
--
-- Adds three columns to competitor_contexts to support strategy pivot detection.
-- When context-updater detects a significant hypothesis shift (Jaccard < 0.5),
-- it stores the old hypothesis and marks hypothesis_shift_alerted_at = NULL,
-- signalling check-signals to send a "Strategy Pivot Detected" email.
--
-- Apply in Supabase SQL Editor before deploying the alerting code.

ALTER TABLE public.competitor_contexts
  ADD COLUMN IF NOT EXISTS previous_hypothesis        TEXT,
  ADD COLUMN IF NOT EXISTS hypothesis_changed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hypothesis_shift_alerted_at TIMESTAMPTZ;

-- Partial index: only indexes rows that need alerting (tiny hot set)
CREATE INDEX IF NOT EXISTS competitor_contexts_hypothesis_shift_idx
  ON public.competitor_contexts (hypothesis_changed_at)
  WHERE hypothesis_shift_alerted_at IS NULL;
