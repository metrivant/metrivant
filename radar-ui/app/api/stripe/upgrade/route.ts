// ── /api/stripe/upgrade ───────────────────────────────────────────────────────
// POST — authenticated users with an active Analyst subscription only.
// Updates the existing subscription to Pro via proration.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "../../../../lib/supabase/server";
import { createServiceClient } from "../../../../lib/supabase/service";
import { getStripe, getPriceId } from "../../../../lib/stripe";
import { captureException } from "../../../../lib/sentry";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com").trim();

export async function POST(): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Resolve org + subscription ────────────────────────────────────────────
  const { data: orgRows } = await supabase
    .from("organizations")
    .select("id, stripe_customer_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const org = orgRows?.[0] ?? null;
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: subRows } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, plan, status")
    .eq("org_id", org.id)
    .in("status", ["active", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(1);

  const sub = subRows?.[0] ?? null;

  if (!sub?.stripe_subscription_id) {
    // No active subscription — fall back to checkout
    return NextResponse.redirect(`${SITE_URL}/api/stripe/checkout`, { status: 303 });
  }

  if (sub.plan === "pro") {
    // Already Pro — redirect to billing
    return NextResponse.redirect(`${SITE_URL}/app/billing`, { status: 303 });
  }

  // ── Retrieve subscription from Stripe ─────────────────────────────────────
  let stripeSub: Stripe.Subscription;
  try {
    stripeSub = await getStripe().subscriptions.retrieve(sub.stripe_subscription_id as string);
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route: "stripe/upgrade", user_id: user.id,
    });
    return NextResponse.json({ error: "Failed to retrieve subscription" }, { status: 500 });
  }

  // ── Get Pro price ID ──────────────────────────────────────────────────────
  let priceId: string;
  try {
    priceId = getPriceId("pro");
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route: "stripe/upgrade",
    });
    return NextResponse.json({ error: "Billing configuration error" }, { status: 500 });
  }

  // ── Update subscription ───────────────────────────────────────────────────
  const itemId = stripeSub.items.data[0]?.id;
  if (!itemId) {
    return NextResponse.json({ error: "Subscription item not found" }, { status: 500 });
  }

  try {
    await getStripe().subscriptions.update(sub.stripe_subscription_id as string, {
      items:              [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata:           { ...stripeSub.metadata, plan: "pro" },
    });
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route:           "stripe/upgrade",
      subscription_id: sub.stripe_subscription_id,
      user_id:         user.id,
    });
    return NextResponse.json({ error: "Failed to upgrade subscription" }, { status: 500 });
  }

  // ── Sync plan immediately in DB + user_metadata ───────────────────────────
  const service = createServiceClient();
  await service
    .from("subscriptions")
    .update({ plan: "pro", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.stripe_subscription_id)
    .then(() => null, () => null);

  await service.auth.admin.updateUserById(user.id, {
    user_metadata: { plan: "pro" },
  }).catch(() => null);

  // ── PostHog — best-effort ─────────────────────────────────────────────────
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    void fetch("https://app.posthog.com/capture", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:     posthogKey,
        event:       "subscription_upgraded",
        distinct_id: user.id,
        properties:  { plan: "pro", from_plan: "analyst" },
      }),
    }).catch(() => null);
  }

  return NextResponse.redirect(`${SITE_URL}/app/billing?checkout=success`, { status: 303 });
}
