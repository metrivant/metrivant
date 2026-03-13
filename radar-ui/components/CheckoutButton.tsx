"use client";

// Form-based checkout button. Submits to /api/stripe/checkout which
// verifies auth, creates a Stripe Checkout session, and redirects (303).
// Native form submit: works without JS and follows the redirect automatically.

type Props = {
  plan:      "analyst" | "pro";
  className?: string;
  children:  React.ReactNode;
};

export default function CheckoutButton({ plan, className, children }: Props) {
  return (
    <form action="/api/stripe/checkout" method="POST" className="contents">
      <input type="hidden" name="plan" value={plan} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
