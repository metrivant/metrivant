"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { capture } from "../../../lib/posthog";

// Fires billing_opened on mount.
// Detects ?checkout=success and shows a success banner + fires checkout_completed.
export default function BillingTracker() {
  const searchParams   = useSearchParams();
  const checkoutDone   = searchParams.get("checkout") === "success";
  const [show, setShow] = useState(checkoutDone);

  useEffect(() => {
    capture("billing_opened", { source: "direct" });
  }, []);

  useEffect(() => {
    if (!checkoutDone) return;
    // "checkout_success_confirmed" = client-side UI confirmation of successful payment.
    // The authoritative "checkout_completed" event is fired server-side by the Stripe webhook.
    // Using a distinct event name prevents double-counting conversions in PostHog funnels.
    capture("checkout_success_confirmed", { source: "billing_redirect" });

    // Auto-dismiss after 6 s
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, [checkoutDone]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex items-center gap-3 rounded-full border border-[#00B4FF]/30 bg-[#020208] px-5 py-3 shadow-lg"
        style={{ boxShadow: "0 0 24px rgba(0,180,255,0.12)" }}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#00B4FF]" />
        <span className="text-[13px] font-medium text-[#00B4FF]">
          Subscription activated — welcome to Metrivant
        </span>
      </div>
    </div>
  );
}
