// ── /api/stripe/portal ────────────────────────────────────────────────────────
// POST — authenticated users with an active Stripe customer only.
// Creates a Stripe Billing Portal session and redirects (303).

import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { stripe } from "../../../../lib/stripe";
import { captureException } from "../../../../lib/sentry";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";

export async function POST(request: Request): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Resolve stripe_customer_id from org ───────────────────────────────────
  const { data: orgRows } = await supabase
    .from("organizations")
    .select("id, stripe_customer_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const org = orgRows?.[0] ?? null;
  const stripeCustomerId = (org?.stripe_customer_id as string | null) ?? null;

  if (!stripeCustomerId) {
    // No Stripe customer — redirect to billing page (no portal available)
    return NextResponse.redirect(`${SITE_URL}/app/billing`, { status: 303 });
  }

  // ── Create portal session ─────────────────────────────────────────────────
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   stripeCustomerId,
      return_url: `${SITE_URL}/app/billing`,
    });

    // PostHog — best-effort
    const posthogKey = process.env.POSTHOG_API_KEY;
    if (posthogKey) {
      void fetch("https://app.posthog.com/capture", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:     posthogKey,
          event:       "billing_portal_opened",
          distinct_id: user.id,
          properties:  {},
        }),
      }).catch(() => null);
    }

    return NextResponse.redirect(portalSession.url, { status: 303 });
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route:   "stripe/portal",
      user_id: user.id,
    });
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
