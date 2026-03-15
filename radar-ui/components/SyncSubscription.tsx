"use client";

// SyncSubscription — mounts on the radar page when the trial lock screen is
// displayed (trialExpired && !hasActiveSub).
//
// Calls POST /api/stripe/sync-subscription once on mount to check whether Stripe
// has an active subscription that the webhook missed writing. If the sync finds
// one, router.refresh() re-renders the server component tree, clearing the lock
// screen automatically.
//
// This component renders nothing visible — it is a pure side-effect trigger.

import { useEffect, useRef } from "react";
import { useRouter }         from "next/navigation";

export default function SyncSubscription() {
  const router  = useRouter();
  const didSync = useRef(false);

  useEffect(() => {
    if (didSync.current) return;
    didSync.current = true;

    (async () => {
      try {
        const res = await fetch("/api/stripe/sync-subscription", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) return;

        const data = await res.json() as { ok?: boolean; synced?: boolean };

        if (data.synced) {
          // Subscription found and written — refresh to clear the lock screen
          router.refresh();
        }
      } catch {
        // Non-fatal — lock screen remains, user can subscribe normally
      }
    })();
  }, [router]);

  // Intentionally renders nothing
  return null;
}
