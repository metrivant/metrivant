"use client";

import { useEffect } from "react";

// Fires strategy_viewed on mount — keeps the page a server component.
export default function StrategyTracker() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    fetch("https://app.posthog.com/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event:   "strategy_viewed",
        properties: { $current_url: window.location.href },
      }),
    }).catch(() => null);
  }, []);

  return null;
}
