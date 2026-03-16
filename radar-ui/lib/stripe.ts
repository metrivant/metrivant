import Stripe from "stripe";

// Lazy singleton — initialized on first call, not at module load.
// This prevents build-time failures when STRIPE_SECRET_KEY is not yet set.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}

// Plan → Stripe price ID mapping
export function getPriceId(plan: "analyst" | "pro"): string {
  if (plan === "pro") {
    const id = (process.env.STRIPE_PRO_PRICE_ID ?? "").trim();
    if (!id) throw new Error("STRIPE_PRO_PRICE_ID is not set");
    return id;
  }
  // STRIPE_ANALYST_PRICE_ID is the canonical env var name.
  // STRIP_ANALYST_PRICE_ID (missing the E) is a legacy typo from early deployments.
  // Keep this fallback until all production environments are confirmed migrated to STRIPE_.
  // Do not remove without verifying no active deployment uses the typo'd name.
  const id = (process.env.STRIPE_ANALYST_PRICE_ID ?? process.env.STRIP_ANALYST_PRICE_ID ?? "").trim();
  if (!id) throw new Error("STRIPE_ANALYST_PRICE_ID is not set");
  return id;
}

export const VALID_PLANS = ["analyst", "pro"] as const;
export type StripePlan = (typeof VALID_PLANS)[number];
