import Stripe from "stripe";

// Lazy singleton — initialized on first call, not at module load.
// This prevents build-time failures when STRIPE_SECRET_KEY is not yet set.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}

// Plan → Stripe price ID mapping
export function getPriceId(plan: "analyst" | "pro"): string {
  if (plan === "pro") {
    const id = process.env.STRIPE_PRO_PRICE_ID;
    if (!id) throw new Error("STRIPE_PRO_PRICE_ID is not set");
    return id;
  }
  const id = process.env.STRIPE_ANALYST_PRICE_ID;
  if (!id) throw new Error("STRIPE_ANALYST_PRICE_ID is not set");
  return id;
}

export const VALID_PLANS = ["analyst", "pro"] as const;
export type StripePlan = (typeof VALID_PLANS)[number];
