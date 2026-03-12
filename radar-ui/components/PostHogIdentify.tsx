"use client";

import { useEffect } from "react";
import { identify } from "../lib/posthog";

/**
 * Identifies the authenticated user in PostHog.
 * Rendered inside the /app layout so it runs for every authenticated page.
 * No UI output — returns null.
 */
export default function PostHogIdentify({
  userId,
  email,
}: {
  userId: string;
  email:  string | null;
}) {
  useEffect(() => {
    identify(userId, email ? { email } : undefined);
  }, [userId, email]);

  return null;
}
