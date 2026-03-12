"use client";

import { useEffect } from "react";
import { capture } from "../../../lib/posthog";

// Fires billing_opened on mount — keeps the billing page a server component.
export default function BillingTracker() {
  useEffect(() => {
    capture("billing_opened", { source: "direct" });
  }, []);

  return null;
}
