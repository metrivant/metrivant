// ── /api/stripe/checkout ──────────────────────────────────────────────────────
// POST — authenticated users only.
// Creates a Stripe Checkout session and redirects (303) to the hosted page.
//
// Accepts application/x-www-form-urlencoded (form submit) or application/json.
// Body: { plan: "analyst" | "pro" }

import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getStripe, getPriceId, VALID_PLANS } from "../../../../lib/stripe";
import { captureException } from "../../../../lib/sentry";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com").trim();

export async function POST(request: Request): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse plan ────────────────────────────────────────────────────────────
  let plan: string | null = null;
  const ct = request.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const body = await request.json() as { plan?: string };
      plan = body.plan ?? null;
    } else {
      const formData = await request.formData();
      plan = formData.get("plan") as string | null;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!plan || !(VALID_PLANS as readonly string[]).includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const validPlan = plan as "analyst" | "pro";

  // ── Resolve org ───────────────────────────────────────────────────────────
  const { data: orgRows } = await supabase
    .from("organizations")
    .select("id, stripe_customer_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const org = orgRows?.[0] ?? null;
  const orgId           = org?.id as string | null;
  const existingCustomer = (org?.stripe_customer_id as string | null) ?? null;

  // ── Stripe config validation ─────────────────────────────────────────────
  // Validate billing configuration before attempting any Stripe API call.
  // Captures structured context to Sentry so misconfiguration is immediately visible.
  const stripeKeyPresent     = !!(process.env.STRIPE_SECRET_KEY ?? "").trim();
  const stripeWebhookPresent = !!(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  const siteUrlPresent       = !!(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();

  if (!stripeKeyPresent || !siteUrlPresent) {
    captureException(new Error("billing_config_invalid"), {
      route:                  "stripe/checkout",
      plan:                   validPlan,
      stripe_key_present:     stripeKeyPresent,
      webhook_secret_present: stripeWebhookPresent,
      site_url_present:       siteUrlPresent,
    });
    return NextResponse.json({ error: "Billing configuration error" }, { status: 500 });
  }

  // ── Stripe price ──────────────────────────────────────────────────────────
  let priceId: string;
  try {
    priceId = getPriceId(validPlan);
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route:                  "stripe/checkout",
      plan:                   validPlan,
      stripe_key_present:     stripeKeyPresent,
      webhook_secret_present: stripeWebhookPresent,
      site_url_present:       siteUrlPresent,
    });
    return NextResponse.json({ error: "Billing configuration error" }, { status: 500 });
  }

  // ── Create checkout session ───────────────────────────────────────────────
  try {
    const session = await getStripe().checkout.sessions.create({
      mode:                "subscription",
      customer:            existingCustomer ?? undefined,
      customer_email:      existingCustomer ? undefined : (user.email ?? undefined),
      line_items:          [{ price: priceId, quantity: 1 }],
      success_url:         `${SITE_URL}/app/billing?checkout=success`,
      cancel_url:          `${SITE_URL}/pricing`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        org_id:  orgId ?? "",
        plan:    validPlan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          org_id:  orgId ?? "",
          plan:    validPlan,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }

    // PostHog — best-effort
    const posthogKey = process.env.POSTHOG_API_KEY;
    if (posthogKey) {
      const PLAN_AMOUNT_CENTS: Record<string, number> = { analyst: 900, pro: 1900 };
      void fetch("https://app.posthog.com/capture", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:     posthogKey,
          event:       "checkout_started",
          distinct_id: user.id,
          properties:  { plan: validPlan, amount_cents: PLAN_AMOUNT_CENTS[validPlan] ?? null },
        }),
      }).catch(() => null);
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route:   "stripe/checkout",
      plan:    validPlan,
      user_id: user.id,
    });
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
