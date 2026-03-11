-- Prevent duplicate section_diffs rows for the same (page, type, previous_baseline)
-- triplet under concurrent cron executions or manual triggers.
--
-- Background: detect-diffs queries for an existing diff by (monitored_page_id,
-- section_type, previous_section_id) before inserting. Two concurrent invocations
-- can both find no existing row and each insert one, producing duplicates.
-- This constraint makes the second insert a no-op via ON CONFLICT DO NOTHING.
--
-- A (page, type, previous_section_id) triplet is naturally unique: there is only
-- one active baseline per (page, type) at any given time, and when the baseline
-- advances the new previous_section_id forms a distinct triplet.

ALTER TABLE section_diffs
  ADD CONSTRAINT section_diffs_page_type_previous_unique
  UNIQUE (monitored_page_id, section_type, previous_section_id);
