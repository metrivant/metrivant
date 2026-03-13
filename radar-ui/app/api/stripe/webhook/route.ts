// ── /api/stripe/webhook ───────────────────────────────────────────────────────
// POST — called by Stripe only. No user auth. Verified by signature.
//
// Events handled:
//   checkout.session.completed       → create subscription record
//   customer.subscription.updated    → sync status / cancel_at_period_end
//   customer.subscription.deleted    → mark canceled
//   invoice.payment_failed           → mark past_due

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "../../../../lib/stripe";
import { createServiceClient } from "../../../../lib/supabase/service";
import { captureException } from "../../../../lib/sentry";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// Next.js App Router — read raw body for Stripe signature verification.
// Do NOT parse body as JSON before calling constructEvent.
export async function POST(request: Request): Promise<NextResponse> {
  if (!WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // ── Verify signature ──────────────────────────────────────────────────────
  const rawBody = await request.arrayBuffer();
  const buf     = Buffer.from(rawBody);
  const sig     = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, WEBHOOK_SECRET);
  } catch (err) {
    captureException(
      err instanceof Error ? err : new Error("Stripe webhook signature verification failed"),
      { route: "stripe/webhook", sig: sig.slice(0, 20) }
    );
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  const service = createServiceClient();

  // ── Dispatch ──────────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(service, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(service, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(service, event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(service, event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event — acknowledge receipt
        break;
    }
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route:      "stripe/webhook",
      event_type: event.type,
      event_id:   event.id,
    });
    // Return 200 so Stripe does not retry an event that failed due to a code bug.
    // Retries are appropriate for network failures (5xx) but not logic errors.
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }

  return NextResponse.json({ received: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type ServiceClient = ReturnType<typeof createServiceClient>;

async function handleCheckoutCompleted(
  service:  ServiceClient,
  session:  Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "subscription" || !session.subscription) return;

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription.id;

  const customerId = typeof session.customer === "string"
    ? session.customer
    : (session.customer?.id ?? "");

  const orgId  = session.metadata?.org_id ?? null;
  const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;

  // Retrieve full subscription object for period / cancel state
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const plan = (subscription.metadata?.plan ?? "analyst") as "analyst" | "pro";

  await syncSubscription(service, subscription, plan, orgId, customerId);

  // Update org with stripe_customer_id
  if (orgId && customerId) {
    const { error } = await service
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", orgId);
    if (error) {
      captureException(new Error("Failed to update org stripe_customer_id"), {
        org_id: orgId, customer_id: customerId,
      });
    }
  }

  // Update user plan metadata so the UI immediately reflects the upgrade
  if (userId) {
    const { error } = await service.auth.admin.updateUserById(userId, {
      user_metadata: { plan },
    });
    if (error) {
      captureException(new Error("Failed to update user_metadata plan"), {
        user_id: userId, plan,
      });
    }
  }

  // PostHog — best-effort
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey && userId) {
    void fetch("https://app.posthog.com/capture", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:     posthogKey,
        event:       "checkout_completed",
        distinct_id: userId,
        properties:  { plan },
      }),
    }).catch(() => null);
  }
}

async function handleSubscriptionUpdated(
  service:      ServiceClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const orgId = subscription.metadata?.org_id ?? null;
  const plan  = (subscription.metadata?.plan ?? "analyst") as "analyst" | "pro";
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  await syncSubscription(service, subscription, plan, orgId, customerId);

  // If subscription was canceled via portal, fire PostHog event
  if (subscription.cancel_at_period_end) {
    const posthogKey = process.env.POSTHOG_API_KEY;
    const userId = subscription.metadata?.user_id;
    if (posthogKey && userId) {
      void fetch("https://app.posthog.com/capture", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:     posthogKey,
          event:       "subscription_canceled",
          distinct_id: userId,
          properties:  { plan },
        }),
      }).catch(() => null);
    }
  }
}

async function handleSubscriptionDeleted(
  service:      ServiceClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const orgId = subscription.metadata?.org_id ?? null;
  const plan  = (subscription.metadata?.plan ?? "analyst") as "analyst" | "pro";
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  await syncSubscription(service, subscription, plan, orgId, customerId);

  // Revert user plan to "analyst" when subscription fully deletes
  const userId = subscription.metadata?.user_id;
  if (userId) {
    await service.auth.admin.updateUserById(userId, {
      user_metadata: { plan: "analyst" },
    }).catch(() => null);
  }
}

async function handlePaymentFailed(
  service:  ServiceClient,
  invoice:  Stripe.Invoice,
): Promise<void> {
  // In API 2026-02-25.clover, subscription ID lives on invoice.parent.subscription_details.subscription
  const subRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id;

  if (!subscriptionId) return;

  const { error } = await service
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    captureException(new Error("Failed to update subscription to past_due"), {
      subscription_id: subscriptionId,
    });
  }

  // PostHog — best-effort
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
    const userId = subscription?.metadata?.user_id;
    if (userId) {
      void fetch("https://app.posthog.com/capture", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:     posthogKey,
          event:       "payment_failed",
          distinct_id: userId,
          properties:  {},
        }),
      }).catch(() => null);
    }
  }
}

// ── syncSubscription ──────────────────────────────────────────────────────────
// Upserts subscription row. Idempotent — safe to call multiple times.

async function syncSubscription(
  service:      ServiceClient,
  subscription: Stripe.Subscription,
  plan:         "analyst" | "pro",
  orgId:        string | null,
  customerId:   string,
): Promise<void> {
  if (!orgId) {
    // Attempt to look up org via stripe_customer_id
    const { data: orgRows } = await service
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .limit(1);
    orgId = (orgRows?.[0]?.id as string | null) ?? null;
  }

  if (!orgId) {
    captureException(new Error("syncSubscription: could not resolve org_id"), {
      subscription_id: subscription.id,
      customer_id:     customerId,
    });
    return;
  }

  // In API 2026-02-25.clover, current_period_end moved to items.data[0].current_period_end
  const periodEndTs = subscription.items?.data?.[0]?.current_period_end;
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
    captureException(new Error("Failed to upsert subscription"), {
      subscription_id: subscription.id,
      org_id:          orgId,
      error_message:   error.message,
    });
  }
}
