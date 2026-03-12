"use client";

import { useEffect } from "react";
import { capture } from "../../../lib/posthog";

// Fires strategy_viewed on mount — keeps the page a server component.
export default function StrategyTracker() {
  useEffect(() => {
    capture("strategy_viewed");
  }, []);

  return null;
}
