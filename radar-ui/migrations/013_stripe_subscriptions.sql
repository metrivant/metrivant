-- ── Migration 013: Stripe Subscription State ─────────────────────────────────
--
-- Adds:
--   A. stripe_customer_id column to organizations (indexed, unique)
--   B. subscriptions table — single source of truth for Stripe subscription state
--
-- Run in Supabase SQL editor.

-- ── A. Stripe customer ID on organizations ────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS organizations_stripe_customer_id_idx
  ON organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ── B. Subscriptions ──────────────────────────────────────────────────────────
--
-- One row per Stripe subscription. Upserted on every relevant webhook event.
-- status mirrors Stripe subscription status values:
--   active, trialing, past_due, unpaid, canceled, incomplete, incomplete_expired

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT        NOT NULL UNIQUE,
  stripe_customer_id      TEXT        NOT NULL,
  status                  TEXT        NOT NULL,
  plan                    TEXT        NOT NULL DEFAULT 'analyst',
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN     NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_org_id_idx
  ON subscriptions (org_id);

CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx
  ON subscriptions (stripe_customer_id);

CREATE INDEX IF NOT EXISTS subscriptions_status_idx
  ON subscriptions (status);
