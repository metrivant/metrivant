"use client";

import { useEffect } from "react";
import { identify } from "../lib/posthog";

/**
 * Identifies the authenticated user in PostHog with plan and sector.
 * Rendered inside the /app layout so it runs for every authenticated page.
 * No UI output — returns null.
 */
export default function PostHogIdentify({
  userId,
  email,
  plan,
  sector,
}: {
  userId: string;
  email:  string | null;
  plan:   string | null;
  sector: string | null;
}) {
  useEffect(() => {
    identify(userId, {
      ...(email  ? { email }  : {}),
      ...(plan   ? { plan }   : {}),
      ...(sector ? { sector } : {}),
    });
  }, [userId, email, plan, sector]);

  return null;
}
