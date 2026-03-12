/**
 * Canonical PostHog client for Metrivant.
 *
 * - Client-side only: all exports are SSR-safe no-ops when window is undefined.
 * - Wraps posthog-js singleton; initialised once by PostHogProvider.
 * - Server-side API routes continue using raw fetch (they have no window).
 */

import posthog from "posthog-js";

/** Returns true when PostHog can safely run (browser + key present). */
function isActive(): boolean {
  return (
    typeof window !== "undefined" &&
    !!process.env.NEXT_PUBLIC_POSTHOG_KEY
  );
}

/**
 * Capture a client-side event.
 * No-op on the server or when the key is missing.
 */
export function capture(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!isActive()) return;
  posthog.capture(event, properties);
}

/**
 * Identify an authenticated user.
 * Call once after login; links the anonymous session to the real user.
 */
export function identify(
  userId: string,
  properties?: Record<string, unknown>
): void {
  if (!isActive()) return;
  posthog.identify(userId, properties);
}

/**
 * Reset identity — call on sign-out to discard the identified session.
 */
export function reset(): void {
  if (!isActive()) return;
  posthog.reset();
}

export { posthog as posthogInstance };
