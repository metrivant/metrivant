"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

/**
 * Initialises posthog-js once and tracks page views on every route change.
 * Must be rendered inside the root layout, client-side only.
 *
 * Configuration:
 * - autocapture off         — avoids noisy click/form event flood
 * - capture_pageview false  — we fire page_viewed manually to control properties
 * - capture_pageleave false — not needed for this use case
 * - session_recording off   — not needed at launch
 */
export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname     = usePathname();
  const initialised  = useRef(false);
  const lastPath     = useRef<string>("");

  useEffect(() => {
    const key  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

    if (!key || initialised.current) return;

    posthog.init(key, {
      api_host:             host,
      ui_host:              "https://us.posthog.com",
      capture_pageview:     false,  // manual — avoids double-firing with Next.js router
      capture_pageleave:    false,
      autocapture:          false,  // off — high-signal manual tracking only
      disable_session_recording: true,
      persistence:          "localStorage",
    });

    initialised.current = true;
  }, []);

  // Fire page_viewed on every pathname change (covers client-side navigation)
  useEffect(() => {
    if (!initialised.current) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    posthog.capture("page_viewed", { path: pathname });
  }, [pathname]);

  return <>{children}</>;
}
