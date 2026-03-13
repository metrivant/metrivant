import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

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
