"use client";

import { useState } from "react";

// Form-based checkout button. Submits to /api/stripe/checkout which
// verifies auth, creates a Stripe Checkout session, and redirects (303).
// Native form submit: works without JS and follows the redirect automatically.
// Loading state prevents double-submit confusion.

type Props = {
  plan:       "analyst" | "pro";
  className?: string;
  children:   React.ReactNode;
};

export default function CheckoutButton({ plan, className, children }: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <form
      action="/api/stripe/checkout"
      method="POST"
      className="contents"
      onSubmit={() => setLoading(true)}
    >
      <input type="hidden" name="plan" value={plan} />
      <button
        type="submit"
        disabled={loading}
        className={className}
        style={loading ? { opacity: 0.55, cursor: "default", pointerEvents: "none" } : undefined}
      >
        {loading ? "Redirecting…" : children}
      </button>
    </form>
  );
}
