// ── /api/stripe-webhook ───────────────────────────────────────────────────────
// Alias for /api/stripe/webhook — Stripe dashboard is configured to POST here.
// The canonical handler lives at /api/stripe/webhook/route.ts.
// This file re-exports the POST handler so both URLs work identically.

export { POST } from "../stripe/webhook/route";
