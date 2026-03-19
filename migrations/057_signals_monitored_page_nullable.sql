-- Migration 057: signals.monitored_page_id DROP NOT NULL
--
-- Pool signals (source_type='feed_event') have no monitored page context —
-- the contextPageMap lookup returns null when a competitor lacks a page of
-- the expected type. The NOT NULL constraint causes error 23502 on every
-- promote handler insert, blocking ALL pool signal production.
--
-- FK constraint preserved: non-null values must still reference monitored_pages(id).
-- Idempotent: safe to re-run.

ALTER TABLE signals ALTER COLUMN monitored_page_id DROP NOT NULL;
