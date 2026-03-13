// ── Subscription state helper ─────────────────────────────────────────────────
//
// Queries Supabase for the user's active subscription and derives a clean
// billing state. Used by both /app (trial gate) and /app/billing (status display).
//
// Priority:  subscriptions table  →  trial window  →  expired

import type { SupabaseClient } from "@supabase/supabase-js";

export const TRIAL_DAYS = 3;

export type SubStatus =
  | "trial"           // within 3-day window, no subscription
  | "active"          // paid, renewing
  | "canceled_active" // canceled but access continues until period end
  | "past_due"        // payment failed, still technically active
  | "expired";        // no subscription, trial over

export type SubState = {
  plan:              "analyst" | "pro";
  status:            SubStatus;
  currentPeriodEnd:  string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId:  string | null;
};

export async function getSubscriptionState(
  supabase: SupabaseClient,
  orgId:         string,
  userCreatedAt: string,
): Promise<SubState> {
  const trialEnd = new Date(userCreatedAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const inTrial  = Date.now() < trialEnd;

  // ── Stripe customer ID ─────────────────────────────────────────────────────
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", orgId)
    .limit(1)
    .maybeSingle();

  const stripeCustomerId = (orgRow?.stripe_customer_id as string | null) ?? null;

  // ── Most recent subscription for this org ──────────────────────────────────
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return {
      plan:              "analyst",
      status:            inTrial ? "trial" : "expired",
      currentPeriodEnd:  null,
      cancelAtPeriodEnd: false,
      stripeCustomerId,
    };
  }

  const plan             = ((sub.plan as string) === "pro" ? "pro" : "analyst") as "analyst" | "pro";
  const periodEnd        = sub.current_period_end
    ? new Date(sub.current_period_end as string).getTime()
    : 0;
  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
  const now              = Date.now();

  switch (sub.status as string) {
    case "active":
    case "trialing":
      return {
        plan,
        status:            cancelAtPeriodEnd ? "canceled_active" : "active",
        currentPeriodEnd:  (sub.current_period_end as string | null) ?? null,
        cancelAtPeriodEnd,
        stripeCustomerId,
      };

    case "past_due":
    case "unpaid":
      return {
        plan,
        status:            "past_due",
        currentPeriodEnd:  (sub.current_period_end as string | null) ?? null,
        cancelAtPeriodEnd: false,
        stripeCustomerId,
      };

    case "canceled":
    case "incomplete_expired":
      // Access continues until period end
      if (periodEnd > now) {
        return {
          plan,
          status:            "canceled_active",
          currentPeriodEnd:  (sub.current_period_end as string | null) ?? null,
          cancelAtPeriodEnd: true,
          stripeCustomerId,
        };
      }
      // Period has passed — fall to trial/expired
      return {
        plan:              "analyst",
        status:            inTrial ? "trial" : "expired",
        currentPeriodEnd:  null,
        cancelAtPeriodEnd: false,
        stripeCustomerId,
      };

    default:
      return {
        plan:              "analyst",
        status:            inTrial ? "trial" : "expired",
        currentPeriodEnd:  null,
        cancelAtPeriodEnd: false,
        stripeCustomerId,
      };
  }
}
