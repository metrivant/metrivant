"use client";

import { useEffect } from "react";
import { capture } from "../lib/posthog";

// Fires pricing_viewed on mount — keeps the pricing page a server component.
export default function PricingTracker() {
  useEffect(() => {
    capture("pricing_viewed");
  }, []);

  return null;
}
