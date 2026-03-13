-- 014_subscriptions_user_id
-- Adds user_id column to subscriptions table so payment failure
-- emails and PostHog events can be resolved without a separate
-- Stripe metadata lookup.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Backfill from Stripe metadata is handled application-side via
-- syncSubscription() which includes user_id in the upsert once
-- this column exists.
