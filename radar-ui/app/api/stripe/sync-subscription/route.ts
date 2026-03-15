// ── /api/stripe/sync-subscription ────────────────────────────────────────────
// POST — authenticated user only.
//
// Fallback recovery for when the Stripe webhook failed to write the subscription
// row or update user_metadata.plan. Called by the UI when:
//   1. User returns from checkout with ?checkout=success but hasActiveSub is false
//   2. Trial lock screen is shown despite the user having paid
//
// Resolution order:
//   1. Auth check — must have a valid session
//   2. Resolve org by owner_id
//   3. If org has stripe_customer_id → list Stripe subscriptions
//   4. If no stripe_customer_id → search Stripe customers by email, update org, then list
//   5. On match → upsert subscriptions row + update user_metadata.plan
//   6. Return { ok, synced, plan, status } or { ok, synced: false }

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient }        from "../../../../lib/supabase/server";
import { createServiceClient } from "../../../../lib/supabase/service";
import { getStripe }           from "../../../../lib/stripe";
import { captureException }    from "../../../../lib/sentry";

type ServiceClient = ReturnType<typeof createServiceClient>;

// ── Upsert a subscription row — mirrors syncSubscription in webhook/route.ts ─

async function upsertSubscription(
  service:      ServiceClient,
  subscription: Stripe.Subscription,
  plan:         "analyst" | "pro",
  orgId:        string,
  customerId:   string,
): Promise<boolean> {
  // In API 2026-02-25.clover, current_period_end moved to items.data[0].current_period_end
  const periodEndTs      = subscription.items?.data?.[0]?.current_period_end;
  const currentPeriodEnd = periodEndTs
    ? new Date(periodEndTs * 1000).toISOString()
    : null;

  const row = {
    org_id:                 orgId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id:     customerId,
    status:                 subscription.status,
    plan,
    current_period_end:     currentPeriodEnd,
    cancel_at_period_end:   subscription.cancel_at_period_end,
    updated_at:             new Date().toISOString(),
  };

  const { error } = await service
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });

  if (error) {
    captureException(new Error("sync-subscription: failed to upsert subscription"), {
      subscription_id: subscription.id,
      org_id:          orgId,
      error_message:   error.message,
    });
    return false;
  }

  return true;
}

// ── Determine plan from subscription metadata ─────────────────────────────────

function resolvePlan(subscription: Stripe.Subscription): "analyst" | "pro" {
  const raw = subscription.metadata?.plan ?? "analyst";
  return raw === "pro" ? "pro" : "analyst";
}

// ── Find the best subscription from a list ───────────────────────────────────
// Prefers active/trialing, then falls back to most recent by created timestamp.

function pickSubscription(
  subs: Stripe.Subscription[],
): Stripe.Subscription | null {
  if (subs.length === 0) return null;

  // Prefer definitively active or trialing
  const active = subs.find(
    (s) => s.status === "active" || s.status === "trialing"
  );
  if (active) return active;

  // Fall back to most recently created
  return subs.reduce((best, s) => (s.created > best.created ? s : best));
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  // ── 1. Auth check ─────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const stripe  = getStripe();

  try {
    // ── 2. Resolve org ──────────────────────────────────────────────────────
    const { data: orgRows, error: orgError } = await service
      .from("organizations")
      .select("id, stripe_customer_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (orgError) {
      captureException(new Error("sync-subscription: org lookup error"), {
        user_id:       user.id,
        error_message: orgError.message,
      });
      return NextResponse.json(
        { error: "Failed to resolve organization" },
        { status: 500 }
      );
    }

    const org = orgRows?.[0] ?? null;

    if (!org?.id) {
      // No org at all — nothing to sync
      return NextResponse.json({ ok: true, synced: false });
    }

    const orgId = org.id as string;
    let stripeCustomerId = (org.stripe_customer_id as string | null) ?? null;

    // ── 3. If no stripe_customer_id, search by email ────────────────────────
    if (!stripeCustomerId) {
      const userEmail = user.email;
      if (!userEmail) {
        return NextResponse.json({ ok: true, synced: false });
      }

      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      const customer = customers.data[0] ?? null;

      if (!customer) {
        // No Stripe customer for this email — nothing to sync
        return NextResponse.json({ ok: true, synced: false });
      }

      stripeCustomerId = customer.id;

      // Back-fill stripe_customer_id on the org so future webhooks resolve correctly
      const { error: updateError } = await service
        .from("organizations")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", orgId);

      if (updateError) {
        // Non-fatal — continue with sync attempt
        captureException(
          new Error("sync-subscription: failed to backfill stripe_customer_id"),
          { org_id: orgId, customer_id: stripeCustomerId }
        );
      }
    }

    // ── 4. List active subscriptions for this customer ──────────────────────
    let allSubs: Stripe.Subscription[] = [];

    const activeSubs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status:   "active",
      limit:    5,
    });

    allSubs = activeSubs.data;

    // If no active subs, widen to all statuses and take the most recent
    if (allSubs.length === 0) {
      const allSubsResult = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status:   "all",
        limit:    5,
      });
      allSubs = allSubsResult.data;
    }

    const subscription = pickSubscription(allSubs);

    if (!subscription) {
      // Customer exists but has no subscriptions
      return NextResponse.json({ ok: true, synced: false });
    }

    const plan = resolvePlan(subscription);

    // ── 5. Upsert subscription row ──────────────────────────────────────────
    await upsertSubscription(
      service,
      subscription,
      plan,
      orgId,
      stripeCustomerId
    );

    // ── 6. Update org stripe_customer_id (if we already have it, this is a no-op) ─
    await service
      .from("organizations")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", orgId);

    // ── 7. Update user_metadata.plan ───────────────────────────────────────
    const { error: metaError } = await service.auth.admin.updateUserById(
      user.id,
      { user_metadata: { plan } }
    );

    if (metaError) {
      captureException(
        new Error("sync-subscription: failed to update user_metadata.plan"),
        { user_id: user.id, plan, error_message: metaError.message }
      );
      // Non-fatal — subscription row was written, UI will pick up on next load
    }

    return NextResponse.json({
      ok:     true,
      synced: true,
      plan,
      status: subscription.status,
    });
  } catch (err) {
    captureException(
      err instanceof Error ? err : new Error(String(err)),
      { route: "stripe/sync-subscription", user_id: user.id }
    );
    return NextResponse.json(
      { error: "Internal error during subscription sync" },
      { status: 500 }
    );
  }
}
